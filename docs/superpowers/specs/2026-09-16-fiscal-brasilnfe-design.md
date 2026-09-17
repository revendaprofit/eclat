# Integração Fiscal — Brasil NFe (Projeto A)

Data: 2026-09-16 · Status: aguardando revisão do dono · Pré-requisito de: Projeto B (Reversa), Projeto C (Carteira/vale-compra), Projeto D (Troca por produto qualquer).

## 1. Contexto e objetivo

A use.ÉCLAT ainda **não emite nota fiscal** — nunca emitiu nenhuma. O Projeto A entrega a capacidade de emitir **NF-e de venda** (modelo 55) no despacho do pedido, e a **capacidade** de emitir NF-e de devolução (NFD), que o Projeto B vai automatizar.

Este projeto vem **antes** da reversa por dois motivos:

1. Vender sem nota é uma obrigação fiscal em aberto que a reversa só agrava.
2. Desde **01/09/2026**, a NFD precisa referenciar a nota de origem **item a item**. Se a NF-e de venda não for emitida guardando o número de item (`nItem`) de cada linha, **a devolução daquele pedido se torna impossível de emitir** — e não há como recuperar depois sem ler o XML antigo.

O ponto 2 é a razão pela qual este projeto não pode ser adiado "pra depois da reversa".

## 2. Decisões já tomadas (não reabrir)

1. **Fornecedor: Brasil NFe** (CNPJ 39.658.743/0001-99). Escolhido sobre Focus NFe e sobre ERPs (Bling/Tiny/Omie). R$ 49,90/mês, notas ilimitadas, SDK Node.js oficial (`npm install brasilnfe`), download de XML autorizado, pré-visualização sem transmitir, docs em Swagger.
2. **Não contratar ERP.** O Cockpit já faz estoque (Fase 3), pedidos e envios (Fase 4) e DRE (Fase 5). Um ERP seria um segundo sistema competindo pela fonte da verdade — viola o Invariante 1. O emissor fiscal não guarda estado de negócio: é um serviço sem opinião, como a Getnet é para pagamento.
3. **Certificado digital e-CNPJ A1**, renovação anual. Contratado pelo dono.
4. **Regime: Simples Nacional.** Implica **CSOSN**, não CST.
5. **UF de origem: Minas Gerais.**
6. **Momento da emissão: no despacho**, engatado no botão "Despachar" que já existe na Fase 4 do Cockpit — a DANFE precisa ir dentro da caixa.
7. **Numeração começa do zero.** Série 1, número 1. Sem migração de contador.
8. **A emissão automática da NFD fica no Projeto B.** Aqui entra a capacidade + botão manual no Cockpit.

## 3. Escopo

**Entra:** módulo `fiscal` no backend (schema, cliente da API, montagem de payload, transmissão, reconciliação de XML, rotas admin); tabelas no Supabase; aba Fiscal no Cockpit (configuração, fila de exceções); status da nota no detalhe do pedido; botão "Emitir NF-e" no fluxo de despacho; botão manual "Emitir NFD"; testes de integração e de unidade.

**Não entra:** emissão automática de NFD (Projeto B); NFC-e (não há loja física); NFS-e (não há serviço); SPED/SINTEGRA (o contador gera a partir dos XMLs); carta de correção e cancelamento pela UI (fase seguinte — no Projeto A, cancelamento é feito pelo painel da Brasil NFe); conciliação fiscal no DRE.

## 4. Fronteira de responsabilidade — o que é nosso e o que é do contador

Esta seção existe para evitar que o sistema finja saber tributação.

| Responsabilidade | De quem |
|---|---|
| Estrutura do documento, transmissão, guarda do XML, `nItem`, idempotência, tratamento de erro | **Nosso (código)** |
| NCM de cada produto | **Contador**, cadastrado no Cockpit |
| CSOSN aplicável, CFOP por destino, alíquotas, se há ICMS-ST em vestuário em MG | **Contador**, cadastrado em `fiscal_perfil` |
| Natureza da operação de devolução ao consumidor PF | **Contador** |
| Campos de IBS/CBS da Reforma Tributária (ver §11, risco aberto) | **Contador + Brasil NFe** |

O sistema **nunca infere** um valor tributário. Se falta perfil fiscal para um produto, a emissão **falha e vai pra fila** — não chuta um padrão.

## 5. Onde mora cada dado

| Dado | Onde | Justificativa |
|---|---|---|
| **NCM** | `variant.hs_code` (campo nativo do Medusa) | NCM é a extensão brasileira do HS code. Atributo de produto = comércio (Invariante 2) |
| **Origem da mercadoria** (0–8) | `variant.origin_country` (nativo) + mapa | idem |
| **CFOP, CSOSN, alíquotas** | Supabase `fiscal_perfil` | regra tributária, não atributo de produto; muda com regime e UF de destino |
| **Emitente** (CNPJ, IE, endereço, regime, série, ambiente) | Supabase `fiscal_config` | configuração fiscal |
| **Tokens da Brasil NFe** | env: `BRASILNFE_USER_TOKEN`, `BRASILNFE_COMPANY_TOKEN`, `BRASILNFE_WEBHOOK_SECRET` | segredo, nunca no banco, nunca em log |

**Limitação conhecida e aceita:** o Medusa snapshota apenas `product_title`, `variant_sku` e `variant_title` na linha do pedido — o `hs_code` **não** é copiado. A nota lê o NCM vigente no momento da emissão. Mitigação: gravamos o `payload_enviado` inteiro; a nota emitida é o registro histórico, o cadastro não é.

## 6. Dados (Supabase, migration `0011_fiscal.sql`)

Dinheiro em **centavos inteiros** (Invariante 3). RLS: anon negado, backend via `service_role` (padrão das migrations existentes).

### 6.0 Valores do emitente

Fontes: cartão CNPJ (Receita Federal, 19/08/2026) e **Cadastro Centralizado de Contribuinte — CCC/SVRS** (consulta de 25/08/2026). Onde as duas divergem, vale o CCC: é o cadastro que a SEFAZ consulta ao validar a NF-e.

| Campo | Valor | Fonte |
|---|---|---|
| CNPJ | 68.673.407/0001-13 (matriz) | ambos |
| Razão social | CAMILA DE MOURA NOGUEIRA | ambos |
| Nome fantasia | USE ECLAT | ambos |
| **Inscrição Estadual** | **56295050042** · situação **Habilitado** · tipo **IE Normal** | CCC |
| **Regime de tributação** | **Simples Nacional** (confirmado pela SEFAZ, não presumido) → `crt = 1` | CCC |
| Situação CNPJ na SEFAZ | Sem restrição | CCC |
| Crédito presumido | **Não** | CCC |
| Tipo produtor | Não | CCC |
| IE como destinatário | **Obrigatória** — relevante na NFD, onde a ÉCLAT é destinatária de si mesma | CCC |
| Natureza jurídica | 213-5 — Empresário (Individual) · porte ME | ambos |
| CNAE principal | 73.19-0-02 — Promoção de vendas ⚠️ ver §11 risco 6 | ambos |
| CNAE secundários | 47.55-5-01 (tecidos) · **47.81-4-00 (vestuário e acessórios)** | cartão CNPJ |
| Endereço | R Norte, 180 — Angola, Betim/MG — CEP 32604182 | ambos |
| Código IBGE do município | **3106705** (Betim) | CCC |
| Início de atividade | 19/08/2026 · situação ATIVA | ambos |

### 6.1 `fiscal_config` (linha única)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | int, sempre 1 | check constraint garante linha única |
| `cnpj`, `razao_social`, `nome_fantasia` | text | |
| `ie`, `im` | text | inscrição estadual / municipal |
| `crt` | int | 1 = Simples Nacional |
| `endereco_*` | text | logradouro, número, bairro, município, código IBGE, UF (`MG`), CEP |
| `serie_nfe` | int | começa em 1 |
| `ambiente` | enum `homologacao` \| `producao` | |
| `emissao_ativa` | bool | interruptor mestre — desligado, o sistema não transmite e não monta documento fiscal |

Desligado (padrão de fábrica), `emissao_ativa` não apenas bloqueia a transmissão — ele impede que
um `fiscal_documento` sequer seja montado. Montar um documento exige `payload_enviado` completo
(CPF/CNPJ do destinatário, código IBGE do município, NCM de cada item, perfil tributário
resolvido), dados que podem legitimamente não existir ainda enquanto o checkout não os coleta.
Registrar um documento que não é uma tentativa real de nota — com campos inventados só para
preencher a coluna — seria pior para a auditoria fiscal do que não registrar nada. Com o
interruptor desligado, o despacho segue normalmente e o pedido grava em `metadata.fiscal` que
saiu sem nota, com o motivo e o instante — esse é o vestígio de auditoria deste caso, não a
tabela `fiscal_documento`.

### 6.2 `fiscal_perfil`
Regra tributária, resolvida do mais específico para o mais genérico: **produto → categoria → padrão**.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `escopo` | enum `padrao` \| `categoria` \| `produto` | exatamente 1 linha `padrao` |
| `alvo_id` | text nullable | handle da categoria ou id do produto |
| `csosn` | text | ex.: `102`, `500` — definido pelo contador |
| `cfop_dentro_uf` | text | venda dentro de MG |
| `cfop_fora_uf` | text | venda interestadual a não contribuinte |
| `cfop_devolucao_dentro_uf` | text | entrada, devolução |
| `cfop_devolucao_fora_uf` | text | entrada, devolução |
| `origem_padrao` | int 0–8 | fallback quando a variante não tem `origin_country` |
| `ativo` | bool | |

### 6.3 `fiscal_documento`
Uma linha por documento fiscal.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `medusa_order_id` | text | |
| `tipo` | enum `venda` \| `devolucao` | |
| `modelo` | int | 55 |
| `serie`, `numero` | int nullable | preenchidos após autorização |
| `chave_acesso` | text nullable, unique | 44 dígitos |
| `status` | enum — ver §9 | |
| `ambiente` | enum `homologacao` \| `producao` | |
| `idempotency_key` | text, **unique** | `{medusa_order_id}:{tipo}:{ambiente}` |
| `payload_enviado` | jsonb | gravado **antes** da transmissão |
| `resposta_bruta` | jsonb nullable | |
| `rejeicao_codigo`, `rejeicao_motivo` | text nullable | |
| `xml_url`, `danfe_url` | text nullable | |
| `documento_origem_id` | uuid nullable | só em `devolucao` → aponta para o documento de venda |
| `verificado_em` | timestamptz nullable | preenchido pela reconciliação (§7.3) |
| `created_at`, `updated_at` | | |

### 6.4 `fiscal_documento_item` — a tabela que resolve a VC03-20
| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid | |
| `fiscal_documento_id` | uuid FK | |
| `medusa_line_item_id` | text | |
| `ordem_enviada` | int | posição 1-indexada no array que **nós** enviamos |
| `n_item_verificado` | int nullable | lido do XML **autorizado pela SEFAZ** |
| `ncm` | text | |
| `quantidade` | int | |
| `valor_unitario_centavos` | int | |

`ordem_enviada` é o que nós afirmamos. `n_item_verificado` é o que a SEFAZ autorizou. **São colunas diferentes de propósito** — ver §7.3.

## 7. Fluxo de emissão da NF-e de venda

Disparado no botão "Despachar" do Cockpit (Fase 4), **antes** de gerar o fulfillment.

### 7.1 Montar e pré-visualizar
1. Lê o pedido no Medusa (fonte da verdade do comércio).
2. Para cada linha: resolve NCM (`variant.hs_code`), origem (`variant.origin_country`) e perfil fiscal (produto → categoria → padrão).
3. **Se faltar NCM ou perfil, aborta** com erro legível apontando o produto. Não chuta.
4. Escolhe CFOP pela UF do endereço de entrega: MG → `cfop_dentro_uf`; demais → `cfop_fora_uf`.
5. Destinatário: CPF, `indIEDest = 9` (não contribuinte), `indFinal = 1` (consumidor final), `indPres = 2` (operação não presencial, pela Internet).
6. Chama a **pré-visualização** da Brasil NFe — gera XML/PDF sem transmitir à SEFAZ e **sem consumir numeração**.

### 7.2 Transmitir
7. Grava `fiscal_documento` (status `montado`) + `fiscal_documento_item` com `ordem_enviada`, **e o `payload_enviado`**, tudo antes de chamar a API.
8. Transmite com `idempotency_key`. Se a chave já existe com documento autorizado, **não reemite** — retorna o existente.
9. Grava a resposta: autorizado / rejeitado / denegado.

### 7.3 Reconciliar — a etapa que não pode ser pulada

A Brasil NFe **não retorna o `nItem`**. Eles geram o `nItem` a partir da ordem em que enviamos os itens. Isso é um **contrato posicional implícito**, e contrato implícito quebra em silêncio: se algum dia eles reordenarem ou agruparem linhas, a devolução daquele pedido é rejeitada pela SEFAZ meses depois.

A reconciliação é disparada por **duas fontes independentes**, porque nenhuma das duas é confiável sozinha:

**Gatilho primário — webhook.** A plataforma da Brasil NFe permite cadastrar um webhook por empresa. Rota `/webhooks/brasilnfe` no backend (mesmo padrão de `/webhooks/whatsapp`), no domínio público do Railway.

**Gatilho de segurança — varredura periódica.** Rotina que busca documentos em `transmitido` ou `autorizado_nao_verificado` há mais de N minutos e reconcilia. Webhook se perde; obrigação fiscal não pode depender de entrega de rede.

Em ambos os casos, o mesmo procedimento:

10. Baixa o **XML autorizado** (endpoint de Consultas da Brasil NFe).
11. Faz parse de cada `<det nItem="N">` e grava `n_item_verificado`.
12. Confere que `n_item_verificado` bate com `ordem_enviada`. **Divergência não é erro fatal** — grava o valor real e registra um alerta, porque o valor da SEFAZ é o que vale.
13. Marca `verificado_em`.

**O webhook é tratado como dado não confiável:** é idempotente (pode chegar duas vezes), a autenticidade é verificada antes de qualquer efeito, e ele **nunca** carrega o dado fiscal em si — só avisa "o documento X mudou". A verdade continua vindo do XML que nós baixamos. Um webhook forjado não consegue fabricar uma autorização.

**Trava de segurança:** só um `fiscal_documento` com `verificado_em` preenchido pode ser referenciado numa NFD. Sem isso, o sistema **recusa** emitir a devolução e joga na fila de exceção do Cockpit.

O efeito: a falha acontece numa fila interna de trabalho, meses antes, sem cliente envolvido — em vez de acontecer com a cliente esperando, o produto já de volta no CD, e a SEFAZ rejeitando com VC03-20.

## 8. Fluxo da NFD (capacidade, acionada manualmente no Projeto A)

NF-e de **entrada** (`tpNF = 0`), finalidade **4 (devolução)**.

1. Exige um `fiscal_documento` de venda **verificado**. Sem isso, recusa.
2. Para cada item devolvido, monta o grupo **`DFeReferenciado`** com a **chave de acesso** da nota de venda **e o `n_item_verificado`** daquele item.
3. Regras de validação que isso atende: **VC02-14** (referência exclusivamente item a item, `refNFe` genérico proibido), **VC03-20** (`nItem` obrigatório), **VC02-40** (emitente das notas referenciadas igual em todos os itens), **VC02-50** (destinatário da NF-e igual ao emitente da nota referenciada).
4. Devolução **parcial** é o caso normal: referencia só os itens devolvidos.
5. Pré-visualiza antes de transmitir — o erro fiscal vira erro de teste.

## 9. Estados e tratamento de erro

Nenhuma falha é silenciosa. Toda transição grava motivo legível.

| Status | Significado | Ação |
|---|---|---|
| `montado` | payload gravado, ainda não transmitido | |
| `autorizado_nao_verificado` | SEFAZ autorizou, XML ainda não lido | **bloqueia NFD** daquele pedido |
| `verificado` | XML lido, `n_item_verificado` gravado | libera NFD |
| `rejeitado` | violou regra de validação | fila no Cockpit com código + motivo |
| `denegado` | irregularidade cadastral do emitente/destinatário | fila no Cockpit; não se resolve por retry |
| `em_contingencia` | SEFAZ indisponível | Brasil NFe emite em contingência; monitorar |
| `transmitido_sem_confirmacao` | timeout na transmissão | reconciliação consulta pela `idempotency_key`; **nunca reemite** |

**Por que idempotência não é preciosismo aqui:** nota fiscal duplicada não é um registro a mais no banco — é obrigação fiscal em duplicidade, que exige cancelamento formal em até 24h, senão vira apuração errada. Um retry ingênuo numa falha de rede custa caro.

## 10. Código e telas

**Backend:** `apps/backend/src/lib/fiscal/` — padrão do **Clube Éclat** (`lib/clube-*.ts`), **não** o de `beneficio-conjunto`.

Correção em relação ao rascunho anterior desta spec: `src/modules/` é reservado a **módulos Medusa**, que exigem models no Postgres do Medusa e registro explícito em `medusa-config.ts` (`modules: [{ resolve: "./src/modules/beneficio-conjunto" }]`). Os dados fiscais moram no **Supabase** (§6), igual a `clube_*`, `finance_*` e `produto_custo` — então o padrão correto é o do Clube: libs em `src/lib/`, acesso via PostgREST com `service_role`.

- `fiscal-db.ts` — acesso às tabelas no Supabase
- `fiscal-client.ts` — HTTP da Brasil NFe, headers `UserToken` + `Token`
- `fiscal-payload.ts` — pedido Medusa + perfil fiscal → payload da NF-e de venda
- `fiscal-payload-devolucao.ts` — payload da NFD com `DFeReferenciado` item a item
- `fiscal-perfil.ts` — resolução produto → categoria → padrão
- `fiscal-xml.ts` — parse de `<det nItem>` do XML autorizado
- `fiscal-emissao.ts` — orquestração (idempotência, gravação, transmissão)
- `fiscal-reconciliar.ts` — download do XML, verificação, `verificado_em`

**Testes:** unitários em `src/lib/fiscal/__tests__/*.unit.spec.ts` (rodam com `TEST_TYPE=unit`, conforme `jest.config.js`); integração em `integration-tests/http/fiscal-*.spec.ts` (`TEST_TYPE=integration:http`).
- rotas admin: `/admin/fiscal/config`, `/admin/fiscal/perfis`, `/admin/fiscal/documentos`, `/admin/fiscal/emitir`, `/admin/fiscal/reconciliar`
- webhook: `/webhooks/brasilnfe` — mesmo padrão de `/webhooks/whatsapp`, no domínio público do Railway

**Cockpit:** aba **Fiscal** (configuração do emitente, perfis tributários, fila de exceções) · status da nota no detalhe do pedido · botão "Emitir NF-e" no fluxo de despacho · botão "Emitir NFD".

**Vitrine:** nenhuma mudança.

## 11. Riscos abertos

1. **IBS/CBS da Reforma Tributária.** 2026 é ano de transição e a NT 2025.002-RTC define início de rejeições por falta de IBS/CBS. Confirmar com a Brasil NFe **e** com o contador se a NF-e da ÉCLAT precisa carregar esses grupos já em 2026, e se o SDK os expõe. **Confirmar antes da primeira emissão em produção.**
2. **Data divergente na resposta do fornecedor.** A Brasil NFe informou ter implantado a NT 2025.002-RTC v1.40 em 16/09/2025, mas a v1.40 só foi publicada em 20/05/2026. A frase seguinte deles ("em 23/07/2026 teve melhoria no JSON de envio pra ir nos itens da nota") é o que de fato corresponde à v1.40, e está dentro do prazo. **Obter confirmação por escrito** do suporte à VC02-14, VC02-40, VC02-50 e VC03-20 em produção.
3. **ICMS-ST em vestuário em MG.** Decide entre CSOSN 102 e 500. Pergunta pro contador, não pro sistema.
4. **Homologação ≠ produção.** O próprio fornecedor avisou que a SEFAZ às vezes mantém validações só em homologação. Uma rejeição em homologação pode ser falso positivo — verificar caso a caso.
5. ~~**Inscrição Estadual.**~~ **✅ RESOLVIDO** pelo CCC/SVRS em 25/08/2026: IE **56295050042**, situação **Habilitado**, tipo **IE Normal**, CNPJ sem restrição. A ÉCLAT está apta a emitir NF-e de mercadoria em MG.

6. **⚠️ CNAE principal é serviço, não comércio** — rebaixado de bloqueante para questão contábil. O principal é 73.19-0-02 (Promoção de vendas); os CNAEs de comércio (47.81-4-00 vestuário, 47.55-5-01 tecidos) são secundários.
   - **Não bloqueia a emissão:** a SEFAZ/MG concedeu **IE Normal** com esse CNAE principal. A hipótese de que o CNAE travaria a IE foi refutada pelo CCC.
   - **Segue valendo para o Simples Nacional:** o anexo é definido pela atividade que **gera a receita**, não só pelo CNAE principal. Receita de venda de roupa é **Anexo I** (começa em 4%), não Anexo III (6%). O contador precisa **segregar a receita corretamente no PGDAS**. Se estiver tudo indo como serviço, são ~2 pontos percentuais de imposto a mais sobre o faturamento, todo mês.
   - Avaliar com o contador se vale inverter principal e secundário no CNPJ — por higiene cadastral, não por urgência fiscal.

7. **Endereço do emitente = origem da mercadoria?** A nota sai de R Norte, 180 — Angola, Betim/MG. Se o estoque físico fica em outro endereço, há divergência fiscal entre emitente e local de saída. Confirmar onde as peças efetivamente ficam.

8. ~~**Opção pelo Simples Nacional.**~~ **✅ RESOLVIDO** pelo CCC/SVRS: regime de tributação registrado na SEFAZ é **Simples Nacional**. `crt = 1` confirmado, não presumido. O CCC também informa **crédito presumido: Não** — insumo para o contador decidir entre CSOSN 101 e 102 (ver risco 3).

9. **Risco de fornecedor.** Brasil NFe existe desde 2019; a Nuvem Fiscal foi descontinuada em 31/07/2026. Mitigação: o `payload_enviado` e o XML ficam no **nosso** banco/storage, não só no deles. Troca de fornecedor não perde histórico.

## 12. Critério de aceite

1. Configuração do emitente salva no Cockpit e certificado A1 validado pela Brasil NFe.
2. Perfil fiscal padrão + NCM cadastrado em ao menos um produto real.
3. Em **homologação**: pedido de teste → pré-visualização exibe XML com NCM, CFOP e CSOSN corretos.
4. Em homologação: transmissão autorizada; `fiscal_documento` com chave de acesso; XML e DANFE baixáveis.
5. Reconciliação grava `n_item_verificado` para todos os itens e marca `verificado_em`.
6. Tentar emitir NFD contra documento **não verificado** é **recusado** com mensagem clara.
7. Em homologação: NFD parcial (1 de 2 itens) autorizada, com `DFeReferenciado` carregando chave + `nItem` do item certo.
8. Retransmitir o mesmo pedido **não** cria segunda nota (idempotência).
9. Produto sem NCM **bloqueia** a emissão com erro apontando o produto.
10. Testes verdes: parser de `<det nItem>` contra XML fixture (sem rede); resolução de perfil (produto → categoria → padrão); trava da NFD.
11. Virada para **produção** só depois de resolvidos os riscos **1 (IBS/CBS)**, **2 (confirmação por escrito do fornecedor)** e **3 (tabela tributária do contador)** do §11.

**Pré-condição de início: ATENDIDA.** Os dois bloqueantes anteriores caíram com o CCC/SVRS de 25/08/2026 — IE 56295050042 habilitada e Simples Nacional confirmado. **A implementação está liberada para começar.**

O risco 3 (tabela do contador: CSOSN, CFOPs, ICMS-ST em vestuário em MG) é o **caminho crítico** restante: o código fica pronto sem ele, mas não emite nada.

## 13. Fontes

- Brasil NFe — documentação da API, seções NF-e/NFC-e, Consultas, Empresas: https://www.brasilnfe.com.br/docs
- NT 2025.002-RTC v1.40 (publicada 20/05/2026) — referenciamento de devolução no grupo `DFeReferenciado`, regras VC02-14, VC02-40, VC02-50, VC03-20. Homologação 01/07/2026, produção 01/09/2026.
- Ajuste SINIEF nº 8/2026 — regras de devolução e recusa.
- Respostas do suporte da Brasil NFe ao questionário de avaliação, 2026-09-16.
