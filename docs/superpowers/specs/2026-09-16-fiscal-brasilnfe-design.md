# Integração Fiscal — Brasil NFe (Projeto A)

Data: 2026-09-16 · **Revisão 2: 2026-09-17** (contrato real da Brasil NFe — ver §14) · Status: revisão 1 implementada em `main` com emissão desligada; revisão 2 aguardando implementação · Pré-requisito de: Projeto B (Reversa), Projeto C (Carteira/vale-compra), Projeto D (Troca por produto qualquer).

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
9. **(Rev. 2) Endpoint síncrono `EnviarNotaFiscal`**, não o lote: o despacho precisa da DANFE na hora. Consequência: o webhook deixa de ser gatilho da reconciliação (§7.3, §7.4).
10. **(Rev. 2) Numeração gerenciada pela Brasil NFe.** Não enviamos `Serie`/`Numero`/`Lote`; a série 1 é configurada no painel deles. Consequência: a barreira contra nota duplicada é **só nossa** (§7.2).
11. **(Rev. 2) O emitente vem do cadastro no painel da Brasil NFe**, não do payload. `fiscal_config` continua guardando os dados do emitente como referência de conferência e para decidir dentro/fora da UF.
12. **(Rev. 2) Cliente HTTP próprio, não o SDK.** O SDK oficial é a fonte do contrato (tipos), mas não entra como dependência: precisamos de controle sobre timeout, redação de segredo em erro e classificação 4xx/5xx — e o SDK embrulha tudo num `Error` genérico.

## 3. Escopo

**Entra:** módulo `fiscal` no backend (schema, cliente da API, montagem de payload, transmissão, reconciliação de XML, rotas admin); tabelas no Supabase; aba Fiscal no Cockpit (configuração, fila de exceções); status da nota no detalhe do pedido; botão "Emitir NF-e" no fluxo de despacho; botão manual "Emitir NFD"; testes de integração e de unidade.

**Não entra:** emissão automática de NFD (Projeto B); NFC-e (não há loja física); NFS-e (não há serviço); SPED/SINTEGRA (o contador gera a partir dos XMLs); carta de correção e cancelamento pela UI (fase seguinte — no Projeto A, cancelamento é feito pelo painel da Brasil NFe); conciliação fiscal no DRE.

## 4. Fronteira de responsabilidade — o que é nosso e o que é do contador

Esta seção existe para evitar que o sistema finja saber tributação.

| Responsabilidade | De quem |
|---|---|
| Estrutura do documento, transmissão, guarda do XML, `nItem`, idempotência, tratamento de erro | **Nosso (código)** |
| NCM de cada produto | **Contador**, cadastrado no Cockpit |
| CSOSN aplicável, CFOP por destino, CST de PIS/COFINS, CEST (se houver ST), se há ICMS-ST em vestuário em MG | **Contador**, cadastrado em `fiscal_perfil` |
| Natureza da operação de devolução ao consumidor PF | **Contador** |
| Campos de IBS/CBS da Reforma Tributária (ver §11, risco aberto) | **Contador + Brasil NFe** |

O sistema **nunca infere** um valor tributário. Se falta perfil fiscal para um produto, a emissão **falha e vai pra fila** — não chuta um padrão.

## 5. Onde mora cada dado

| Dado | Onde | Justificativa |
|---|---|---|
| **NCM** | `variant.hs_code` (campo nativo do Medusa) | NCM é a extensão brasileira do HS code. Atributo de produto = comércio (Invariante 2) |
| **Origem da mercadoria** (0–8) | `variant.origin_country` (nativo) (BR → 0; demais → `origem_padrao` do perfil) | idem |
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
| `serie_nfe` | int | começa em 1. **(Rev. 2)** não é enviado à API — registra a série esperada; a série real de cada nota volta na resposta |
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
| `cst_pis_cofins` | text nullable, 2 dígitos | **(Rev. 2, migration 0012)** CST espelhado de PIS e COFINS. Nulo = bloco não enviado |
| `cest` | text nullable, 7 dígitos | **(Rev. 2, migration 0012)** obrigatório quando há ICMS-ST (rejeição 806) |
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
| `idempotency_key` | text, **unique** | `{medusa_order_id}:{tipo}:{ambiente}`, com sufixo `:rN` em nova tentativa e digest dos itens na NFD. **(Rev. 2)** vai como `IdentificadorInterno` no payload — é por ela que o fornecedor é consultado |
| `payload_enviado` | jsonb | gravado **antes** da transmissão |
| `resposta_bruta` | jsonb nullable | |
| `rejeicao_codigo`, `rejeicao_motivo` | text nullable | |
| `xml_url`, `danfe_url` | text nullable | **(Rev. 2)** sem uso — a API não devolve URL |
| `xml_autorizado` | text nullable | **(Rev. 2, migration 0012)** o XML autorizado, decodificado do `Base64Xml` da resposta |
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

> **Revisão 2 (2026-09-17).** Esta seção foi reescrita contra o contrato real da Brasil NFe (documentação pública + tipos do SDK oficial `brasilnfe@3.1.3`). A versão anterior assumia nomes de campo, endpoints e formato de resposta que nunca tinham sido confrontados com a documentação. O registro do que mudou e por quê está no §14.

Disparado no botão "Despachar" do Cockpit (Fase 4), **antes** de gerar o fulfillment.

### 7.0 O contrato da API (fonte: documentação + SDK oficial)

| Item | Valor |
|---|---|
| Base | `https://api.brasilnfe.com.br/services/fiscal/` |
| Headers | `Token` (empresa) + `UserToken` (usuário) + `Content-Type: application/json` |
| Transmitir | `POST EnviarNotaFiscal` — **síncrono**: a resposta já traz protocolo, XML e DANFE. **Não dispara webhook** |
| Pré-visualizar | `POST PreVisualizarNotaFiscal` — corpo `{ notaFiscal: { TipoAmbiente, ModeloDocumento, nFInfos: [nota] }, TipoArquivo: 0, TipoEnvio: 1 }` → `{ Status, Base64File }` |
| Localizar por identificador | `POST ObterNotasFiscais` — `{ TipoAmbiente, TipoDocumentoFiscal: 1, DtInicio, DtFim, IdentificadorInterno }` → `Notas[]` com `Chave`, `Status` (1 autorizado, 2 cancelado, 3 denegado) |
| Baixar XML / DANFE | `POST ObterArquivoNotaFiscal` — `{ ChaveNF, FileType: 1 (XML) \| 2 (DANFE), TipoDocumentoFiscal: 1 }` → binário |
| Em lote (não usamos) | `POST EnviarNotaFiscalLote` — assíncrono, resultado via webhook `nfe.lote.finalizado` |

**Resposta de `EnviarNotaFiscal`:**

```
{
  ReturnNF: { Numero, Serie, ChaveNF, NumeroProtocolo, CodTipoAmbiente,
              CodStatusRespostaSefaz, DsStatusRespostaSefaz, Ok },
  Base64Xml,   // o XML autorizado
  Base64File,  // a DANFE em PDF
  Error, Avisos
}
```

**Por que o endpoint síncrono e não o lote:** o despacho precisa da DANFE **na hora**, para ir dentro da caixa (§2, decisão 6). O lote devolveria só um recibo. O custo: a chamada pode levar minutos quando a SEFAZ está lenta (o SDK oficial usa timeout de **5 minutos**) — o cliente HTTP adota o mesmo teto, e o estouro cai no estado `transmitido_sem_confirmacao` (§9).

### 7.1 Montar e pré-visualizar

1. Lê o pedido no Medusa (fonte da verdade do comércio).
2. Para cada linha: resolve NCM (`variant.hs_code`), origem (`variant.origin_country`) e perfil fiscal (produto → categoria → padrão).
3. **Se faltar NCM ou perfil, aborta** com erro legível apontando o produto. Não chuta.
4. Escolhe CFOP pela UF do endereço de entrega: MG → `cfop_dentro_uf`; demais → `cfop_fora_uf`.
5. Monta o payload no formato do §7.1.1.
6. Chama a **pré-visualização** — gera o XML sem transmitir à SEFAZ e **sem consumir numeração**.

#### 7.1.1 Mapa do payload de venda

Raiz:

| Campo da API | Valor | Observação |
|---|---|---|
| `ModeloDocumento` | `55` | |
| `Finalidade` | `1` | normal |
| `TipoAmbiente` | `1` produção · `2` homologação | de `fiscal_config.ambiente`. Enviado **sempre**, mesmo sendo opcional: se o cadastro no painel deles divergir do nosso, a resposta (`CodTipoAmbiente`) denuncia — ver §7.2 |
| `NaturezaOperacao` | `"VENDA DE MERCADORIA"` | |
| `ConsumidorFinal` | `true` | booleano, não 0/1 |
| `IndicadorPresenca` | `2` | não presencial, pela Internet |
| `CalcularIBPT` | `true` | Lei 12.741/2012: a nota ao consumidor exibe o total aproximado de tributos. A API calcula pelo NCM. É informativo — não altera o valor da nota |
| `IdentificadorInterno` | a `idempotency_key` do documento | é por ele que uma transmissão sem resposta é localizada depois (§9) |
| `EnviarEmail` | `false` | a comunicação com a cliente é nossa (WhatsApp), não do fornecedor |
| `Serie`, `Numero`, `Lote` | **omitidos** | omitidos os três, a API gerencia a numeração por empresa + modelo + série + ambiente. Série e número reais voltam em `ReturnNF` |
| `Intermediador` | **omitido** | a ÉCLAT vende em site próprio. Enviar este grupo em venda direta é **rejeição 435**. O JSON de exemplo do fornecedor o inclui — não copiar |
| emitente | **não existe no contrato** | vem do cadastro da empresa no painel da Brasil NFe, amarrado ao `Token` |
| totais da nota | **não enviados** | `vProd`, `vNF` são calculados pela API a partir dos itens |

`Cliente`:

| Campo | Valor |
|---|---|
| `CpfCnpj` | CPF, 11 dígitos |
| `NmCliente` | nome |
| `IndicadorIe` | `9` (não contribuinte) |
| `Endereco` | `Cep`, `Logradouro`, `Numero`, `Complemento`, `Bairro`, `CodMunicipio` (o IBGE de 7 dígitos coletado no checkout), `Municipio`, `Uf`, `CodPais: 1058`, `Pais: "BRASIL"` |

`Produtos[]` — **a posição no array é o `nItem`**. Não existe campo para informá-lo (`NItemPed` é o item do *pedido de compra*, outra coisa).

| Campo | Valor |
|---|---|
| `NmProduto` | título |
| `CodProdutoServico` | SKU, ou o `line_item_id` na falta — é o `codigo_enviado` que casa o XML na reconciliação |
| `NCM` | `variant.hs_code` |
| `CEST` | `fiscal_perfil.cest`, só quando preenchido |
| `CFOP` | do perfil, **numérico** |
| `UnidadeComercial` / `UnidadeComercialTributavel` | `"UN"` |
| `Quantidade` / `QuantidadeTributavel` | quantidade |
| `ValorUnitario` / `ValorUnitarioTributavel` | unitário **bruto**, em reais |
| `ValorTotal` | bruto da linha (unitário × quantidade) |
| `ValorDesconto` | desconto da linha — nunca escondido no unitário |
| `ValorFrete` | a parte do frete **rateada** para esta linha (ver abaixo) |
| `OrigemProduto` | da variante, ou `origem_padrao` do perfil |
| `Imposto.ICMS.CodSituacaoTributaria` | o CSOSN do perfil. A API escolhe o bloco CSOSN sozinha, pelo CRT da empresa |
| `Imposto.PIS` / `Imposto.COFINS` | `{ CodSituacaoTributaria }` com `fiscal_perfil.cst_pis_cofins`, só quando preenchido (os CSTs são espelhados) |
| `Imposto.IBSCBS` | **não enviado** enquanto o risco 1 do §11 estiver aberto |

**Rateio do frete.** No XML da NF-e o frete é por item; não existe frete "da nota". O frete do pedido é rateado entre as linhas em proporção ao valor líquido de cada uma, em **centavos inteiros, pelo método do maior resto** — a soma das partes é exatamente o frete. Função pura, testada.

**Dinheiro.** Centavos inteiros até a fronteira (Invariante 3). A API espera **número JSON em reais**; a conversão é `Number(reais(centavos))`, onde `reais()` monta a string decimal com aritmética inteira. Um único ponto de conversão, no último instante.

**CSOSN suportados.** `102`, `103`, `300`, `400`, `500`. Os demais (`101`, `201`, `202`, `203`, `900`) exigem campos que este sistema **não envia** (alíquota de crédito, MVA, base de ST). Se o perfil trouxer um deles, a montagem **falha com erro legível** — não emite nota incompleta. Se o contador indicar um desses, é trabalho novo (§11, risco 3).

`Pagamentos[]` — um item: `{ IndicadorPagamento: 0, FormaPagamento, VlPago }`, com `VlPago` = total da nota. `FormaPagamento` vem de um mapa puro a partir do provedor de pagamento do pedido. Hoje o único provedor é o manual, então o mapa devolve `"99"` com `Descricao: "Pagamento online"` (o `99` sem descrição é **rejeição 441**). Quando o gateway real entrar, o mapa ganha `17` (Pix) e `03` (cartão de crédito) — é o único ponto a mudar.

`Transporte`: `{ ModalidadeFrete: 0 }` — frete contratado pelo remetente. **Enviado de propósito:** omitido, a API materializa `9` ("sem ocorrência de transporte"), que é falso para uma loja que despacha pelos Correios. Um default silencioso e errado é pior que um campo faltando.

### 7.2 Transmitir

7. Grava `fiscal_documento` (status `montado`) + `fiscal_documento_item` com `ordem_enviada` e `codigo_enviado`, **e o `payload_enviado`**, tudo antes de chamar a API.
8. **Barreira contra duplicidade.** Com numeração automática, a SEFAZ **não** protege contra emitir duas vezes: cada tentativa ganha número novo e as duas notas são válidas. A proteção é só nossa:
   - documento já resolvido para o pedido → devolve o existente, não reemite;
   - `transmitido_sem_confirmacao` pendente → recusa, manda resolver antes;
   - **antes de qualquer nova tentativa** (já existe documento `rejeitado` ou `montado` órfão), consulta `ObterNotasFiscais` pelo `IdentificadorInterno` de cada tentativa anterior. Se o fornecedor tem nota autorizada para alguma delas, **adota a nota existente** em vez de emitir outra.
9. Transmite. Interpretação da resposta — nenhuma combinação é adivinhada:

| Resposta | Status gravado |
|---|---|
| `ReturnNF.Ok === true` **e** `CodStatusRespostaSefaz` ∈ {100, 150} | autorizado → segue para §7.3 |
| `CodStatusRespostaSefaz` ∈ {110, 301, 302, 303} | `denegado` |
| `ReturnNF` presente, `Ok === false`, outro código | `rejeitado`, com código e `DsStatusRespostaSefaz` |
| sem `ReturnNF`, com `Error` | `rejeitado`, motivo = `Error` (validação do fornecedor, não chegou à SEFAZ) |
| `Ok` e código **incoerentes** entre si, resposta sem `ReturnNF` e sem `Error`, timeout, falha de rede, 5xx | `transmitido_sem_confirmacao` |
| `ReturnNF.CodTipoAmbiente` ≠ ambiente configurado | grava o resultado normalmente **e** registra alerta crítico no log e em `rejeicao_motivo`: o cadastro no painel diverge do nosso |

10. Do autorizado, grava: `chave_acesso` (`ChaveNF`), `numero`, `serie`, `xml_autorizado` (o `Base64Xml` decodificado). O `Base64File` (DANFE) **não** é persistido — é reobtido sob demanda (§10). A `resposta_bruta` guarda a resposta **sem** os dois campos base64.

### 7.3 Reconciliar — agora na própria emissão

A Brasil NFe **não retorna o `nItem`**; ela o gera pela ordem em que enviamos os itens. Isso continua sendo um **contrato posicional implícito**, e contrato implícito quebra em silêncio. A defesa continua a mesma — **a verdade vem do XML autorizado pela SEFAZ** —, mas o caminho ficou mais curto: a resposta síncrona **já traz o XML**.

11. Logo após gravar a autorização, no mesmo fluxo: faz parse de cada `<det nItem="N">` do `xml_autorizado`, casa por `codigo_enviado` (nunca por NCM nem por posição), grava `n_item_verificado` e marca `verificado_em`. O documento vai de `autorizado_nao_verificado` a `verificado` em segundos, sem segunda chamada.
12. Confere que a chave dentro do XML é a `chave_acesso` gravada. Se não for, **não reconcilia**.
13. Divergência entre `ordem_enviada` e `nItem` **não é fatal** — grava o valor da SEFAZ e registra alerta.
14. **Falha na reconciliação não desfaz a emissão.** A nota está autorizada; o documento permanece `autorizado_nao_verificado`, o erro vai para o log e a fila do Cockpit mostra. O despacho segue.

**Rede de segurança — varredura periódica.** Mantida, com papel novo. Antes ela cobria webhook perdido; agora cobre os dois casos que a emissão síncrona não fecha sozinha:

- `transmitido_sem_confirmacao` → consulta `ObterNotasFiscais` pelo `IdentificadorInterno`. Achou autorizada: grava a chave, baixa o XML por `ObterArquivoNotaFiscal`, reconcilia. **Não achou: não conclui nada** — o documento continua pendente para resolução manual em Fiscal → Fila (rota `resolver`). A varredura nunca declara sozinha que uma nota "não foi emitida".
- `autorizado_nao_verificado` sem `xml_autorizado`, ou com reconciliação que falhou → baixa o XML e tenta de novo.

**Trava de segurança (inalterada):** só um `fiscal_documento` com `verificado_em` preenchido pode ser referenciado numa NFD.

### 7.4 Webhook — muda de função

`EnviarNotaFiscal` **não dispara webhook**; logo, a rota `/webhooks/brasilnfe` deixa de ser gatilho da reconciliação de vendas. Ela é mantida porque o painel deles tem o botão "Testar" e porque os eventos de **nota de entrada** (`documento.entrada.recebida`) avisam quando um fornecedor emite contra o CNPJ da ÉCLAT — visibilidade gratuita.

- **Autenticação:** HMAC-SHA256 do **corpo bruto** com `BRASILNFE_WEBHOOK_SECRET`, comparado em tempo constante ao header `X-Webhook-Signature: sha256=<hex>`. O corpo bruto é preservado por configuração da rota (`bodyParser.preserveRawBody`) — reserializar o JSON quebra a assinatura, e a documentação deles avisa disso.
- **Envelope:** `{ event, deliveryId, timestamp, data }`.
- `test.ping` → 200.
- `nfe.lote.finalizado` → para cada `data.notas[].chaveAcesso` que seja documento nosso e não terminal, reconcilia. (Não usamos lote hoje; custa poucas linhas e evita uma rota que ignora o evento principal do fornecedor.)
- `documento.entrada.*` → registra no log (emissor, valor, chave). Sem tabela nova — guardar notas de entrada é outro projeto.
- Assinatura inválida → **401**, sem efeito nenhum. (Antes respondíamos 200 para tudo; com HMAC, recusar é o correto — quem assina errado não é o fornecedor.)
- Continua valendo: o webhook **nunca** carrega o dado fiscal em si. A verdade vem do XML.

## 8. Fluxo da NFD (capacidade, acionada manualmente no Projeto A)

NF-e de **entrada**, `Finalidade: 4`. O `tpNF` não é enviado: a API o deriva do primeiro dígito do CFOP (1/2 → entrada).

1. Exige um `fiscal_documento` de venda **verificado**. Sem isso, recusa.
2. Cada item devolvido leva **`ChaveAcessoReferenciada`** (chave da nota de venda) e **`NItemReferenciado`** (o `n_item_verificado` daquele item). São campos **do produto**; a API monta com eles o grupo `DFeReferenciado` por item.
3. **`NFReferencia` (raiz) nunca é enviado** — é o `refNFe` genérico que a VC02-14 proíbe, e a API documenta que os dois não podem coexistir.
4. Regras atendidas: **VC02-14** (referência item a item), **VC03-20** (`nItem` obrigatório), **VC02-40** (uma só nota referenciada), **VC02-50**.
5. Devolução **parcial** é o caso normal: referencia só os itens devolvidos. Desconto estornado em proporção à quantidade devolvida (regra pendente de confirmação do contador, isolada numa fórmula).
6. `Pagamentos`: um item com `FormaPagamento: "90"` (sem pagamento). `Transporte.ModalidadeFrete: 9`. `ConsumidorFinal: false`. `IndicadorPresenca: 0`.
7. Pré-visualiza antes de transmitir — o erro fiscal vira erro de teste.
8. Transmissão, interpretação da resposta e reconciliação: idênticas à venda (§7.2, §7.3).

**Quem é o `Cliente` da NFD** — ver §11, risco 10. Até ser resolvido em homologação, o código mantém a decisão da revisão 1: a própria ÉCLAT (`CpfCnpj` = CNPJ, `IndicadorIe: 1`, `Ie`).

## 9. Estados e tratamento de erro

Nenhuma falha é silenciosa. Toda transição grava motivo legível.

| Status | Significado | Ação |
|---|---|---|
| `montado` | payload gravado, ainda não transmitido | |
| `transmitido_sem_confirmacao` | a chamada saiu e não sabemos o resultado (timeout, rede, 5xx, resposta incoerente) | varredura localiza pelo `IdentificadorInterno`; se não achar, resolução manual. **Nunca reemite às cegas** |
| `autorizado_nao_verificado` | SEFAZ autorizou, `nItem` ainda não confirmado | normalmente dura segundos (§7.3); **bloqueia NFD** enquanto durar |
| `verificado` | XML lido, `n_item_verificado` gravado | libera NFD |
| `rejeitado` | a SEFAZ ou a validação do fornecedor recusou | fila no Cockpit com código + motivo; nova tentativa passa pela barreira do §7.2 item 8 |
| `denegado` | irregularidade cadastral do emitente/destinatário | fila no Cockpit; não se resolve por retry |

`em_contingencia` saiu da tabela: a emissão em contingência é decisão e operação da Brasil NFe, invisível para nós — a resposta chega como autorizada ou não.

**Por que idempotência não é preciosismo aqui:** nota fiscal duplicada não é um registro a mais no banco — é obrigação fiscal em duplicidade, que exige cancelamento formal em até 24h. E com numeração automática do fornecedor, **ninguém além de nós** impede a duplicata.

## 10. Código e telas

**Backend:** `apps/backend/src/lib/fiscal/` — padrão do **Clube Éclat** (`lib/clube-*.ts`): libs em `src/lib/`, dados no Supabase via PostgREST com `service_role`. `src/modules/` é reservado a módulos Medusa.

- `fiscal-db.ts` — acesso às tabelas no Supabase
- `fiscal-client.ts` — HTTP da Brasil NFe: `transmitir`, `previsualizar`, `localizarPorIdentificador`, `baixarArquivo`; interpretação da resposta (§7.2 item 9)
- `fiscal-dinheiro.ts` — `reais()`, `numeroReais()`, `ratearFrete()` — funções puras compartilhadas pelos dois payloads
- `fiscal-payload.ts` — pedido Medusa + perfil fiscal → payload de venda (§7.1.1)
- `fiscal-payload-devolucao.ts` — payload da NFD com `ChaveAcessoReferenciada` + `NItemReferenciado` por item
- `fiscal-pagamento.ts` — mapa provedor de pagamento → `FormaPagamento`
- `fiscal-perfil.ts` — resolução produto → categoria → padrão
- `fiscal-xml.ts` — parse de `<det nItem>` do XML autorizado
- `fiscal-emissao.ts` — orquestração (barreira de duplicidade, gravação, transmissão, reconciliação inline)
- `fiscal-reconciliar.ts` — reconciliação a partir de XML em mãos ou baixado; varredura
- `fiscal-webhook.ts` — verificação HMAC (função pura)

**Rotas admin:** `/admin/fiscal/config`, `/perfis`, `/documentos`, `/emitir`, `/reconciliar`, `/resolver`, `/emitir-devolucao`, e a nova **`/documentos/:id/danfe`** — baixa a DANFE em PDF do fornecedor sob demanda (`ObterArquivoNotaFiscal`, `FileType: 2`). A DANFE não é guardada: o documento legal é o XML, que fica conosco.

**Webhook:** `/webhooks/brasilnfe` (§7.4), com `preserveRawBody` configurado em `src/api/middlewares.ts`.

**Migration `0012_fiscal_contrato.sql`:**
- `fiscal_documento.xml_autorizado text` — o XML é o documento fiscal com guarda obrigatória; merece coluna própria, não um campo enterrado num jsonb.
- `fiscal_perfil.cst_pis_cofins text` (2 dígitos, nullable) e `fiscal_perfil.cest text` (7 dígitos, nullable).
- `xml_url` e `danfe_url` permanecem no schema, sem uso (a API não devolve URL). Removê-las é faxina futura, não vale uma migration destrutiva agora.

**Cockpit:** aba **Fiscal** ganha os campos `CST PIS/COFINS` e `CEST` no perfil tributário; o detalhe do pedido troca o link `danfe_url` pelo botão **"Baixar DANFE"** (rota nova). O proxy `/api/fiscal/*` continua com allowlist.

**Testes:** unitários em `src/lib/fiscal/__tests__/*.unit.spec.ts`. As fixtures de resposta passam a ter o **formato real** (`ReturnNF`, `Base64Xml`) — a revisão 1 testava contra um formato inventado, e por isso 151 testes verdes não pegaram que nenhuma nota autorizada seria reconhecida.

**Vitrine:** nenhuma mudança.

## 11. Riscos abertos

1. **IBS/CBS da Reforma Tributária.** O grupo existe no contrato: `Imposto.IBSCBS`, com `CodClassificacaoTributaria` (o SDK documenta "Padrão 000001"), alíquotas de IBS UF/municipal e CBS. **Não enviamos.** Verificar na pré-visualização em homologação se a API gera o grupo sozinha; confirmar com o contador a classificação tributária, ou que o grupo fica fora em 2026. **Resolver antes da primeira emissão em produção.**
2. ~~**Confirmação por escrito do fornecedor.**~~ **✅ RESOLVIDO em 2026-09-17:** a Brasil NFe respondeu por escrito e a documentação pública + SDK confirmam `ChaveAcessoReferenciada` / `NItemReferenciado` por item, com referência explícita à NT 2025.002. Resta provar em homologação (critério de aceite 7).
3. **ICMS-ST em vestuário em MG.** Decide o CSOSN. Se houver ST: **CEST** por produto (7 dígitos; sem ele, rejeição 806) — coberto por `fiscal_perfil.cest`. Se o CSOSN for `201`/`202`/`203`/`900`, entram **MVA por UF de destino** e base de ST, que este projeto **não cobre** — vendendo para o Brasil todo seria uma tabela UF × NCM, projeto próprio.
4. **Homologação ≠ produção.** A SEFAZ às vezes mantém validações só em homologação. Verificar caso a caso.
5. ~~**Inscrição Estadual.**~~ **✅ RESOLVIDO** pelo CCC/SVRS em 25/08/2026.
6. **⚠️ CNAE principal é serviço, não comércio** — questão contábil, não bloqueia emissão. Receita de venda de roupa é **Anexo I**, não Anexo III; o contador precisa segregar no PGDAS. ~2 pontos percentuais sobre o faturamento.
7. **Endereço do emitente = origem da mercadoria?** Agora o endereço do emitente vem do **cadastro no painel da Brasil NFe**, não do nosso payload. Conferir que o cadastro lá bate com `fiscal_config` (R Norte, 180 — Betim/MG) e com o local real do estoque.
8. ~~**Opção pelo Simples Nacional.**~~ **✅ RESOLVIDO** pelo CCC/SVRS. Consequências confirmadas pela documentação do fornecedor: **sem DIFAL** (só calculado para CRT 3) e PIS/COFINS zerados no XML (recolhidos no DAS; CST usual 99 — confirmar com o contador).
9. **Risco de fornecedor.** Mitigação reforçada: o XML autorizado fica em coluna própria no **nosso** banco. A alternativa `CodTributacao` (grupo tributário cadastrado no painel deles, que preenche CFOP/CST sozinho) foi **avaliada e recusada**: moveria a regra tributária para dentro do fornecedor, contra o Invariante 2 e contra esta mitigação.
10. **Quem é o `Cliente` na NFD de entrada.** A revisão 1 decidiu que a destinatária é a própria ÉCLAT (leitura da VC02-50). Com o contrato real, `Cliente` é a única contraparte do payload, e a prática de mercado em devolução de pessoa física é informar **a consumidora** como remetente/destinatária da nota de entrada. Não há como decidir por leitura: **a pré-visualização e a transmissão em homologação decidem** (a SEFAZ de homologação valida a VC02-50), junto com a pergunta 4 já enviada ao contador. A NFD só é automatizada no Projeto B; até lá isto não bloqueia a venda.
11. **`ObterNotasFiscais` enxerga a NFD?** O filtro por `IdentificadorInterno` é documentado como "somente saídas". A NFD é emissão própria com CFOP de entrada. Se a consulta não a enxergar, uma NFD em `transmitido_sem_confirmacao` só se resolve manualmente. Verificar em homologação.
12. **`FormaPagamento: "99"` em todas as notas** enquanto o provedor de pagamento for o manual. É válido, mas pobre. Some quando o gateway real entrar e o mapa do §7.1.1 ganhar Pix e cartão.
13. **Origem da mercadoria: o sistema só afirma `0` quando a variante é BR; para qualquer outro país usa `origem_padrao` do perfil — a classificação 1/2/3/5/6/7/8 é do contador (pergunta 5 já enviada).**

## 12. Critério de aceite

1. Empresa cadastrada no painel da Brasil NFe com os dados do §6.0, certificado A1 validado, numeração automática na série 1.
2. Perfil fiscal padrão + NCM cadastrado em ao menos um produto real.
3. Em **homologação**: pedido de teste → pré-visualização devolve XML com NCM, CFOP, CSOSN, frete rateado e `indIntermed` ausente/0.
4. Em homologação: transmissão autorizada; `fiscal_documento` com `chave_acesso`, `numero`, `serie` e `xml_autorizado` preenchidos; DANFE baixável pelo Cockpit.
5. O documento chega a `verificado` **na própria emissão**, sem varredura: `n_item_verificado` gravado para todos os itens.
6. Tentar emitir NFD contra documento **não verificado** é **recusado** com mensagem clara.
7. Em homologação: NFD parcial (1 de 2 itens) autorizada, com `ChaveAcessoReferenciada` + `NItemReferenciado` do item certo — e o risco 10 decidido pelo resultado.
8. Retransmitir o mesmo pedido **não** cria segunda nota — inclusive no caso "tentativa anterior rejeitada aqui, mas autorizada lá": a barreira do §7.2 adota a nota existente.
9. Produto sem NCM **bloqueia** a emissão com erro apontando o produto. Perfil com CSOSN não suportado também.
10. Webhook: `test.ping` assinado responde 200; o mesmo corpo com assinatura errada responde 401; corpo alterado em 1 byte responde 401.
11. Testes verdes, com fixtures no **formato real** da API: interpretação da resposta (cada linha da tabela do §7.2), rateio de frete (soma exata), HMAC, barreira de duplicidade, parser de `<det nItem>`.
12. Virada para **produção** só depois de resolvidos os riscos **1 (IBS/CBS)** e **3 (tabela tributária do contador)** do §11.

O risco 3 (tabela do contador) segue sendo o **caminho crítico**: o código fica pronto sem ele, mas não emite nada.

## 13. Fontes

- Brasil NFe — documentação pública: https://www.brasilnfe.com.br/docs · índice para máquina: `/llms.txt` e `/llms-full.txt` · webhooks: `/webhooks` · conceitos fiscais: `/conceitos-fiscais/*` (defaults automáticos, numeração e séries, CSOSN vs CST, PIS/COFINS, ICMS-ST e CEST, CFOP e derivações).
- SDK oficial Node.js `brasilnfe@3.1.3` (npm) — tipos `NotaFiscalEnvio`, `NotaFiscalRetorno`, `PreVisualizarNotaFiscalEnvio`, `BuscarNotaFiscalEnvio`, `PegarArquivoEnvio`. **Usado como fonte do contrato, não como dependência:** o cliente HTTP continua nosso (controle de timeout, redação de segredo, classificação de erro).
- Resposta escrita do suporte da Brasil NFe sobre webhook e modelo de JSON, 2026-09-17.
- NT 2025.002-RTC v1.40 (publicada 20/05/2026) — regras VC02-14, VC02-40, VC02-50, VC03-20. Produção 01/09/2026.
- Ajuste SINIEF nº 8/2026 — regras de devolução e recusa.
- Respostas do suporte da Brasil NFe ao questionário de avaliação, 2026-09-16.

## 14. Registro da revisão 2 (2026-09-17)

A revisão 1 foi implementada e mesclada em `main` com `emissao_ativa = false`. Nenhuma nota foi transmitida. Ao receber a resposta escrita do fornecedor e ler a documentação pública e o SDK, o contrato real divergiu do assumido em quatro frentes:

| Frente | Revisão 1 assumia | Contrato real | Consequência se tivesse ido a produção |
|---|---|---|---|
| Resposta da transmissão | `status: "autorizado"`, `chave`, `codigo_status` na raiz | `ReturnNF.Ok` (booleano), `ChaveNF`, `CodStatusRespostaSefaz` | **toda nota autorizada seria gravada como `rejeitado`**; a nova tentativa emitiria uma segunda nota válida para o mesmo pedido |
| Endpoints | `/v1/nfe`, `/v1/nfe/previa`, `/v1/nfe/{chave}/xml` | `/services/fiscal/EnviarNotaFiscal` etc., todos `POST` | 404 em toda chamada |
| Payload | `snake_case` em português, bloco `emitente`, totais, `numero_item` | `PascalCase`, sem emitente, sem totais, `nItem` posicional, imposto aninhado | rejeição na validação do fornecedor |
| Webhook | `?token=` na URL; gatilho primário da reconciliação | HMAC-SHA256 do corpo bruto no header; **a rota síncrona não dispara webhook** | reconciliação nunca seria acionada pelo webhook |

O que a revisão 1 acertou e permanece: gravar antes de transmitir; `ordem_enviada` e `n_item_verificado` como colunas distintas; casar o XML por código, não por NCM nem posição; desconto explícito por linha; referência item a item na NFD; dinheiro em centavos até a fronteira; a verdade vem do XML, nunca do corpo de um webhook; autenticação do webhook isolada numa função — o que tornou esta revisão barata nesse ponto.

**Lição registrada:** 151 testes verdes não pegaram nada disso porque as fixtures foram escritas pela mesma suposição que o código. Teste contra um contrato inventado mede coerência interna, não correção. A partir desta revisão, toda fixture de fornecedor é derivada de fonte do fornecedor (documentação, SDK ou resposta real de homologação) e cita a fonte.
