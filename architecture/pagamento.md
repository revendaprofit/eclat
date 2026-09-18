# SOP — Pagamento (Mercado Pago, Checkout Transparente via Orders API)

Spec e decisões: `docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md`. Achados de campo: `findings.md` (entradas de 2026-09-17).

## Mapa

| Camada | Onde | O que faz |
|---|---|---|
| Provider do Medusa | `apps/backend/src/modules/mercadopago/` | `service.ts` implementa `AbstractPaymentProvider` (`pp_mercadopago_mercadopago`); `cliente.ts` fala com `/v1/orders`; `assinatura.ts` valida o webhook; `status.ts` mapeia status; `recusas.ts` traduz recusas |
| Registro | `apps/backend/medusa-config.ts` | só entra se `MERCADOPAGO_ACCESS_TOKEN` existir |
| Reconciliação | `src/modules/mercadopago/reconciliar.ts` + `src/jobs/mercadopago-reconciliar.ts` | a cada 10 min: webhook perdido → conclui carrinho; dinheiro sem pedido → estorna e loga |
| Webhook | rota nativa `POST /hooks/payment/mercadopago_mercadopago` | evento **"Order"** no painel do MP; assinatura `x-signature` obrigatória |
| Vitrine | `apps/storefront/src/lib/data/pagamento-mercadopago.ts`, `lib/util/pagamento-mercadopago.ts`, `modules/checkout/components/pagamento-mercadopago/` | Pix (QR + consulta a cada 5 s) e Card Payment Brick |
| Cockpit | `apps/cockpit/lib/pagamento.ts` | bloco "Pagamento" na gaveta do pedido; linha "(−) Taxas de pagamento" no DRE |
| Ativação na região | `apps/backend/ativar-mercadopago-regiao.mjs` | liga o MP / desliga o manual (D3) pela Admin API — só com "pode aplicar" |

## Variáveis de ambiente

| Onde | Variável | Observação |
|---|---|---|
| Backend (Railway e `.env`) | `MERCADOPAGO_ACCESS_TOKEN` | credencial da aplicação **eclat-checkout**; de teste começa com `APP_USR-` também (Orders API) — confira a aba Teste/Produtivas no painel |
| Backend | `MERCADOPAGO_WEBHOOK_SECRET` | gerado em Webhooks → Configurar notificações → Salvar |
| Backend | `MERCADOPAGO_MAX_PARCELAS` (4), `MERCADOPAGO_PIX_EXPIRA_MIN` (30) | opcionais |
| Vitrine (Vercel e `.env.local`) | `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` | Public Key da mesma aplicação; sem ela a opção "Cartão" não aparece |
| Vitrine | `NEXT_PUBLIC_MERCADOPAGO_MAX_PARCELAS` (4) | opcional |

## Como funciona (resumo)

- Cartão: o Brick tokeniza no navegador → `initiatePaymentSession` cria **e processa** a order (`processing_mode: automatic`) → aprovado vira `complete` na hora. Recusa chega como HTTP 402 com o motivo em `errors[0].details[0]` ("PAY_ID: motivo").
- Pix: "Gerar código Pix" cria a order (`expiration_time: PT30M`) → a tela consulta `cart.complete` a cada 5 s → pago vira pedido. D1: Pix pendente não reserva estoque nem vira pedido.
- `external_reference` da order = **id da sessão de pagamento do Medusa** — é assim que o webhook e a busca da tarifa reencontram tudo.
- Tarifa real: não existe em `/v1/orders`; vem de `GET /v1/payments/search?external_reference={sessão}` (`fee_details`), gravada em `payment.data.tarifa_centavos`.
- Pix pago não guarda o QR nos dados do pagamento.

## Rotinas

**Testes:** `npm run test:unit` (backend), `npx vitest run` (vitrine e Cockpit). Integração real contra o sandbox: `npm run test:db:up` e `TEST_TYPE=integration:http NODE_OPTIONS=--experimental-vm-modules npx jest integration-tests/http/pagamento-mercadopago --runInBand --forceExit` (precisa das credenciais de teste em `apps/backend/.env`; sem elas é pulado).

**Ambiente local completo:** `launch.json` da raiz ECLAT → `backend-pagamento` (9100, banco `eclat_pagamento` no contêiner `eclat-pg-test`) e `storefront-pagamento` (8100). Cartões de teste: `5480 8328 0103 3311`, 11/30, 123; titular `APRO` aprova, `FUND`/`OTHE`/`CALL`/`SECU`/`CONT` recusam/pendem.

**Estorno:** `refundPayment` do provider → `POST /v1/orders/{id}/refund` (total: corpo vazio; parcial: `amount` + `transaction_id`). 180 dias.

**Alertas:** o Medusa **não reage** sozinho a estorno/chargeback vindos por webhook — o provider grava `logger.warn` (`precisa de atenção manual`). A reconciliação grava `logger.error` com `ESTORNO AUTOMÁTICO` quando devolve dinheiro. Procurar por `[mercadopago]` nos logs do Railway.

## Armadilhas (já pagas)

- Import relativo com `.js` dentro de `src/modules/mercadopago` quebra o carregamento no Medusa real (o Jest esconde). Imports sem extensão.
- `POST /v1/orders/{id}/cancel` exige `X-Idempotency-Key` e devolve 422 pra order automática com Pix — não usamos.
- `refundPayment` recebe `amount` como BigNumber (objeto), não número — `dinheiro.ts` trata.
- Os campos do Brick são iframes de outro domínio: automação só com Playwright (`frameLocator`).
- Sandbox: um Pix com `payer.first_name = "APRO"` pode ser aprovado sozinho depois de um tempo.

## Getnet (depois)

Segundo provider, `src/modules/getnet/` (`pp_getnet_getnet`), mesma interface. A vitrine desdobra opções por provider em `lib/util/pagamento-mercadopago.ts` (`opcoesDePagamento`) — generalizar ali.
