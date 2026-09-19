// F4 do frete (spec 2026-09-18-frete-superfrete-design.md §6) — liga a SuperFrete na região Brasil.
// Só pela Admin API — Medusa é a fonte da verdade. Idempotente.
//
// Sem argumentos: só MOSTRA o estado (não grava nada).
//   node ativar-superfrete.mjs
// Grava (só com "pode aplicar" do dono):
//   node ativar-superfrete.mjs --aplicar              → cria/liga Mini, PAC e SEDEX; desliga a "Entrega Padrão"
//   node ativar-superfrete.mjs --aplicar --desfazer   → religa a "Entrega Padrão"; desliga as três
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD.
const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const SENHA = process.env.MEDUSA_ADMIN_PASSWORD
const PROVIDER = "superfrete_superfrete"
const SERVICOS = [
  { id: "mini", nome: "Econômica (Mini Envios)", descricao: "Entrega econômica pelos Correios." },
  { id: "pac", nome: "PAC", descricao: "Entrega padrão pelos Correios." },
  { id: "sedex", nome: "SEDEX", descricao: "Entrega expressa pelos Correios." },
]

if (!URL || !EMAIL || !SENHA) {
  console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL e MEDUSA_ADMIN_PASSWORD no ambiente.")
  process.exit(1)
}
const args = new Set(process.argv.slice(2))
const aplicar = args.has("--aplicar")
const desfazer = args.has("--desfazer")

const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 300)}`)
  return d
}
const { token } = await j(await fetch(`${URL}/auth/user/emailpass`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: SENHA }) }))
const h = { "content-type": "application/json", authorization: `Bearer ${token}` }
const get = async (caminho) => j(await fetch(`${URL}${caminho}`, { headers: h }))
const post = async (caminho, corpo) => j(await fetch(`${URL}${caminho}`, { method: "POST", headers: h, body: JSON.stringify(corpo) }))

const locais = (await get("/admin/stock-locations?limit=20&fields=id,name,*fulfillment_providers,*fulfillment_sets,*fulfillment_sets.service_zones")).stock_locations
const local = locais.find((l) => (l.fulfillment_sets ?? []).some((s) => s.type === "shipping"))
if (!local) throw new Error("não achei stock location com fulfillment set de envio")
const zona = local.fulfillment_sets.find((s) => s.type === "shipping").service_zones[0]
const temProvider = (local.fulfillment_providers ?? []).some((p) => p.id === PROVIDER)
console.log(`Local ${local.name} (${local.id}) — zona ${zona.name} — provider ${PROVIDER}: ${temProvider ? "vinculado" : "NÃO vinculado"}`)

const registrados = (await get("/admin/fulfillment-providers?limit=50")).fulfillment_providers.map((p) => p.id)
if (!registrados.includes(PROVIDER)) {
  console.error(`✗ ${PROVIDER} não está registrado no backend — SUPERFRETE_TOKEN está no Railway e o deploy foi feito?`)
  process.exit(1)
}

const opcoes = (await get(`/admin/shipping-options?limit=100&service_zone_id=${zona.id}&fields=id,name,provider_id,price_type,data,shipping_profile_id,*rules`)).shipping_options
const ligada = (o) => (o.rules ?? []).some((r) => r.attribute === "enabled_in_store" && String(r.value) === "true")
for (const o of opcoes) console.log(`  · ${o.name} [${o.provider_id}, ${o.price_type}] na loja: ${ligada(o) ? "sim" : "não"}`)

const padrao = opcoes.find((o) => o.provider_id === "manual_manual" && o.price_type === "flat")
if (!padrao) throw new Error('não achei a opção fixa "Entrega Padrão" (manual_manual, flat)')
const daSuperfrete = (id) => opcoes.find((o) => o.provider_id === PROVIDER && o.data?.id === id)

if (!aplicar) {
  console.log(`(simulação — nada gravado; repita com --aplicar${desfazer ? " --desfazer" : ""} quando o dono disser "pode aplicar")`)
  process.exit(0)
}

const regras = (naLoja) => [
  { attribute: "enabled_in_store", value: naLoja ? "true" : "false", operator: "eq" },
  { attribute: "is_return", value: "false", operator: "eq" },
]
const definirNaLoja = async (opcao, naLoja) => {
  // O update de shipping option troca o conjunto de regras: mando as duas sempre, reaproveitando o id.
  const atuais = Object.fromEntries((opcao.rules ?? []).map((r) => [r.attribute, r.id]))
  await post(`/admin/shipping-options/${opcao.id}`, { rules: regras(naLoja).map((r) => (atuais[r.attribute] ? { id: atuais[r.attribute], ...r } : r)) })
  console.log(`✓ ${opcao.name}: na loja = ${naLoja ? "sim" : "não"}`)
}

if (!temProvider) {
  await post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] })
  console.log(`✓ provider ${PROVIDER} vinculado a ${local.name}`)
}
for (const s of SERVICOS) {
  const existente = daSuperfrete(s.id)
  if (existente) {
    await definirNaLoja(existente, !desfazer)
  } else if (!desfazer) {
    await post("/admin/shipping-options", {
      name: s.nome,
      service_zone_id: zona.id,
      shipping_profile_id: padrao.shipping_profile_id,
      provider_id: PROVIDER,
      price_type: "calculated",
      data: { id: s.id },
      type: { label: s.nome, description: s.descricao, code: s.id },
      prices: [],
      rules: regras(true),
    })
    console.log(`✓ criada: ${s.nome}`)
  }
}
await definirNaLoja(padrao, desfazer)
console.log(desfazer ? "✓ desfeito: só a Entrega Padrão está na loja." : "✓ SuperFrete ligada: Mini Envios, PAC e SEDEX na loja; Entrega Padrão desligada.")
