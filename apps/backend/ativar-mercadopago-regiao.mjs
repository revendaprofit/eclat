// F4 da Parte 4 — liga o Mercado Pago na região Brasil e (opcionalmente) desliga o provider
// manual "Pix pelo WhatsApp" (decisão D3 da spec). Só pela Admin API — Medusa é a fonte da verdade.
//
// Sem argumentos: só MOSTRA a região e os providers ativos (não grava nada).
//   node ativar-mercadopago-regiao.mjs
// Grava (só com "pode aplicar" do dono):
//   node ativar-mercadopago-regiao.mjs --aplicar               → adiciona o Mercado Pago, mantém o manual
//   node ativar-mercadopago-regiao.mjs --aplicar --so-mp       → Mercado Pago sozinho (desliga o manual — D3)
//   node ativar-mercadopago-regiao.mjs --aplicar --reverter    → volta a só o manual (contingência)
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD (os mesmos do Cockpit).
const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const SENHA = process.env.MEDUSA_ADMIN_PASSWORD
const MP = "pp_mercadopago_mercadopago"
const MANUAL = "pp_system_default"

if (!URL || !EMAIL || !SENHA) {
  console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL e MEDUSA_ADMIN_PASSWORD no ambiente.")
  process.exit(1)
}
const args = new Set(process.argv.slice(2))
const aplicar = args.has("--aplicar")

const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 300)}`)
  return d
}
const { token } = await j(await fetch(`${URL}/auth/user/emailpass`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: SENHA }) }))
const h = { "content-type": "application/json", authorization: `Bearer ${token}` }

const regioes = (await j(await fetch(`${URL}/admin/regions?limit=50&fields=id,name,currency_code,*payment_providers`, { headers: h }))).regions
const brasil = regioes.find((r) => r.currency_code === "brl")
if (!brasil) throw new Error("não achei região em BRL")
const atuais = (brasil.payment_providers ?? []).map((p) => p.id)
console.log(`Região ${brasil.name} (${brasil.id}) — providers hoje: ${atuais.join(", ") || "(nenhum)"}`)

const disponiveis = (await j(await fetch(`${URL}/admin/payments/payment-providers?limit=50`, { headers: h }))).payment_providers.map((p) => p.id)
console.log(`Providers registrados no backend: ${disponiveis.join(", ")}`)
if (!disponiveis.includes(MP)) {
  console.error(`✗ ${MP} não está registrado no backend — MERCADOPAGO_ACCESS_TOKEN está no Railway e o deploy foi feito?`)
  process.exit(1)
}

let desejados
if (args.has("--reverter")) desejados = [MANUAL]
else if (args.has("--so-mp")) desejados = [MP]
else desejados = [...new Set([...atuais, MP])]

console.log(`Providers desejados: ${desejados.join(", ")}`)
if (!aplicar) {
  console.log("(simulação — nada gravado; repita com --aplicar quando o dono disser \"pode aplicar\")")
  process.exit(0)
}
const r = await j(await fetch(`${URL}/admin/regions/${brasil.id}`, { method: "POST", headers: h, body: JSON.stringify({ payment_providers: desejados }) }))
console.log(`✓ gravado: ${(r.region.payment_providers ?? []).map((p) => p.id).join(", ")}`)
