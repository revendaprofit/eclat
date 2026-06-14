// Teste de fluxo de compra completo via Store API (Brasil/BRL).
// Uso: node test-checkout.mjs   (lê PK, REGION, VARIANT do ambiente)
const BASE = "http://localhost:9000"
const PK = process.env.PK
const REGION = process.env.REGION
const VARIANT = process.env.VARIANT

const h = {
  "content-type": "application/json",
  "x-publishable-api-key": PK,
}
const log = (s, v) => console.log(`✓ ${s}`, v ?? "")
async function j(res, step) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`✗ ${step}: HTTP ${res.status}`, JSON.stringify(data).slice(0, 300))
    process.exit(1)
  }
  return data
}

// 1. cria carrinho
let r = await fetch(`${BASE}/store/carts`, {
  method: "POST", headers: h, body: JSON.stringify({ region_id: REGION }),
})
let { cart } = await j(r, "criar carrinho")
log("carrinho criado", cart.id)

// 2. adiciona item
r = await fetch(`${BASE}/store/carts/${cart.id}/line-items`, {
  method: "POST", headers: h, body: JSON.stringify({ variant_id: VARIANT, quantity: 2 }),
})
;({ cart } = await j(r, "adicionar item"))
log("item adicionado; itens:", cart.items.length, "| total:", cart.total, cart.currency_code)

// 3. email + endereço
r = await fetch(`${BASE}/store/carts/${cart.id}`, {
  method: "POST", headers: h, body: JSON.stringify({
    email: "cliente@eclat.local",
    shipping_address: {
      first_name: "Maria", last_name: "Silva", address_1: "Rua das Flores, 100",
      city: "São Paulo", province: "SP", postal_code: "01310-000", country_code: "br", phone: "11999999999",
    },
    billing_address: {
      first_name: "Maria", last_name: "Silva", address_1: "Rua das Flores, 100",
      city: "São Paulo", province: "SP", postal_code: "01310-000", country_code: "br", phone: "11999999999",
    },
  }),
})
;({ cart } = await j(r, "definir email/endereço"))
log("endereço definido", cart.shipping_address?.city)

// 4. opções de frete + método
r = await fetch(`${BASE}/store/shipping-options?cart_id=${cart.id}`, { headers: h })
const { shipping_options } = await j(r, "listar fretes")
if (!shipping_options?.length) { console.error("✗ sem opções de frete"); process.exit(1) }
log("frete disponível", shipping_options[0].name)
r = await fetch(`${BASE}/store/carts/${cart.id}/shipping-methods`, {
  method: "POST", headers: h, body: JSON.stringify({ option_id: shipping_options[0].id }),
})
;({ cart } = await j(r, "aplicar frete"))
log("frete aplicado; total:", cart.total, cart.currency_code)

// 5. coleção + sessão de pagamento (manual)
r = await fetch(`${BASE}/store/payment-collections`, {
  method: "POST", headers: h, body: JSON.stringify({ cart_id: cart.id }),
})
const { payment_collection } = await j(r, "criar payment collection")
r = await fetch(`${BASE}/store/payment-collections/${payment_collection.id}/payment-sessions`, {
  method: "POST", headers: h, body: JSON.stringify({ provider_id: "pp_system_default" }),
})
await j(r, "iniciar sessão de pagamento")
log("pagamento (manual) iniciado")

// 6. completar -> pedido
r = await fetch(`${BASE}/store/carts/${cart.id}/complete`, { method: "POST", headers: h })
const done = await j(r, "completar pedido")
if (done.type === "order") {
  log("PEDIDO CRIADO", `${done.order.display_id} | total ${done.order.total} ${done.order.currency_code} | status ${done.order.status}`)
  console.log("✓ Fluxo de compra Brasil/BRL completo de ponta a ponta.")
} else {
  console.error("✗ não virou pedido:", JSON.stringify(done).slice(0, 300)); process.exit(1)
}
