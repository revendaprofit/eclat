// Cria um cupom percentual na loja (Medusa Admin API). Sem --aplicar, só MOSTRA o que faria.
//
//   node scripts/cupom.mjs --codigo ERIKA20 --percentual 20 --usos 1
//   node scripts/cupom.mjs --codigo ERIKA20 --percentual 20 --usos 1 --aplicar
//   node scripts/cupom.mjs --codigo PATY10 --percentual 10 --sem-teto --aplicar   (cupom de parceria: sem limite de usos)
//   node scripts/cupom.mjs --codigo ALANA20 --percentual 20 --usos 20 --embaixador --validade 2027-10-08 --aplicar
//   node scripts/cupom.mjs --listar 20   (só LÊ: cupons cujo código termina em "20", com a configuração de cada um)
//
// Regras que valem sozinhas, sem nada aqui:
// - o cupom alcança só as PEÇAS (nunca o frete): `target_type: "items"`;
// - o gancho `conjunto-cupom` acrescenta a regra de exclusão do Benefício Conjunto na criação;
// - por peça vale o MAIOR desconto entre cupom e conjunto (gancho `conjunto-marcar`);
// - o pedido mínimo da loja (R$ 150 em peças) é do checkout, não do cupom.
// - código que começa com BEMVINDA é cupom de PRIMEIRA COMPRA: além do teto de usos, só vale para CPF sem pedido anterior
//   (apps/backend/src/modules/cupom-primeira-compra). Qualquer outro código não tem trava por cliente.
// - `--sem-teto` (decisão do dono, 2026-09-25, cupons de parceria com influencer): a promoção nasce SEM campanha,
//   logo sem limite de usos. O controle de vendas/comissão por cupom é do Cockpit (specs/2026-09-25-parcerias-influencer).
//
// - `--embaixador` (dono, 2026-10-08): a campanha nasce com identificador `embaixador-<código>`. Esse cupom SOMA com o
//   Benefício Conjunto (R$ 299 → R$ 239,20) e o carrinho com ele não ganha presente (apps/backend/src/modules/embaixador).
//   Exige campanha: não combina com `--sem-teto`.
// - `--validade AAAA-MM-DD`: a campanha termina no fim desse dia (horário de Brasília). Exige campanha.
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD.
const args = process.argv.slice(2)
const valorDe = (nome, padrao = null) => {
  const i = args.indexOf(`--${nome}`)
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith("--") ? args[i + 1] : padrao
}
const APLICAR = args.includes("--aplicar")
const CODIGO = (valorDe("codigo") || "").trim().toUpperCase()
const PERCENTUAL = Number(valorDe("percentual"))
// USOS = quantas vezes o cupom pode ser usado NO TOTAL, por qualquer pessoa (decisão do dono,
// 2026-09-20: nada de cupom preso a cliente). Esgotado o limite, o Medusa recusa o código.
const USOS = Number(valorDe("usos", "1"))
const SEM_TETO = args.includes("--sem-teto")
const EMBAIXADOR = args.includes("--embaixador")
const VALIDADE = valorDe("validade")
const LISTAR = args.includes("--listar") ? (valorDe("listar") ?? "").trim().toUpperCase() : null

if (LISTAR === null && (EMBAIXADOR || VALIDADE) && SEM_TETO) {
  console.error("✗ --embaixador e --validade precisam de campanha: não use com --sem-teto.")
  process.exit(1)
}
if (VALIDADE && !/^\d{4}-\d{2}-\d{2}$/.test(VALIDADE)) {
  console.error("✗ --validade no formato AAAA-MM-DD")
  process.exit(1)
}

if (LISTAR === null && (!CODIGO || !Number.isFinite(PERCENTUAL) || PERCENTUAL <= 0 || PERCENTUAL > 100)) {
  console.error("✗ use: --codigo ERIKA20 --percentual 20 [--usos 1 | --sem-teto] [--aplicar]")
  process.exit(1)
}

const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const SENHA = process.env.MEDUSA_ADMIN_PASSWORD
if (!URL || !EMAIL || !SENHA) {
  console.error("✗ defina MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL e MEDUSA_ADMIN_PASSWORD no ambiente.")
  process.exit(1)
}

const j = async (r) => {
  const d = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(`HTTP ${r.status} ${r.url}: ${JSON.stringify(d).slice(0, 400)}`)
  return d
}
const { token } = await j(
  await fetch(`${URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: SENHA }),
  })
)
const h = { authorization: `Bearer ${token}`, "content-type": "application/json" }

if (LISTAR !== null) {
  const campos = "code,status,campaign.campaign_identifier,campaign.starts_at,campaign.ends_at,campaign.budget.limit,campaign.budget.used,application_method.type,application_method.value,application_method.target_type,application_method.target_rules.attribute,application_method.target_rules.values.value"
  const { promotions = [] } = await j(await fetch(`${URL}/admin/promotions?limit=500&fields=${campos}`, { headers: h }))
  const achados = promotions.filter((p) => (p.code ?? "").toUpperCase().endsWith(LISTAR)).sort((a, b) => a.code.localeCompare(b.code))
  console.log(`${achados.length} cupom(ns) terminando em "${LISTAR}":`)
  for (const p of achados) {
    const am = p.application_method ?? {}
    const c = p.campaign
    const exclui = (am.target_rules ?? []).some((r) => r.attribute === "items.conjunto_desconto")
    console.log(
      `  ${p.code.padEnd(14)} ${p.status.padEnd(8)} ${am.type === "percentage" ? am.value + "%" : am.type + " " + am.value} ${am.target_type}` +
        ` | usos ${c?.budget ? `${c.budget.used ?? 0}/${c.budget.limit}` : "sem teto"}` +
        ` | validade ${c?.ends_at ? c.ends_at.slice(0, 10) : "—"}` +
        ` | campanha ${c?.campaign_identifier ?? "—"}` +
        ` | conjunto: ${exclui ? "não soma (maior desconto)" : "SOMA"}`
    )
  }
  process.exit(0)
}

const existente = (await j(await fetch(`${URL}/admin/promotions?code=${CODIGO}`, { headers: h }))).promotions?.[0]
if (existente) {
  console.log(`= cupom ${CODIGO} já existe (${existente.id}, ${existente.status}) — nada a fazer.`)
  process.exit(0)
}

const campanha = {
  name: `Cupom ${CODIGO}`,
  campaign_identifier: `${EMBAIXADOR ? "embaixador" : "cupom"}-${CODIGO.toLowerCase()}`,
  ...(VALIDADE ? { starts_at: new Date().toISOString(), ends_at: `${VALIDADE}T23:59:59-03:00` } : {}),
  // Uso ÚNICO (ou N usos) no total: o limite é da campanha, não do cliente. Assim o cupom vale
  // já na sacola — o limite por cliente (`use_by_attribute`) exigiria saber quem é a cliente, e
  // na sacola ainda não há e-mail nem login (achado de 2026-09-20 em produção).
  budget: { type: "usage", limit: USOS },
}
const promocao = {
  code: CODIGO,
  type: "standard",
  is_automatic: false,
  status: "active",
  application_method: {
    type: "percentage",
    target_type: "items", // só as peças; frete nunca entra
    allocation: "across",
    value: PERCENTUAL,
    currency_code: "brl",
  },
}

const teto = SEM_TETO ? "sem teto de usos" : `${USOS} uso(s) no total`
const extras = [EMBAIXADOR ? "EMBAIXADOR (soma com o conjunto, sem presente)" : null, VALIDADE ? `até ${VALIDADE}` : null].filter(Boolean)
console.log(`${APLICAR ? "→" : "(simulação)"} cupom ${CODIGO}: ${PERCENTUAL}% nas peças, ${teto}${extras.length ? ", " + extras.join(", ") : ""}`)
if (!APLICAR) {
  if (!SEM_TETO) console.log("  campanha:", JSON.stringify(campanha))
  console.log("  promoção:", JSON.stringify(promocao))
  console.log('  repita com --aplicar quando o dono disser "pode aplicar".')
  process.exit(0)
}

let campaign_id
if (SEM_TETO) {
  console.log("  (sem campanha: cupom sem limite de usos)")
} else {
  const { campaign } = await j(
    await fetch(`${URL}/admin/campaigns`, { method: "POST", headers: h, body: JSON.stringify(campanha) })
  )
  campaign_id = campaign.id
  console.log(`  ✓ campanha ${campaign.id} (limite ${USOS} uso(s) no total)`)
}

const { promotion } = await j(
  await fetch(`${URL}/admin/promotions`, {
    method: "POST",
    headers: h,
    body: JSON.stringify(campaign_id ? { ...promocao, campaign_id } : promocao),
  })
)
console.log(`  ✓ cupom ${promotion.code} (${promotion.id}, ${promotion.status})`)

const conferido = await j(await fetch(`${URL}/admin/promotions/${promotion.id}`, { headers: h }))
const regras = conferido.promotion?.application_method?.target_rules ?? []
const temExclusao = regras.some((r) => r.attribute === "items.conjunto_desconto")
if (EMBAIXADOR) {
  console.log("  soma com o conjunto:", temExclusao ? "NÃO — a regra de exclusão foi aplicada; conferir o backend" : "sim, sem regra de exclusão ✓")
} else {
  console.log("  regra de exclusão do conjunto:", temExclusao ? "aplicada pelo gancho ✓" : "NÃO encontrada — conferir o gancho")
}
