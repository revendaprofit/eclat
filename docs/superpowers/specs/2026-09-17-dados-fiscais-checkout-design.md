# Coleta de dados fiscais no checkout — Design

Data: 2026-09-17 · Status: aprovado em conversa · Depende de: `2026-09-16-fiscal-brasilnfe-design.md` (Projeto A, em `main`).

## 1. Contexto e objetivo

O Projeto A entregou a emissão de NF-e, mas ela está **desligada** (`fiscal_config.emissao_ativa = false`) por um motivo concreto: `apps/backend/src/lib/fiscal/fiscal-pedido.ts` exige **CPF**, **código IBGE do município**, **bairro** e **número** para montar a nota, e **nada na vitrine coleta esses quatro campos**. Uma varredura (`grep -rni "cpf"` em `apps/storefront/src`) retorna zero ocorrências.

Enquanto o interruptor estiver desligado, a loja despacha normalmente e nada é transmitido. Ligá-lo hoje faria todo despacho falhar com 422.

Este projeto coleta esses dados e destrava o interruptor.

## 2. Decisões já tomadas (não reabrir)

1. **CPF salvo na conta da cliente** para pré-preencher as próximas compras — mas **sempre** copiado para o pedido (ver §3).
2. **Formulário de endereço único**, extraído e usado pelo checkout e pelo cadastro da conta. Endereço salvo tem que nascer emitível.
3. **CPF obrigatório**, com uma linha explicando que é para emitir a nota. Sem CPF o pedido não fecha.
4. **Cockpit permite completar** os dados fiscais no detalhe do pedido — serve para os pedidos antigos e é rede de segurança permanente.
5. **Busca de CEP pelo nosso backend, com cache.** O navegador da cliente não fala com terceiro.

## 3. Onde cada dado mora

| Dado | Onde | Justificativa |
|---|---|---|
| **CPF** | `order.metadata.cpf` **sempre**; `customer.metadata.cpf` apenas quando logada | O pedido é um retrato do instante. Se o CPF vivesse só na cliente e ela o corrigisse depois, a nota de um pedido antigo sairia com o CPF novo. `customer.metadata.cpf` serve **só para pré-preencher** e nunca é a fonte da nota |
| **`numero`, `bairro`, `municipio_ibge`** | `shipping_address.metadata` | São exatamente as chaves que `fiscal-pedido.ts` já lê. Não criamos contrato; preenchemos o que existe |

**Invariante desta spec:** `montarItensDoPedido` (backend) não muda. Se precisar mudar, o desenho está errado.

## 4. Escopo

**Entra:** componente único de campos de endereço (com busca de CEP, número e bairro); rota de CEP no storefront com cache; campo de CPF no checkout, obrigatório, validado; persistência do CPF no pedido e na cliente logada; bloco "Dados fiscais" no detalhe do pedido do Cockpit; testes.

**Não entra:** mudança em `apps/backend` (o contrato já existe); backfill de pedidos antigos por script (o bloco do Cockpit cobre caso a caso); coleta de CPF fora do checkout (ex.: cadastro); validação de CPF contra a Receita (só dígitos verificadores); ligar `emissao_ativa` (decisão do dono, depois da tabela do contador).

## 5. Componente único de endereço

Criar `apps/storefront/src/modules/common/components/address-fields/`.

Campos, na ordem: **CEP** (com busca), **logradouro**, **número**, **complemento**, **bairro**, **cidade**, **UF**.

Devolve os campos padrão do Medusa (`address_1`, `city`, `province`, `postal_code`, `country_code`) **e** o `metadata` fiscal (`numero`, `bairro`, `municipio_ibge`).

Passam a consumi-lo:
- `apps/storefront/src/modules/checkout/components/shipping-address`
- `apps/storefront/src/modules/checkout/components/billing_address`
- `apps/storefront/src/modules/account/components/address-card` (add e edit)

Hoje o checkout e o cadastro da conta têm formulários **separados**, com listas de campos próprias. Mantê-los separados criaria uma armadilha: a cliente logada escolhe um endereço salvo sem os campos fiscais e o despacho falha, sem ela ter feito nada errado.

## 6. Rota de CEP

`apps/storefront/src/app/api/cep/[cep]/route.ts`.

1. Normaliza e valida **8 dígitos**. Fora disso → 400.
2. Consulta o provedor (ViaCEP), isolado num módulo próprio para que trocar seja mudar um arquivo.
3. Devolve `{ logradouro, bairro, cidade, uf, ibge }`.
4. **Cache com `fetch(..., { cache: "force-cache" })`** — a relação CEP → IBGE é estável, então o segundo pedido do mesmo CEP não gera chamada externa.

O ViaCEP sinaliza CEP inexistente devolvendo **HTTP 200 com `{ "erro": true }`**, não um status de erro. O parse precisa tratar isso explicitamente, senão um CEP inválido vira um endereço com campos vazios.

**O handler é uma casca fina.** Toda a lógica — normalizar o CEP, validar, montar a URL do provedor, interpretar a resposta (inclusive o `{erro:true}`) e mapear para a nossa forma — vive em funções puras em `src/lib/util/cep.ts`. O handler só orquestra: valida, chama o `fetch`, passa a resposta para o parser, devolve.

Isso não é gosto: o `vitest.config.ts` da vitrine é deliberadamente restrito a funções puras (`environment: "node"`, e o comentário do arquivo diz "Nada de React, nada de `server-only`"). Um teste que importasse o route handler puxaria `next/server` e não roda nesse setup. Concentrar a lógica em funções puras é o que torna a parte que pode errar testável.

## 7. O CPF no checkout

Campo obrigatório, com a explicação visível:

> Precisamos do CPF para emitir a nota fiscal do seu pedido.

- **Validação de dígitos verificadores** no cliente (conveniência) e de novo no servidor (garantia). Rejeita também os repetidos conhecidos (`111.111.111-11` e afins), que passam no cálculo mas não são CPF.
- **Logada:** pré-preenchido de `customer.metadata.cpf`, editável; ao concluir o pedido, o valor volta para `customer.metadata`.
- **Convidada:** digita, e o CPF fica só em `order.metadata`.

## 8. Bloco fiscal no Cockpit

No detalhe do pedido (`apps/cockpit/app/(painel)/pedidos/`): mostra CPF, número, bairro e município/IBGE, **sinaliza o que falta**, e permite completar — com a mesma busca de CEP.

Grava via Admin API, em `order.metadata` e `shipping_address.metadata`.

Fica oculto quando o pedido já tem nota emitida: a partir daí o dado é histórico e alterá-lo criaria divergência com o XML transmitido.

## 9. Erros — nada bloqueia a venda, exceto CPF inválido

| Situação | Comportamento |
|---|---|
| CEP não encontrado (`{erro:true}`) | Campos liberados para digitação manual. Compra segue |
| Provedor de CEP fora do ar | Igual. O pedido chega sem `municipio_ibge` e o bloco do Cockpit pega antes do despacho |
| CPF com dígito verificador errado | **Bloqueia**, com mensagem. É o único caso que impede fechar |
| Pedido sem `municipio_ibge` no despacho | `fiscal-pedido.ts` já recusa com mensagem legível; o bloco do Cockpit resolve |

A regra: **falha de terceiro nunca custa uma venda.** O pior caso é trabalho manual no Cockpit antes do despacho.

## 10. Testes

O Vitest da vitrine coleta `src/**/*.test.ts` com `environment: "node"`, e o próprio arquivo de config declara o limite: **só funções puras**, nada de React nem de `server-only`. O desenho respeita isso — a lógica que pode errar mora em funções puras, e as cascas (route handler, componente React) ficam finas o bastante para serem óbvias por leitura.

- **`src/lib/util/cpf.ts`** — dígitos verificadores: válidos conhecidos, dígito errado, todos os dígitos iguais (`111.111.111-11` passa no cálculo e não é CPF), formatado com pontos e traço, tamanho errado, string vazia.
- **`src/lib/util/cep.ts`** — normalização (tira máscara), aceita 8 dígitos, rejeita o resto.
- **Parse da resposta do provedor** (mesmo arquivo) — fixture de resposta real; o caso `{ "erro": true }` com HTTP 200; e resposta com campo faltando.
- **Mapeamento para o `metadata` do endereço** — dado o retorno do provedor mais o número digitado, produz o `metadata` que `fiscal-pedido.ts` espera.

**Nenhum teste faz chamada de rede.** O que não é coberto por teste automatizado — o route handler e o componente de formulário — é verificado no roteiro de aceite do §11.

## 11. Critério de aceite

1. Checkout exibe CPF obrigatório com a explicação; CPF inválido impede concluir, com mensagem.
2. Digitar CEP válido preenche logradouro, bairro, cidade e UF; o IBGE é capturado sem aparecer para a cliente.
3. CEP inexistente ou provedor fora do ar **não** impedem concluir a compra.
4. Pedido criado tem `order.metadata.cpf` e `shipping_address.metadata` com `numero`, `bairro` e `municipio_ibge`.
5. Cliente logada: CPF volta pré-preenchido na compra seguinte; alterar o CPF do pedido **não** altera o de pedidos anteriores.
6. Endereço cadastrado pela conta tem os mesmos campos e serve para emitir.
7. Cockpit mostra o que falta num pedido sem dados fiscais e permite completar; o bloco some depois que a nota é emitida.
8. Testes verdes; nenhum teste faz chamada de rede real.
9. **Validação de ponta a ponta:** com a migration aplicada, o perfil fiscal cadastrado e `emissao_ativa = true` em homologação, um pedido novo feito pelo checkout é despachado e emite NF-e — sem nenhum passo manual.

## 12. Riscos

1. **O código IBGE não tem digitação manual possível.** Se o provedor de CEP estiver fora, o dado só entra pelo Cockpit. Mitigado pelo bloco do Cockpit; se a instabilidade se mostrar frequente, a alternativa avaliada e adiada é uma tabela local dos 5.570 municípios (casando por cidade + UF).
2. **CPF é dado pessoal sob a LGPD.** Passa a ser guardado em `customer.metadata` e `order.metadata`, no Postgres do Medusa, com o mesmo controle de acesso do restante do cadastro. Não é exposto em nenhuma rota pública nem em log.
3. **Pedidos já existentes** não têm esses dados e só despacham depois de completados pelo Cockpit. Enquanto `emissao_ativa` estiver desligado, despacham normalmente.
