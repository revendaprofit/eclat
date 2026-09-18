# SOP — Integração fiscal (Brasil NFe)

Spec: `docs/superpowers/specs/2026-09-16-fiscal-brasilnfe-design.md` (revisão 2).
Código: `apps/backend/src/lib/fiscal/`. Dados: Supabase, tabelas `fiscal_*` (migrations 0011 e 0012).

## Regra nº 1 — contrato de fornecedor não se supõe

A revisão 1 deste módulo foi escrita, revisada e mesclada com 151 testes verdes — e nenhuma nota
autorizada teria sido reconhecida, porque código **e fixtures** nasceram da mesma suposição sobre
o formato da API. Teste contra contrato inventado mede coerência interna, não correção.

Portanto, para qualquer integração externa:

1. **Antes do código**, obter o contrato de uma fonte do fornecedor: documentação, SDK oficial
   (os tipos servem de contrato mesmo sem usar o SDK) ou resposta real de sandbox.
2. **Toda fixture cita a fonte** num comentário (`// formato: SDK brasilnfe@3.1.3, NotaFiscalRetorno`).
3. Nome de campo, endpoint ou formato marcado como "pendente de confirmação" **bloqueia o merge**,
   não vira comentário.

Fontes da Brasil NFe: `https://www.brasilnfe.com.br/llms-full.txt` (documentação inteira em texto),
`/webhooks`, `/conceitos-fiscais/*`, e o pacote npm `brasilnfe` (tipos em `dist/models/`).

## O contrato, em uma tela

- Base `https://api.brasilnfe.com.br/services/fiscal/` · todos `POST` · headers `Token` + `UserToken`.
- `EnviarNotaFiscal` é **síncrono** (timeout de 5 min) e **não dispara webhook**. A resposta traz
  `ReturnNF { Ok, CodStatusRespostaSefaz, ChaveNF, Numero, Serie }` + `Base64Xml` + `Base64File`.
- Autorizado = `Ok === true` **e** código 100/150. Combinação incoerente = **indefinido**, nunca adivinhado.
- A **posição** no array `Produtos` é o `nItem`. Não existe campo para informá-lo.
- Emitente, totais e numeração **não são enviados**: cadastro, cálculo e contador são do fornecedor.
- `Intermediador` **não é enviado** (venda direta; enviar é rejeição 435). O exemplo de JSON deles o inclui.
- NFD: `ChaveAcessoReferenciada` + `NItemReferenciado` **por produto**. `NFReferencia` (raiz) nunca.

## Nota duplicada — a barreira é só nossa

Com numeração automática, a SEFAZ aceita duas notas para o mesmo pedido (cada tentativa ganha
número novo). Defesas, todas em `fiscal-emissao.ts`:

1. grava o documento **antes** de transmitir, com `idempotency_key` única;
2. a chave viaja no payload como `IdentificadorInterno`;
3. antes de **qualquer** nova tentativa, `prepararTentativa` pergunta ao fornecedor se alguma
   tentativa anterior existe lá (`ObterNotasFiscais`). Se existe, adota. Se a consulta falha, **não emite**;
4. resposta que não fecha → `transmitido_sem_confirmacao`. A varredura localiza; **nunca** conclui
   sozinha que "não emitiu" — só a rota manual `resolver` declara isso.

## Webhook

HMAC-SHA256 do **corpo bruto** (`req.rawBody`, via `preserveRawBody` em `middlewares.ts`), header
`X-Webhook-Signature: sha256=<hex>`, comparação em tempo constante, 401 se inválido. Reserializar o
JSON quebra a assinatura. O webhook não é gatilho da reconciliação de vendas (a rota síncrona não o dispara).

## Roteiro de homologação (o dono executa; nenhum agente consegue)

Pré-requisitos: migration 0012 aplicada; empresa cadastrada no painel da Brasil NFe com os dados
do §6.0 da spec, certificado A1 carregado, **ambiente = homologação**; tokens no `.env` do backend;
perfil tributário padrão e NCM em ao menos um produto; `fiscal_config.ambiente = homologacao`.

1. **Prévia de venda** (não transmite): Cockpit → Pedidos → abra o pedido de teste → seção "Nota
   fiscal" → link **"Ver prévia da NF-e (XML, não transmite)"** (só aparece enquanto o pedido não
   tem nota autorizada, ou seja, sem `chave_acesso`; abre `/api/fiscal-previa/[orderId]` numa aba
   nova). Conferir no XML: NCM, CFOP, CSOSN, `vFrete` rateado, ausência de `infIntermed`.
   **Verificar se há grupo IBSCBS** (risco 1).
2. Ligar `emissao_ativa`. **Despachar** o pedido de teste. Esperado: documento vai a `verificado`
   na hora; `numero`, `serie`, `chave_acesso` preenchidos; "Baixar DANFE" abre o PDF.
3. **Despachar de novo** o mesmo pedido: nenhuma nota nova (conferir no painel deles).
4. **Prévia de NFD** de 1 item de um pedido com 2. Conferir `refNFe`/`nItem` do item certo.
5. **Emitir a NFD**. Se a SEFAZ rejeitar por destinatário (VC02-50), é o risco 10 da spec: o bloco
   `Cliente` de `fiscal-payload-devolucao.ts` é o único ponto a mudar.
6. **Webhook**: painel deles → Webhooks → Testar. Esperado 200. Conferir no log `test.ping`.
7. Anotar em `progress.md` o resultado de cada passo e qualquer rejeição com o código.

Produção só depois dos riscos 1 (IBS/CBS) e 3 (tabela do contador) da spec resolvidos.
