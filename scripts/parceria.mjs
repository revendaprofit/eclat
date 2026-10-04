// Parcerias com influencers: cria (ou importa) o cupom no Medusa e cadastra a parceira no Supabase (tabela `parceria`).
// Sem --aplicar, só MOSTRA o que faria. Desenho: docs/superpowers/specs/2026-09-25-parcerias-influencer-design.md.
//
//   node scripts/parceria.mjs --codigo PATY10 --nome "Paty" --instagram paty --desconto 10 --comissao 5 [--aplicar]
//   node scripts/parceria.mjs --importar ERIKA20 --nome "Erika" --comissao 0 [--aplicar]   (cupom que já existe no Medusa)
//   node scripts/parceria.mjs --desativar PATY10 [--aplicar]
//   node scripts/parceria.mjs --listar
//
// Regras (decisões do dono, 2026-09-25):
// - cupom de parceria: percentual só nas PEÇAS (frete nunca), SEM teto de usos (promoção sem campanha), não é cupom de
//   primeira compra; nunca soma com o Benefício Conjunto (gancho `conjunto-cupom` + regra do maior desconto);
// - comissão: % sobre o valor das peças efetivamente pago (o cálculo é do Cockpit; aqui só se guarda o percentual);
// - os NOME20 antigos (20%, 1 uso, sem comissão) ficam como estão e entram no controle via --importar.
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// (os mesmos nomes de apps/cockpit/.env.local; para produção, sobrescrever MEDUSA_ADMIN_URL com a URL do Railway).
const args = process.argv.slice(2)
const valorDe = (nome, padrao = null) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : padrao
}
const APLICAR = args.includes("--aplicar")
const LISTAR = args.includes("--listar")
const CODIGO = (valorDe("codigo") || valorDe("importar") || valorDe("desativar") || "").trim().toUpperCase()
const IMPORTAR = args.includes("--importar")
const DESATIVAR = args.includes("--desativar")
const NOME = valorDe("nome")
const DESCONTO = Number(valorDe("desconto", "10"))
const COMISSAO = Number(valorDe("comissao", IMPORTAR ? "0" : "5"))

const { MEDUSA_ADMIN_URL: URL, MEDUSA_ADMIN_EMAIL: EMAIL, MEDUSA_ADMIN_PASSWORD: SENHA } = process.env
const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !EMAIL || !SENHA || !SB_URL || !SB_KEY) {
  console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD, NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.")
  process.exit(1)
}
if (!LISTAR && !CODIGO) {
  console.error('✗ use: --codigo PATY10 --nome "Paty" [--instagram x] [--whatsapp 5531...] [--desconto 10] [--comissao 5] [--aplicar]')
  console.error("       --importar ERIKA20 --nome \"Erika\" [--comissao 0] [--aplicar] | --desativar CODIGO [--aplicar] | --listar")
  process.exit(1)
}
if (!LISTAR && !DESATIVAR && !NOME) {
  console.error("✗ falta --nome (nome da parceira).")
  process.exit(1)
}
for (const [rotulo, n, min] of [["desconto", DESCONTO, 1], ["comissao", COMISSAO, 0]]) {
  if (!Number.isInteger(n) || n < min || n > 100) {
    console.error(`✗ --${rotulo} precisa ser inteiro entre ${min} e 100.`)
    process.exit(1)
  }
}

const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 400)}`)
  return d
}
const sb = (caminho, init = {}) =>
  fetch(`${SB_URL}/rest/v1/${caminho}`, {
    ...init,
    headers: { apikey: SB_KEY, authorization: `Bearer ${SB_KEY}`, "content-type": "application/json", ...(init.headers || {}) },
  })

// ---------- listar ----------
if (LISTAR) {
  const linhas = await j(await sb("parceria?select=*&order=criado_em"))
  if (!linhas.length) console.log("(nenhuma parceria cadastrada)")
  for (const p of linhas) {
    console.log(
      `${p.ativa ? "●" : "○"} ${p.codigo.padEnd(12)} ${p.nome.padEnd(16)} cliente ${p.desconto_percentual}%  comissão ${p.comissao_percentual}%  ${
        p.medusa_campaign_id ? "com teto" : "sem teto"
      }  ${p.instagram ? "@" + p.instagram : ""}`
    )
  }
  process.exit(0)
}

// ---------- Medusa ----------
const { token } = await j(
  await fetch(`${URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  })
)
const h = { authorization: `Bearer ${token}`, "content-type": "application/json" }
const existente = (
  await j(await fetch(`${URL}/admin/promotions?code=${CODIGO}&fields=id,code,status,campaign_id,application_method.value,application_method.type,application_method.target_type`, { headers: h }))
).promotions?.[0]

// ---------- desativar ----------
if (DESATIVAR) {
  if (!existente) {
    console.error(`✗ cupom ${CODIGO} não existe no Medusa.`)
    process.exit(1)
  }
  console.log(`${APLICAR ? "→" : "(simulação)"} desativar ${CODIGO}: promoção ${existente.id} → inactive; parceria.ativa → false`)
  if (!APLICAR) process.exit(0)
  await j(await fetch(`${URL}/admin/promotions/${existente.id}`, { method: "POST", headers: h, body: JSON.stringify({ status: "inactive" }) }))
  await j(await sb(`parceria?codigo=eq.${CODIGO}`, { method: "PATCH", body: JSON.stringify({ ativa: false }), headers: { prefer: "return=representation" } }))
  console.log("  ✓ desativado nos dois lugares")
  process.exit(0)
}

// ---------- importar (cupom já existe) ou criar ----------
let promotion_id, campaign_id, desconto = DESCONTO
if (IMPORTAR) {
  if (!existente) {
    console.error(`✗ cupom ${CODIGO} não existe no Medusa; para criar, use --codigo em vez de --importar.`)
    process.exit(1)
  }
  if (existente.application_method?.type !== "percentage" || existente.application_method?.target_type !== "items") {
    console.error(`✗ ${CODIGO} não é cupom percentual de itens (${existente.application_method?.type}/${existente.application_method?.target_type}).`)
    process.exit(1)
  }
  promotion_id = existente.id
  campaign_id = existente.campaign_id || null
  desconto = Number(existente.application_method.value)
  console.log(`${APLICAR ? "→" : "(simulação)"} importar ${CODIGO}: ${desconto}% (${existente.status}), ${campaign_id ? "com teto (campanha " + campaign_id + ")" : "sem teto"}, comissão ${COMISSAO}%`)
} else {
  if (existente) {
    console.error(`✗ cupom ${CODIGO} já existe no Medusa (${existente.id}); use --importar para cadastrar a parceria.`)
    process.exit(1)
  }
  const promocao = {
    code: CODIGO,
    type: "standard",
    is_automatic: false,
    status: "active",
    application_method: { type: "percentage", target_type: "items", allocation: "across", value: DESCONTO, currency_code: "brl" },
  }
  console.log(`${APLICAR ? "→" : "(simulação)"} criar ${CODIGO}: ${DESCONTO}% nas peças, sem teto de usos, comissão ${COMISSAO}%`)
  if (APLICAR) {
    const { promotion } = await j(await fetch(`${URL}/admin/promotions`, { method: "POST", headers: h, body: JSON.stringify(promocao) }))
    promotion_id = promotion.id
    campaign_id = null
    const conferido = await j(await fetch(`${URL}/admin/promotions/${promotion.id}`, { headers: h }))
    const regras = conferido.promotion?.application_method?.target_rules ?? []
    console.log(`  ✓ cupom ${promotion.code} (${promotion.id}); exclusão do conjunto: ${regras.some((r) => r.attribute === "items.conjunto_desconto") ? "aplicada ✓" : "NÃO encontrada — conferir o gancho"}`)
  } else {
    console.log("  promoção:", JSON.stringify(promocao))
  }
}

const linha = {
  codigo: CODIGO,
  nome: NOME,
  instagram: (valorDe("instagram") || "").replace(/^@/, "") || null,
  whatsapp: (valorDe("whatsapp") || "").replace(/\D/g, "") || null,
  desconto_percentual: desconto,
  comissao_percentual: COMISSAO,
  medusa_promotion_id: promotion_id || "(criado ao aplicar)",
  medusa_campaign_id: campaign_id ?? null,
  ativa: true,
  notas: valorDe("notas"),
}
console.log("  parceria:", JSON.stringify(linha))
if (!APLICAR) {
  console.log('  repita com --aplicar quando o dono disser "pode aplicar".')
  process.exit(0)
}
const gravada = await j(
  await sb("parceria?on_conflict=codigo", { method: "POST", headers: { prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify(linha) })
)
console.log(`  ✓ parceria ${gravada[0]?.codigo} gravada no Supabase`)
console.log(`\nPara mandar à parceira: código ${CODIGO} — ${desconto}% nas peças para quem usar${COMISSAO ? `; ${COMISSAO}% do valor pago vai para você, fechado todo mês` : ""}.`)
