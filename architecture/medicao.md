# Medição de anúncios (pixel, API de Conversões, catálogo)

SOP técnico. IDs de conta, pixel e campanhas ficam em `contexto-claude/` (repositório público).

## Regra 1 — `item_id` é sempre o id da VARIANTE
O feed (`/feed.xml`) publica cada variante com `g:id = variant.id`. Catálogo da Meta e Merchant Center casam
evento com produto por esse id. Por isso `apps/storefront/src/modules/analytics/items.ts` usa `variant.id` em
`view_item`, `view_item_list`, `add_to_cart`, `begin_checkout` e `purchase` (PDP sem variante escolhida → 1ª
variante). Com SKU no lugar (como era até 2026-09-21), o remarketing de catálogo ficava com "conjunto de produtos
vazio": nenhum evento batia com nenhum item. A página do conjunto segue a mesma regra (peça → 1ª variante).

## Regra 2 — o Purchase sai de DOIS lugares, com o mesmo `event_id`
- Vitrine: página de confirmação → `Track event="purchase"` (pixel via GTM) + `fireCapiPurchase` (servidor Next).
- Backend: subscriber `order.placed` → `src/subscribers/compra-meta.ts` → `src/lib/meta-capi.ts`.
- `event_id = purchase_<order.id>` nos dois: a Meta deduplica e conta uma compra só.

Por que o backend: com Pix o pedido nasce pelo webhook do Mercado Pago. Quem paga no app do banco muitas vezes
não volta para a aba — a página de confirmação não renderiza e o Purchase da vitrine nunca sai (caso real: pedido
pago em 2026-09-20 sem evento na Meta). O `order.placed` acontece sempre.

Sinais do navegador: no passo de endereço a vitrine grava `meta_fbp`, `meta_fbc` e `meta_ua` no metadata do
carrinho (`sinaisDoMeta()` em `modules/analytics/capi.ts`) — só com o aceite de cookies (`eclat_consent=granted`).
O metadata do carrinho vira metadata do pedido. Com esses sinais o evento vai como `action_source: website`
(casa com o clique do anúncio); sem eles, `system_generated` (conta a venda, não atribui). E-mail, telefone,
nome, cidade e CEP vão sempre em SHA-256.

## Ligar
- Vitrine (Vercel): `META_CAPI_TOKEN` — já existe.
- Backend (Railway): `META_CAPI_TOKEN` com o MESMO valor. Sem a variável o subscriber não faz nada.
- Pixel: `site_content.marketing.meta_pixel_id` (Cockpit → Marketing) — lido pelos dois lados.
- Conferir: log do backend `[meta-capi] pedido <id>: enviado`; Gerenciador de Eventos → Purchase com origem
  "Servidor". Diagnóstico da vitrine: `GET /api/marketing/capi-test`.

## Testes
`apps/backend/src/lib/__tests__/meta-capi.unit.spec.ts` (corpo do evento: dedup, hash, variante, action_source).
