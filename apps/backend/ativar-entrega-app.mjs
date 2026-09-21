// Liga a "Entrega por aplicativo" na loja (a cliente chama e paga o carro; retirada combinada
// por WhatsApp). Só pela Admin API — Medusa é a fonte da verdade. Idempotente.
//
// Sem argumentos: MOSTRA o estado, não grava nada.
//   node ativar-entrega-app.mjs
// Grava (só com "pode aplicar" do dono):
//   node ativar-entrega-app.mjs --aplicar              → vincula o provider e cria/liga a opção
//   node ativar-entrega-app.mjs --aplicar --desfazer   → tira a opção da loja (não apaga)
//
// A área atendida (Betim + RMBH) é decidida pelo PROVIDER, não por zona de serviço: fora das
// faixas de CEP ele recusa cotar e a opção some sozinha da vitrine.
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD.
const PROVIDER = "entrega-app_entrega-app"
const OPCAO = { id: "app", nome: "Entrega por aplicativo", descricao: "Você chama o carro e combina a retirada por WhatsApp." }

async function main() {
  const URL = process.env.MEDUSA_ADMIN_URL
  const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
  const SENHA = process.env.MEDUSA_ADMIN_PASSWORD
  if (!URL || !EMAIL || !SENHA) {
    console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL e MEDUSA_ADMIN_PASSWORD no ambiente.")
    process.exitCode = 1
    return
  }
  const args = new Set(process.argv.slice(2))
  const aplicar = args.has("--aplicar")
  const desfazer = args.has("--desfazer")

  const j = async (r) => {
    const d = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 300)}`)
    return d
  }
  const { token } = await j(
    await fetch(`${URL}/auth/user/emailpass`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: EMAIL, password: SENHA }),
    })
  )
  const h = { "content-type": "application/json", authorization: `Bearer ${token}` }
  const get = async (caminho) => j(await fetch(`${URL}${caminho}`, { headers: h }))
  const post = async (caminho, corpo) => j(await fetch(`${URL}${caminho}`, { method: "POST", headers: h, body: JSON.stringify(corpo) }))

  const locais = (await get("/admin/stock-locations?limit=20&fields=id,name,*fulfillment_providers,*fulfillment_sets,*fulfillment_sets.service_zones")).stock_locations
  const candidatos = locais.filter((l) => (l.fulfillment_sets ?? []).some((s) => s.type === "shipping"))
  if (candidatos.length !== 1) {
    console.error(`✗ esperava exatamente um local com conjunto de envio; achei ${candidatos.length}. Não vou adivinhar.`)
    process.exitCode = 1
    return
  }
  const local = candidatos[0]
  const zonas = local.fulfillment_sets.filter((s) => s.type === "shipping")[0].service_zones ?? []
  if (zonas.length !== 1) {
    console.error(`✗ esperava exatamente uma zona de serviço; achei ${zonas.length}. Não vou adivinhar.`)
    process.exitCode = 1
    return
  }
  const zona = zonas[0]

  const registrados = (await get("/admin/fulfillment-providers?limit=50")).fulfillment_providers.map((p) => p.id)
  if (!registrados.includes(PROVIDER)) {
    console.error(`✗ ${PROVIDER} não está registrado no backend — o deploy com o módulo novo foi feito?`)
    process.exitCode = 1
    return
  }
  const temProvider = (local.fulfillment_providers ?? []).some((p) => p.id === PROVIDER)

  const opcoes = (await get(`/admin/shipping-options?limit=100&service_zone_id=${zona.id}&fields=id,name,provider_id,price_type,data,shipping_profile_id,*rules`)).shipping_options
  const naLoja = (o) => (o.rules ?? []).some((r) => r.attribute === "enabled_in_store" && String(r.value) === "true")
  const existente = opcoes.find((o) => o.provider_id === PROVIDER)
  const perfil = opcoes.find((o) => o.shipping_profile_id)?.shipping_profile_id

  console.log(`Local ${local.name} — zona ${zona.name} — provider: ${temProvider ? "vinculado" : "NÃO vinculado"}`)
  console.log(`  opção "${OPCAO.nome}": ${existente ? (naLoja(existente) ? "existe e está na loja" : "existe, fora da loja") : "não existe"}`)

  if (!aplicar) {
    console.log(`(simulação — nada gravado; repita com --aplicar${desfazer ? " --desfazer" : ""} quando o dono disser "pode aplicar")`)
    return
  }
  if (!perfil) {
    console.error("✗ não achei o perfil de envio (shipping_profile_id) de nenhuma opção existente.")
    process.exitCode = 1
    return
  }

  const definirNaLoja = async (opcao, ligada) => {
    const existentes = opcao.rules ?? []
    const semEnabled = existentes.filter((r) => r.attribute !== "enabled_in_store")
    const atual = existentes.find((r) => r.attribute === "enabled_in_store")
    const regra = atual
      ? { id: atual.id, attribute: "enabled_in_store", operator: atual.operator, value: ligada ? "true" : "false" }
      : { attribute: "enabled_in_store", operator: "eq", value: ligada ? "true" : "false" }
    const finais = [...semEnabled.map((r) => ({ id: r.id, attribute: r.attribute, operator: r.operator, value: r.value })), regra]
    if (!existentes.some((r) => r.attribute === "is_return")) finais.push({ attribute: "is_return", operator: "eq", value: "false" })
    await post(`/admin/shipping-options/${opcao.id}`, { rules: finais })
    console.log(`✓ ${opcao.name}: na loja = ${ligada ? "sim" : "não"}`)
  }

  if (desfazer) {
    if (existente) await definirNaLoja(existente, false)
    else console.log("= nada a desfazer: a opção não existe.")
    return
  }

  if (!temProvider) {
    await post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] })
    console.log(`✓ provider vinculado a ${local.name}`)
  }
  if (existente) {
    await definirNaLoja(existente, true)
  } else {
    await post("/admin/shipping-options", {
      name: OPCAO.nome,
      service_zone_id: zona.id,
      shipping_profile_id: perfil,
      provider_id: PROVIDER,
      price_type: "calculated", // o provider devolve 0 dentro da área e recusa fora dela
      data: { id: OPCAO.id },
      type: { label: OPCAO.nome, description: OPCAO.descricao, code: OPCAO.id },
      prices: [],
      rules: [
        { attribute: "enabled_in_store", operator: "eq", value: "true" },
        { attribute: "is_return", operator: "eq", value: "false" },
      ],
    })
    console.log(`✓ criada e ligada: ${OPCAO.nome}`)
  }
}

main().catch((e) => {
  console.error("✗", e.message)
  process.exitCode = 1
})
