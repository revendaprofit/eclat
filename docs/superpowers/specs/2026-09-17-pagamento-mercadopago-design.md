# Pagamento — Mercado Pago (Parte 4)

Data: 2026-09-17 · Status: **aprovada pelo dono em 2026-09-17** (D1–D4 decididas; D5 em aberto) · F0–F3 concluídas e F4 com código pronto em 17/09; go-live pendente do dono (ver progress.md). SOP: `architecture/pagamento.md` · Depende de: `feat/dados-fiscais-checkout` (CPF no checkout) · Relaciona-se com: Projeto B (Reversa/estornos), DRE (Fase 5 do Cockpit).

## 1. Contexto e objetivo

Hoje o checkout fecha pedido com o provider manual do Medusa (`pp_system_default`, "Pix pelo WhatsApp"): o pedido nasce sem pagamento e a cobrança é feita à mão. A Parte 4 entrega **pagamento real dentro do site**: Pix e cartão de crédito, com confirmação automática no pedido do Medusa.

Em 15/09 o dono escolheu a Getnet como gateway; o sandbox dela ainda não foi liberado. Em 17/09 o dono decidiu **entrar com o Mercado Pago agora** para começar a vender, e plugar a Getnet depois.

## 2. Decisões já tomadas (não reabrir)

1. **Mercado Pago agora, Getnet depois.** Os dois entram como *Payment Module Providers* do Medusa. A vitrine só conhece `provider_id`; somar a Getnet não reescreve o checkout.
2. **Checkout Transparente com Bricks.** A cliente paga sem sair da ÉCLAT.
3. **Meios no lançamento: Pix e cartão de crédito.** Boleto fora.
4. **Cartão nunca passa pelo nosso servidor** (Invariante 4). O Brick tokeniza no navegador; o backend recebe só o `token` de uso único.
5. **Segredos só em `.env`/Railway/Vercel, colocados pelo dono.** Nunca por chat, nunca em log, nunca no banco.
6. **Conta Mercado Pago:** a de `useeclatbr@gmail.com`.

## 3. Escopo

**Entra:** módulo `mercadopago` no backend (provider, cliente da API, validação de webhook, mapa de status, mensagens de recusa em pt-BR); etapa de pagamento da vitrine (seleção Pix/Cartão, Card Payment Brick, tela de Pix com QR + copia e cola + contagem regressiva, espera por confirmação); método e tarifa real no detalhe do pedido do Cockpit; linha "(−) Taxas de pagamento" no DRE; estorno pelo provider (`refundPayment`), que o Projeto B vai acionar; testes de unidade e integração; roteiro de homologação em sandbox.

**Não entra:** boleto; cartão salvo / compra em 1 clique; débito; 3DS obrigatório (fica ligável por env); assinatura/recorrência; venda presencial (F4 do leitor de código de barras); split de pagamento; a Getnet em si.

## 4. Arquitetura

> **Correção de rota (17/09, mesmo dia):** o Mercado Pago migrou o Checkout Transparente da **API de Payments** (`/v1/payments`, hoje "legacy" na doc oficial) para a **API de Orders** (`/v1/orders`). A aplicação criada no painel ("eclat-checkout") já nasceu no modelo novo. Todo este documento usa Orders — não Payments. Referência lida na doc oficial em 17/09 (`checkout-api-orders/*`, `Modelo de integração`).

```
Vitrine (Next.js)                      Backend (Medusa 2.15.5)                 Mercado Pago (Orders API)
─────────────────                      ───────────────────────                 ──────────────────────────
Brick de cartão ──token──▶ initiatePaymentSession ─▶ provider.initiatePayment
"Finalizar pedido" ──────▶ cart.complete ──────────▶ provider.authorizePayment ─▶ POST /v1/orders (processing_mode: automatic)
Tela de Pix ◀── QR ─────── payment_session.data ◀─── provider.initiatePayment ──▶ POST /v1/orders (payment_method.type: bank_transfer)
  (consulta a cada 5 s)                  POST /hooks/payment/mercadopago_mercadopago ◀── webhook (type: "order")
                                         └▶ provider.getWebhookActionAndData ───▶ GET /v1/orders/{id}
                                            └▶ Medusa conclui o carrinho e captura
```

- **Módulo:** `apps/backend/src/modules/mercadopago/` — `index.ts` (ModuleProvider), `service.ts` (estende `AbstractPaymentProvider`, `identifier = "mercadopago"`), `cliente.ts` (fetch direto em `/v1/orders` — sem o SDK npm, cuja cobertura da Orders API não foi confirmada; motivo no topo do arquivo), `assinatura.ts`, `status.ts`, `recusas.ts`, `__tests__/`.
- **ID do provider:** `pp_mercadopago_mercadopago`.
- **Registro condicional** em `medusa-config.ts`: o provider só é registrado se `MERCADOPAGO_ACCESS_TOKEN` existir. Deploy sem a variável não quebra o backend.
- **Ativação na região Brasil:** via Admin API (`payment_providers` da região). É mudança em produção → só com "pode aplicar".
- **Getnet depois:** `src/modules/getnet/`, `pp_getnet_getnet`, mesma interface. Na vitrine, cada provider tem seu contêiner; o resto do checkout é comum.
- **`processing_mode: "automatic"`** em toda a order (decisão técnica, não do dono): cria e processa em uma única chamada, mais simples que o modo `manual` (que exigiria uma chamada de captura separada) e suficiente para o nosso fluxo de checkout de uma etapa só.

### 4.1 Dinheiro

O Medusa v2 guarda valores em **unidade maior decimal** (199.90), e a API de Orders do MP recebe `total_amount`/`amount` também em reais decimais, **como string** (`"199.90"`, não número). O provider formata com 2 casas fixas, sem multiplicar. Tudo que é **nosso** (tarifa no DRE, relatórios) converte para **centavos inteiros** na borda (Invariante 3): `Math.round(Number(valor) * 100)`.

## 5. Fluxo — cartão de crédito

1. Etapa "Pagamento": a cliente escolhe Cartão. Renderiza o **Card Payment Brick** (valor = total do carrinho, e-mail do carrinho, CPF de `cart.metadata.cpf` pré-preenchido).
2. No envio, o Brick devolve `token`, `payment_method_id` (ex.: `master`), `issuer_id`, `installments`, `payer.identification`. A vitrine chama `initiatePaymentSession` com esses dados em `data`.
3. "Finalizar pedido" → `cart.complete` → `authorizePayment` → `POST /v1/orders` com:
   ```json
   {
     "type": "online",
     "processing_mode": "automatic",
     "external_reference": "{id da sessão de pagamento do Medusa}",
     "total_amount": "199.90",
     "payer": { "email": "...", "first_name": "...", "identification": { "type": "CPF", "number": "..." } },
     "transactions": { "payments": [{
       "amount": "199.90",
       "payment_method": { "id": "master", "type": "credit_card", "token": "...", "installments": 3 }
     }] }
   }
   ```
   com `X-Idempotency-Key = id da sessão` no header, `description = "USEECLAT"` (referência na fatura) e `notification_url` (se não vier já fixada nas Notificações da aplicação, ver §7).
4. Resposta — a order tem **um `status`/`status_detail` geral e um por transação** (`transactions.payments[]`, mesmos valores no nosso caso de 1 pagamento):
   - `processed`/`accredited` → `captured`. Pedido criado, cliente vai para a confirmação.
   - `processing`/`in_process` (análise antifraude) ou `action_required`/`waiting_capture` → carrinho fica aberto; tela "Estamos confirmando seu pagamento"; o webhook conclui.
   - `failed`/`failed` → erro com a **mensagem traduzida** do `status_detail` do pagamento (§8). A cliente pode tentar outro cartão: novo token, nova sessão, nova chave de idempotência.
5. Parcelas: o Brick mostra o que a **conta MP** oferece (parcelado sem juros é configurado no painel do MP, não no código). O código só limita `maxInstallments` (env `MERCADOPAGO_MAX_PARCELAS`).

## 6. Fluxo — Pix

1. Na etapa final, botão **"Gerar código Pix"** → `initiatePaymentSession` com `data.metodo = "pix"` → o provider cria a order com:
   ```json
   {
     "type": "online",
     "processing_mode": "automatic",
     "external_reference": "{id da sessão de pagamento do Medusa}",
     "total_amount": "199.90",
     "payer": { "email": "...", "first_name": "...", "identification": { "type": "CPF", "number": "..." } },
     "transactions": { "payments": [{ "amount": "199.90", "payment_method": { "id": "pix", "type": "bank_transfer" } }] }
   }
   ```
   mais `expiration_time: "PT30M"` dentro do pagamento (confirmado no sandbox: a resposta traz `date_of_expiration`; minutos por `MERCADOPAGO_PIX_EXPIRA_MIN`).
   O `external_reference` é o **id da sessão de pagamento** que o próprio Medusa injeta em `data.session_id` (não o `cart.id`): é por ele que o webhook reencontra a sessão.
2. A resposta chega com `status: "action_required"`, `status_detail: "waiting_transfer"` e, dentro de `transactions.payments[0].payment_method`: `qr_code` (copia e cola), `qr_code_base64` (pode vir vazio no sandbox — conferir na F0) e `ticket_url` (link da tela de pagamento hospedada pelo MP, útil como retaguarda). `payment_session.data` guarda esses três campos mais o `id` da order (`ORD...`) e o `id` do pagamento (`PAY...`).
3. A vitrine mostra QR, botão "Copiar código" e consulta o estado a cada 4 s (`GET /v1/orders/{id}` via nosso backend, nunca direto do navegador para o MP).
4. A cliente paga no banco. O MP chama o webhook (`action: "order.processed"`, `type: "order"`) → status vira `processed`/`accredited` → **o Medusa conclui o carrinho e cria o pedido**, mesmo que ela tenha fechado a aba. A consulta da vitrine encontra o pedido e redireciona para a confirmação. O aviso por WhatsApp do pedido (já existente) cobre quem fechou a aba.
5. Expirou (`status: "expired"`) → tela oferece "Gerar novo código" (nova order; a antiga fica `expired`, não precisa de ação nossa).
6. Carrinho mudou com Pix gerado (`updatePayment` com valor diferente) → **não tentamos cancelar a order antiga** (achado da F0, 17/09: `POST /v1/orders/{id}/cancel` devolve 422 numa order `processing_mode: automatic` com transação Pix já embutida — o cancelamento só serve para order ainda sem transação processada, e a nossa sempre nasce com a transação junto). A vitrine simplesmente **gera uma order nova** para o valor atualizado; a antiga fica órfã e expira sozinha (Pix tem prazo próprio) sem nunca virar pedido no Medusa — D1 garante que isso não tem efeito colateral (nenhum estoque foi reservado por ela).

### 6.1 Estoque durante o Pix (D1, decidida)

**O pedido só nasce quando o Pix é pago.** Pix pendente não reserva estoque. Caso raro: duas clientes disputam a última peça e a segunda paga depois que a primeira levou → a conclusão do carrinho falha por estoque → o provider **estorna automaticamente** o Pix e o Cockpit recebe um alerta para o atendimento avisar a cliente.

### 6.2 Como ficou na vitrine (F2, 2026-09-17)

- **Etapa Pagamento:** o provider único aparece como duas opções — "Pix" e "Cartão de crédito" (o cartão só se `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` existir). Escolher não cria nada: a escolha segue na URL (`?step=review&metodo=pix|cartao`), porque a sessão de pagamento só pode nascer com tudo em mãos (contrato do `service.ts`).
- **Etapa Revisão:** o texto dos termos continua ali, e o botão final vira a ação do meio escolhido — "Gerar código Pix" ou o "Finalizar pedido" do próprio Card Payment Brick (tema com as cores da marca, teto de parcelas por `NEXT_PUBLIC_MERCADOPAGO_MAX_PARCELAS`, débito e pré-pago excluídos).
- **CPF, e-mail e valor saem do carrinho no servidor** (`lib/data/pagamento-mercadopago.ts`); o navegador só manda o que só ele tem: token de uso único, bandeira, parcelas, nome do titular e 4 últimos dígitos.
- **Espera do Pix / cartão em análise:** a tela chama `cart.complete` a cada 5 s. Pendente → o Medusa responde `not_allowed` (tratado como "ainda não"); pago → vira pedido e redireciona; carrinho já concluído pelo webhook → `complete` devolve o mesmo pedido. Por isso o fluxo funciona **mesmo sem webhook** (ex.: ambiente local) — o webhook cobre quem fechou a aba.
- **Pix só aparece se** foi gerado para o valor atual do carrinho e ainda não expirou (`pixVigente`); expirou ou o valor mudou → volta o botão de gerar.
- Recusa de cartão: a mensagem pt-BR aparece acima do formulário e o Brick volta a ficar editável (token novo na tentativa seguinte).

## 7. Webhook

- Rota nativa do Medusa: `POST {BACKEND}/hooks/payment/mercadopago_mercadopago`. Cadastrada em Suas integrações → Webhooks → Configurar notificações, evento **"Order"** (não "Payment" — é a nomenclatura da Orders API). Isso gera uma chave secreta própria da aplicação (`MERCADOPAGO_WEBHOOK_SECRET`), sem prazo de validade.
- Corpo da notificação (confirmado na doc oficial, 17/09):
  ```json
  {
    "action": "order.processed",
    "type": "order",
    "data": { "id": "ORD01...", "status": "processed", "status_detail": "accredited",
               "transactions": { "payments": [{ "id": "PAY01...", "status": "processed", "status_detail": "accredited" }] } },
    "date_created": "...", "live_mode": true, "user_id": "..."
  }
  ```
  Query params da própria URL: `?data.id=ORD01...&type=order`.
- **Assinatura obrigatória:** header `x-signature` (`ts=…,v1=…`), validado com HMAC-SHA256 sobre o manifesto `id:{data.id};request-id:{x-request-id};ts:{ts};` e `MERCADOPAGO_WEBHOOK_SECRET` — **`data.id` em minúsculas** antes de montar o manifesto (a doc é explícita: `ORD01M28...` vira `ord01m28...`). Comparação em tempo constante (`timingSafeEqual`). Assinatura inválida → `not_supported` + log sem payload. Fórmula confirmada igual para Payments e Orders; nosso `assinatura.ts` (prova em `apps/backend/f0-mercadopago.mjs`) já está correto.
- **O corpo do webhook nunca é fonte da verdade.** O provider sempre busca `GET /v1/orders/{id}` e decide pelo que o MP responde. O Mercado Pago espera HTTP 200/201 em até 22 s; sem isso, reenvia a cada 15 min.
- Mapa de status (`status.ts`, função pura, testada) — tabela oficial `status`/`status_detail` da order:

| `status` | `status_detail` | Ação no Medusa |
|---|---|---|
| `processed` | `accredited` | `captured` |
| `processed` | `partially_refunded` | `captured` (o estorno parcial é tratado à parte, não muda o status da sessão) |
| `processing` | `in_process` | `pending` |
| `action_required` | `waiting_payment`, `waiting_capture`, `waiting_transfer` (Pix aguardando), `waiting_retry` | `pending` |
| `canceled` | `canceled` | `canceled` |
| `expired` | `expired` | `canceled` |
| `failed` | `failed` | `not_supported` (mapeado para a mensagem de recusa, §8) |
| `refunded` | `refunded` | `not_supported` no fluxo de pagamento + alerta no Cockpit |
| `charged_back` | `in_process`, `settled`, `reimbursed` | `not_supported` + alerta no Cockpit (chargeback é tratado à mão) |

- Idempotência: o MP reenvia webhooks; o Medusa já ignora sessão capturada. O provider não tem efeito colateral próprio além do estorno de D1, protegido por chave de idempotência.

## 8. Mensagens de recusa (pt-BR, tom da marca)

`recusas.ts` traduz `status_detail` em mensagem acionável — sem jargão e sem culpar a cliente. Exemplos: `cc_rejected_insufficient_amount` → "O cartão não tem limite disponível para esta compra. Quer tentar outro cartão ou pagar com Pix?"; `cc_rejected_bad_filled_security_code` → "O código de segurança não confere. Dá uma olhada e tenta de novo."; `cc_rejected_call_for_authorize` → "Seu banco pediu uma confirmação. Autorize a compra no app do banco e tente novamente."; desconhecido → mensagem genérica + oferta de Pix. Texto final é revisado pelo dono (copy da marca).

## 9. Onde mora cada dado

| Dado | Onde | Justificativa |
|---|---|---|
| Pagamento, status, valor | Medusa (`payment`, `payment_session`) | comércio (Invariante 2) |
| `mp_order_id` (`ORD...`), `mp_payment_id` (`PAY...`), método (`pix`/`cartao`), bandeira, parcelas, 4 últimos dígitos | `payment.data` | atributo do pagamento |
| **Tarifa real** e líquido, em centavos | `payment.data.tarifa_centavos`, `liquido_centavos` | **confirmado na F0:** a Orders API não expõe `fee_details` em nenhum campo (nem no `GET /v1/orders/{id}`, nem tentando `GET /v1/payments/{PAY_id}` — dá 404, é outro espaço de IDs). O caminho que funciona: `GET /v1/payments/search?external_reference={id da sessão}` (API clássica de Payments, ainda ativa para consulta) devolve o registro com um `id` numérico próprio e `fee_details` (`mercadopago_fee`, e `financing_fee` quando parcelado). O provider busca por esse endpoint depois que a order é aprovada. O Cockpit lê pela Admin API — não duplica no Supabase |
| Access Token, Webhook Secret | env do backend | segredo |
| Public Key | env da vitrine (`NEXT_PUBLIC_…`) | pública por natureza |

**Sem tabela nova no Supabase.** Nada de número de cartão, CVV ou token persistido além da sessão de pagamento (o token do MP é de uso único e expira).

## 10. Cockpit e DRE

- Detalhe do pedido: bloco "Pagamento" com método, parcelas, bandeira/final, tarifa, líquido, link para o pagamento no painel do MP.
- DRE: nova linha **"(−) Taxas de pagamento"** = soma de `tarifa_centavos` dos pedidos do período. É despesa financeira, **não** COGS (decisão de 15/06). Pedidos antigos (provider manual) contam zero.
- Estorno: `refundPayment` → `POST /v1/orders/{order_id}/refund` — corpo vazio para total, ou `{amount, transaction_id}` para parcial (a Orders API estorna por transação; a order só fica `refunded` quando todas as transações estiverem 100% estornadas). Prazo: até 180 dias da aprovação. O botão e a regra de negócio são do Projeto B; aqui fica a capacidade, testada.

## 11. Variáveis de ambiente

| Onde | Variável |
|---|---|
| Backend (`.env` + Railway) | `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`, `MERCADOPAGO_MAX_PARCELAS` (padrão 4), `MERCADOPAGO_PIX_EXPIRA_MIN` (padrão 30), `BACKEND_PUBLIC_URL` (para `notification_url`) |
| Vitrine (`.env.local` + Vercel) | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` |

Sandbox usa as **credenciais de teste** da aplicação e **usuários de teste** (comprador/vendedor) — criáveis pelo MCP do MP (`create_test_user`).

## 12. Decisões do dono (2026-09-17)

- **D1 — Estoque durante o Pix: opção (a).** O pedido só nasce quando o Pix é pago. Pix pendente não reserva estoque. No conflito de última peça, o provider estorna automaticamente e o Cockpit recebe alerta.
- **D2 — Parcelamento: até 4x.** `MERCADOPAGO_MAX_PARCELAS=4`. Quem paga o custo do parcelamento (cliente = "com juros"; loja = "sem juros") é configurado no painel do MP, seção "Taxas e parcelas" — ver §12.1. **Em aberto:** quantas das 4 parcelas são sem juros.
- **D3 — "Pix pelo WhatsApp" (`pp_system_default`): desligar** da região Brasil quando o MP entrar em produção (F4). Religável pela Admin API como contingência.
- **D4 — Titularidade: resolvida.** A conta MP está no CNPJ da marca; a razão social é o nome da titular (empresária individual), por isso o painel mostra o nome dela. Coerente com o emitente da NF-e. `statement_descriptor = "USEECLAT"` para a fatura do cartão mostrar a marca.
- **D5 — Prazo de liberação do cartão: em aberto** (decisão comercial, feita no painel do MP; não muda código). Taxas em §12.1.

### 12.1 Taxas de referência (Checkout, tabela pública do MP, consultada em 2026-09-17)

A taxa **efetiva da conta** aparece em "Taxas e parcelas" no painel e pode diferir desta tabela. O sistema não usa tabela: grava a tarifa real de cada pagamento (`fee_details`, §9).

| Meio | Taxa | Dinheiro disponível |
|---|---|---|
| Pix | 0,99% | na hora |
| Cartão de crédito | 4,98% | na hora (só após análise do histórico de vendas) |
| Cartão de crédito | 4,49% | 14 dias |
| Cartão de crédito | 3,98% | 30 dias |

Custo do parcelamento (somado à taxa acima **quando a loja oferece sem juros**; quando é com juros, a cliente paga e a loja recebe o valor cheio): 2x 7,64% · 3x 9,23% · 4x 10,86%.

## 13. Riscos

1. **`cart.complete` com pagamento pendente e reautorização pelo webhook** — respondido pela leitura do Medusa 2.15.5 (ver `findings.md`, 2026-09-17): o webhook chama `authorizePayment` de novo, então ele é **idempotente** (com `mp_payment_id` só consulta; sem id, cria com `X-Idempotency-Key = id da sessão`). Falta só confirmar a idempotência do MP no sandbox.
2. **Webhook não chega** (URL errada, backend fora): rotina de reconciliação a cada 10 min consulta no MP os pagamentos de sessões `pending` com mais de 5 min.
3. **Pagamento aprovado e carrinho que não conclui** (estoque, promoção expirada): o Medusa **não lança erro** nesse caso (`continueOnPermanentFailure`). O estorno automático da D1 é feito pela rotina de reconciliação (risco 2), que procura sessão capturada sem pedido → estorna → alerta no Cockpit.
4. **Working tree compartilhado:** há outra conversa ativa no repositório. A implementação roda em **git worktree próprio**, em branch `feat/pagamento-mercadopago` a partir de `main` + `feat/dados-fiscais-checkout` quando esta for mesclada.

## 14. Fases (com Halt entre elas)

- **F0 — Prova de conceito (sandbox):** script que cria Pix e cartão de teste, valida assinatura de webhook com túnel, e responde aos riscos 1 e 3. Saída: achados em `findings.md`.
- **F1 — Backend:** módulo, provider, webhook, reconciliação, estorno, testes. Aceite: pagamento sandbox aprovado vira pedido pago no Medusa, por cartão e por Pix.
- **F2 — Vitrine:** seleção de método, Brick, tela de Pix, espera, mensagens de recusa. Aceite: compra completa no navegador, mobile 390 px e desktop.
- **F3 — Cockpit/DRE:** bloco Pagamento, linha de taxas.
- **F4 — Produção:** credenciais reais (dono), webhook, ativar na região ("pode aplicar"), compra real de valor baixo + estorno, `quality_evaluation` do MP, atualizar `CLAUDE.md`/`task_plan.md`/`architecture/pagamento.md`.

## 15. Critério de aceite da Parte 4

Pagamento aprovado (Pix e cartão) reflete no pedido do Medusa sem ação manual; recusa mostra mensagem clara; tarifa real aparece no pedido e no DRE; estorno funciona; nenhum dado de cartão toca nosso servidor; segredos fora do repositório.
