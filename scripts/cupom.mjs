// Cria um cupom percentual na loja (Medusa Admin API). Sem --aplicar, só MOSTRA o que faria.
//
//   node scripts/cupom.mjs --codigo ERIKA20 --percentual 20 --usos 1
//   node scripts/cupom.mjs --codigo ERIKA20 --percentual 20 --usos 1 --aplicar
//   node scripts/cupom.mjs --codigo PATY10 --percentual 10 --sem-teto --aplicar   (cupom de parceria: sem limite de usos)
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

if (!CODIGO || !Number.isFinite(PERCENTUAL) || PERCENTUAL <= 0 || PERCENTUAL > 100) {
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

const existente = (await j(await fetch(`${URL}/admin/promotions?code=${CODIGO}`, { headers: h }))).promotions?.[0]
if (existente) {
  console.log(`= cupom ${CODIGO} já existe (${existente.id}, ${existente.status}) — nada a fazer.`)
  process.exit(0)
}

const campanha = {
  name: `Cupom ${CODIGO}`,
  campaign_identifier: `cupom-${CODIGO.toLowerCase()}`,
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
console.log(`${APLICAR ? "→" : "(simulação)"} cupom ${CODIGO}: ${PERCENTUAL}% nas peças, ${teto}`)
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
console.log(
  "  regra de exclusão do conjunto:",
  regras.some((r) => r.attribute === "items.conjunto_desconto") ? "aplicada pelo gancho ✓" : "NÃO encontrada — conferir o gancho"
)
