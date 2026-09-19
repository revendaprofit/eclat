// F4 do frete (spec 2026-09-18-frete-superfrete-design.md §6) — liga a SuperFrete na região Brasil.
// Só pela Admin API — Medusa é a fonte da verdade. Idempotente.
//
// Sem argumentos: só MOSTRA o estado (não grava nada).
//   node ativar-superfrete.mjs
// Grava (só com "pode aplicar" do dono):
//   node ativar-superfrete.mjs --aplicar              → cria/liga Mini, PAC e SEDEX; desliga a "Entrega Padrão" por último
//   node ativar-superfrete.mjs --aplicar --desfazer   → religa a "Entrega Padrão" PRIMEIRO; só depois desliga as três
//                                                        (nunca deixa a loja sem nenhuma opção de frete ativa no meio do caminho)
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD.
//
// Se houver mais de um candidato para o local com envio, a zona de serviço ou a opção fixa
// "Entrega Padrão", o script não adivinha: lista os candidatos e para (nada é gravado).
const PROVIDER = "superfrete_superfrete"
const SERVICOS = [
  { id: "mini", nome: "Econômica (Mini Envios)", descricao: "Entrega econômica pelos Correios." },
  { id: "pac", nome: "PAC", descricao: "Entrega padrão pelos Correios." },
  { id: "sedex", nome: "SEDEX", descricao: "Entrega expressa pelos Correios." },
]

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
  const { token } = await j(await fetch(`${URL}/auth/user/emailpass`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: EMAIL, password: SENHA }) }))
  const h = { "content-type": "application/json", authorization: `Bearer ${token}` }
  const get = async (caminho) => j(await fetch(`${URL}${caminho}`, { headers: h }))
  const post = async (caminho, corpo) => j(await fetch(`${URL}${caminho}`, { method: "POST", headers: h, body: JSON.stringify(corpo) }))
  const listar = (rotulo, itens) => itens.map((i) => `  · ${rotulo(i)}`).join("\n")

  // --- local com envio configurado (aborta se 0 ou mais de 1 candidato) ---
  const locais = (await get("/admin/stock-locations?limit=20&fields=id,name,*fulfillment_providers,*fulfillment_sets,*fulfillment_sets.service_zones")).stock_locations
  const candidatosLocal = locais.filter((l) => (l.fulfillment_sets ?? []).some((s) => s.type === "shipping"))
  if (candidatosLocal.length === 0) {
    console.error('✗ não encontrei nenhum local (stock location) com um conjunto de envio ("fulfillment set" do tipo shipping) configurado.')
    process.exitCode = 1
    return
  }
  if (candidatosLocal.length > 1) {
    console.error(`✗ mais de um local tem conjunto de envio configurado — não vou adivinhar qual usar:\n${listar((l) => `${l.name} (${l.id})`, candidatosLocal)}`)
    process.exitCode = 1
    return
  }
  const local = candidatosLocal[0]

  // --- conjunto de envio e zona de serviço dentro do local (aborta se ambíguo) ---
  const conjuntosEnvio = local.fulfillment_sets.filter((s) => s.type === "shipping")
  if (conjuntosEnvio.length > 1) {
    console.error(`✗ o local ${local.name} tem mais de um conjunto de envio — não vou adivinhar qual usar:\n${listar((s) => `${s.name} (${s.id})`, conjuntosEnvio)}`)
    process.exitCode = 1
    return
  }
  const zonas = conjuntosEnvio[0].service_zones ?? []
  if (zonas.length === 0) {
    console.error(`✗ o conjunto de envio de ${local.name} não tem nenhuma zona de serviço configurada.`)
    process.exitCode = 1
    return
  }
  if (zonas.length > 1) {
    console.error(`✗ mais de uma zona de serviço no conjunto de envio de ${local.name} — não vou adivinhar qual usar:\n${listar((z) => `${z.name} (${z.id})`, zonas)}`)
    process.exitCode = 1
    return
  }
  const zona = zonas[0]
  const temProvider = (local.fulfillment_providers ?? []).some((p) => p.id === PROVIDER)
  console.log(`Local ${local.name} (${local.id}) — zona ${zona.name} — provider ${PROVIDER}: ${temProvider ? "vinculado" : "NÃO vinculado"}`)

  const registrados = (await get("/admin/fulfillment-providers?limit=50")).fulfillment_providers.map((p) => p.id)
  if (!registrados.includes(PROVIDER)) {
    console.error(`✗ ${PROVIDER} não está registrado no backend — SUPERFRETE_TOKEN está no Railway e o deploy foi feito?`)
    process.exitCode = 1
    return
  }

  const opcoes = (await get(`/admin/shipping-options?limit=100&service_zone_id=${zona.id}&fields=id,name,provider_id,price_type,data,shipping_profile_id,*rules`)).shipping_options
  const ligada = (o) => (o.rules ?? []).some((r) => r.attribute === "enabled_in_store" && String(r.value) === "true")
  for (const o of opcoes) console.log(`  · ${o.name} [${o.provider_id}, ${o.price_type}] na loja: ${ligada(o) ? "sim" : "não"}`)

  // --- opção fixa "Entrega Padrão" (aborta se 0 ou mais de 1 candidata) ---
  const candidatasPadrao = opcoes.filter((o) => o.provider_id === "manual_manual" && o.price_type === "flat")
  if (candidatasPadrao.length === 0) {
    console.error('✗ não encontrei a opção fixa "Entrega Padrão" (provider manual_manual, tipo flat) nessa zona.')
    process.exitCode = 1
    return
  }
  if (candidatasPadrao.length > 1) {
    console.error(`✗ mais de uma opção fixa (manual_manual, flat) na zona — não vou adivinhar qual é a "Entrega Padrão":\n${listar((o) => `${o.name} (${o.id})`, candidatasPadrao)}`)
    process.exitCode = 1
    return
  }
  const padrao = candidatasPadrao[0]
  const daSuperfrete = (id) => opcoes.find((o) => o.provider_id === PROVIDER && o.data?.id === id)

  if (!aplicar) {
    console.log(`(simulação — nada gravado; repita com --aplicar${desfazer ? " --desfazer" : ""} quando o dono disser "pode aplicar")`)
    return
  }

  // Regras iniciais de uma opção SuperFrete recém-criada (não há nada a preservar ainda).
  const regrasIniciais = () => [
    { attribute: "enabled_in_store", operator: "eq", value: "true" },
    { attribute: "is_return", operator: "eq", value: "false" },
  ]
  // Liga/desliga "na loja" preservando TODAS as outras regras da opção como estão (mesmo id,
  // attribute, operator, value) — o update do Medusa substitui o conjunto de regras pelo que for
  // enviado, então reenviamos as que já existem e só trocamos o valor de enabled_in_store.
  const definirNaLoja = async (opcao, naLoja) => {
    const existentes = opcao.rules ?? []
    const semEnabled = existentes.filter((r) => r.attribute !== "enabled_in_store")
    const enabledAtual = existentes.find((r) => r.attribute === "enabled_in_store")
    const regraEnabled = enabledAtual
      ? { id: enabledAtual.id, attribute: "enabled_in_store", operator: enabledAtual.operator, value: naLoja ? "true" : "false" }
      : { attribute: "enabled_in_store", operator: "eq", value: naLoja ? "true" : "false" }
    const regrasFinais = [...semEnabled.map((r) => ({ id: r.id, attribute: r.attribute, operator: r.operator, value: r.value })), regraEnabled]
    if (!existentes.some((r) => r.attribute === "is_return")) {
      regrasFinais.push({ attribute: "is_return", operator: "eq", value: "false" })
    }
    await post(`/admin/shipping-options/${opcao.id}`, { rules: regrasFinais })
    console.log(`✓ ${opcao.name}: na loja = ${naLoja ? "sim" : "não"}`)
  }
  const criarOpcao = async (s) => {
    await post("/admin/shipping-options", {
      name: s.nome,
      service_zone_id: zona.id,
      shipping_profile_id: padrao.shipping_profile_id,
      provider_id: PROVIDER,
      price_type: "calculated",
      data: { id: s.id },
      type: { label: s.nome, description: s.descricao, code: s.id },
      prices: [],
      rules: regrasIniciais(),
    })
    console.log(`✓ criada: ${s.nome}`)
  }

  if (!desfazer) {
    // Aplicar: liga o provider e as três opções SuperFrete primeiro; só desliga a Entrega Padrão
    // por último — nunca existe um instante em que a loja fica sem nenhuma opção ativa.
    if (!temProvider) {
      await post(`/admin/stock-locations/${local.id}/fulfillment-providers`, { add: [PROVIDER] })
      console.log(`✓ provider ${PROVIDER} vinculado a ${local.name}`)
    }
    for (const s of SERVICOS) {
      const existente = daSuperfrete(s.id)
      if (existente) await definirNaLoja(existente, true)
      else await criarOpcao(s)
    }
    await definirNaLoja(padrao, false)
    console.log("✓ SuperFrete ligada: Mini Envios, PAC e SEDEX na loja; Entrega Padrão desligada.")
  } else {
    // Desfazer: religa a Entrega Padrão PRIMEIRO; só depois desliga as três SuperFrete — mesma
    // garantia na direção contrária.
    await definirNaLoja(padrao, true)
    for (const s of SERVICOS) {
      const existente = daSuperfrete(s.id)
      if (existente) await definirNaLoja(existente, false)
    }
    console.log("✓ desfeito: só a Entrega Padrão está na loja.")
  }
}

main().catch((e) => {
  console.error(`✗ ${e.message}`)
  process.exitCode = 1
})
