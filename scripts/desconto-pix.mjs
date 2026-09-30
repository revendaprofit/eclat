// Cria a promoção do desconto no Pix (padrão PIX5, 5% nas peças). Sem --aplicar, só MOSTRA o que faria.
//
//   node scripts/desconto-pix.mjs
//   node scripts/desconto-pix.mjs --aplicar
//
// Decisões do dono (2026-09-30): 5% no Pix, SOMA com cupom e com o Benefício Conjunto, NÃO conta para o
// frete grátis. Como isso funciona (nada aqui, é tudo do backend — procure por `ehCodigoPix`):
// - o gancho `conjunto-cupom` IGNORA este código: ele não ganha a regra de exclusão do conjunto;
// - o gancho `conjunto-marcar` não o põe na disputa "maior desconto por peça";
// - a base do frete grátis não desconta o valor dele;
// - cobrança de CARTÃO com o código no carrinho é recusada (middleware desconto-pix).
// Sem campanha nem teto de usos: vale para toda compra no Pix. A vitrine só aplica o código quando
// site_content "condicoes".pix_percentual > 0 — o percentual lá precisa ser o MESMO daqui.
// ORDEM: `railway up` do backend com essas regras ANTES de rodar este script com --aplicar.
//
// Ambiente: MEDUSA_ADMIN_URL, MEDUSA_ADMIN_EMAIL, MEDUSA_ADMIN_PASSWORD (opcional: DESCONTO_PIX_CODIGO).
const args = process.argv.slice(2)
const APLICAR = args.includes("--aplicar")
const CODIGO = (process.env.DESCONTO_PIX_CODIGO || "PIX5").trim().toUpperCase()
const PERCENTUAL = 5

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
  console.log(`= ${CODIGO} já existe (${existente.id}, ${existente.status}) — nada a fazer.`)
  process.exit(0)
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

console.log(`${APLICAR ? "→" : "(simulação)"} ${CODIGO}: ${PERCENTUAL}% nas peças, pagamento no Pix, sem teto de usos`)
if (!APLICAR) {
  console.log("  promoção:", JSON.stringify(promocao))
  console.log('  repita com --aplicar quando o dono disser "pode aplicar" (depois do railway up do backend).')
  process.exit(0)
}

const { promotion } = await j(
  await fetch(`${URL}/admin/promotions`, { method: "POST", headers: h, body: JSON.stringify(promocao) })
)
console.log(`  ✓ ${promotion.code} (${promotion.id}, ${promotion.status})`)

const conferido = await j(await fetch(`${URL}/admin/promotions/${promotion.id}`, { headers: h }))
const regras = conferido.promotion?.application_method?.target_rules ?? []
console.log(
  "  regra de exclusão do conjunto:",
  regras.some((r) => r.attribute === "items.conjunto_desconto")
    ? "PRESENTE — o backend no ar ainda não tem a exceção do Pix. Remova a regra ou faça o railway up e recrie."
    : "ausente ✓ (soma com o conjunto)"
)
