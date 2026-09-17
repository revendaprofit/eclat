// F0 da Parte 4 — prova de conceito do Mercado Pago em SANDBOX, via Orders API.
// Spec: docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md (§14, F0)
// A aplicação "eclat-checkout" foi criada com "Tipo de API: Orders" — o Checkout Transparente
// hoje processa por /v1/orders, não mais por /v1/payments (marcado "legacy" na doc do MP).
// A credencial de TESTE dessa aplicação começa com APP_USR (confirmado na doc oficial), não TEST-.
//
// Uso (a partir de apps/backend, com as credenciais DE TESTE no .env):
//   node --env-file=.env f0-mercadopago.mjs            → tudo
//   node f0-mercadopago.mjs assinatura                 → só o autoteste da assinatura (sem credenciais)
//
// Lê do ambiente: MERCADOPAGO_ACCESS_TOKEN, MERCADOPAGO_PUBLIC_KEY (a mesma chave pública da
// vitrine). Nunca imprime segredo. Cartões e cardholders abaixo são os de TESTE públicos da
// documentação do MP (checkout-bricks/.../cartões-de-teste, atualizados em 17/09/2026).
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto"

const API = "https://api.mercadopago.com"
const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
const PUBLIC_KEY = process.env.MERCADOPAGO_PUBLIC_KEY
const CPF_TESTE = "12345678909"
const VALOR = "199.90" // a Orders API recebe valor em string decimal, não número

const ok = (s, v) => console.log(`✓ ${s}`, v ?? "")
const aviso = (s, v) => console.log(`! ${s}`, v ?? "")
const centavos = (reais) => Math.round(Number(reais) * 100)

// ── Assinatura do webhook (mesma regra vai para src/modules/mercadopago/assinatura.ts) ──
// Manifesto: id:{data.id, em minúsculas};request-id:{x-request-id};ts:{ts};  → HMAC-SHA256.
// Confirmado na doc oficial (checkout-api-orders/notifications) igual para o evento "order".
export function assinaturaValida({ xSignature, xRequestId, dataId, segredo }) {
  if (!xSignature || !segredo || !dataId) return false
  const partes = Object.fromEntries(
    xSignature.split(",").map((p) => p.trim().split("=").map((s) => s.trim()))
  )
  if (!partes.ts || !partes.v1) return false
  const manifesto = `id:${String(dataId).toLowerCase()};request-id:${xRequestId ?? ""};ts:${partes.ts};`
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex")
  const a = Buffer.from(esperado, "hex")
  const b = Buffer.from(partes.v1, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}

function autotesteAssinatura() {
  const segredo = "segredo-de-mentira"
  const ts = "1742505638683"
  // id de order é alfanumérico maiúsculo (ORD01...) — o teste usa um exemplo assim para provar
  // que o lowercase é aplicado antes do HMAC, como a doc exige.
  const dataId = "ORD01M28P44G5FG8RJPM579EH56FV"
  const v1 = createHmac("sha256", segredo)
    .update(`id:${dataId.toLowerCase()};request-id:req-1;ts:${ts};`)
    .digest("hex")
  const base = { xSignature: `ts=${ts},v1=${v1}`, xRequestId: "req-1", dataId, segredo }
  const casos = [
    ["assinatura correta passa", assinaturaValida(base), true],
    ["maiúsculas no id não quebram (lowercase interno)", assinaturaValida({ ...base, dataId: dataId.toUpperCase() }), true],
    ["segredo errado falha", assinaturaValida({ ...base, segredo: "outro" }), false],
    ["id adulterado falha", assinaturaValida({ ...base, dataId: "ORD999" }), false],
    ["header ausente falha", assinaturaValida({ ...base, xSignature: undefined }), false],
    ["v1 truncado falha", assinaturaValida({ ...base, xSignature: `ts=${ts},v1=${v1.slice(0, 10)}` }), false],
  ]
  for (const [nome, obtido, esperado] of casos) {
    if (obtido !== esperado) {
      console.error(`✗ assinatura: ${nome}`)
      process.exit(1)
    }
    ok(`assinatura: ${nome}`)
  }
}

// ── Chamadas ao MP ──
async function mp(metodo, caminho, corpo, { idempotencia } = {}) {
  const res = await fetch(`${API}${caminho}`, {
    method: metodo,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
      ...(idempotencia ? { "x-idempotency-key": idempotencia } : {}),
    },
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  })
  const dados = await res.json().catch(() => ({}))
  return { status: res.status, dados }
}

const resumoOrder = (o) => ({
  id: o.id,
  status: o.status,
  status_detail: o.status_detail,
  processing_mode: o.processing_mode,
  pagamento: o.transactions?.payments?.[0] && {
    id: o.transactions.payments[0].id,
    status: o.transactions.payments[0].status,
    status_detail: o.transactions.payments[0].status_detail,
    metodo: o.transactions.payments[0].payment_method?.id,
    parcelas: o.transactions.payments[0].payment_method?.installments,
  },
})

async function conferirCredenciais() {
  const { status, dados } = await mp("GET", "/users/me")
  if (status !== 200) {
    console.error(`✗ credenciais: HTTP ${status}`, dados?.message ?? "")
    process.exit(1)
  }
  ok("credenciais válidas", { site: dados.site_id, conta_de_teste: dados.tags?.includes("test_user") ?? false })
  if (dados.site_id !== "MLB") aviso("a conta não é do Brasil (MLB) — Pix não vai funcionar")
}

async function provarPix() {
  const chave = randomUUID()
  const corpo = {
    type: "online",
    processing_mode: "automatic",
    external_reference: `f0-pix-${chave}`,
    total_amount: VALOR,
    payer: { email: "test_user_br@testuser.com", first_name: "APRO", identification: { type: "CPF", number: CPF_TESTE } },
    transactions: { payments: [{ amount: VALOR, payment_method: { id: "pix", type: "bank_transfer" } }] },
  }
  const { status, dados } = await mp("POST", "/v1/orders", corpo, { idempotencia: chave })
  if (status >= 300) return aviso(`Pix: HTTP ${status}`, JSON.stringify(dados).slice(0, 400))
  const pm = dados.transactions?.payments?.[0]?.payment_method ?? {}
  ok("Pix criado", {
    ...resumoOrder(dados),
    tem_copia_e_cola: !!pm.qr_code,
    tem_qr_base64: !!pm.qr_code_base64,
    tem_ticket_url: !!pm.ticket_url,
  })
  if (!pm.qr_code_base64) aviso("qr_code_base64 veio vazio (achado do findings.md — conferir se é só no sandbox)")

  // Idempotência: repetir a MESMA chave deveria devolver a MESMA order — é o que protege a
  // reautorização que o Medusa faz quando o webhook chega (ver findings.md).
  const de_novo = await mp("POST", "/v1/orders", corpo, { idempotencia: chave })
  de_novo.dados.id === dados.id
    ? ok("idempotência: mesma chave → mesma order", dados.id)
    : aviso("idempotência: a mesma chave criou OUTRA order (achado — a doc de Orders não garante isso explicitamente)", {
        primeira: dados.id, segunda: de_novo.dados?.id, http: de_novo.status,
      })

  // Buscar a tarifa: a Orders API não mostra fee_details na order — testamos se o GET do
  // payment individual (id PAY...) traz. Se não trouxer aqui, muda a §9 da spec.
  const payId = dados.transactions?.payments?.[0]?.id
  if (payId) {
    const pagamento = await mp("GET", `/v1/payments/${payId}`)
    const tarifa = pagamento.dados?.fee_details
    tarifa
      ? ok("tarifa via GET /v1/payments/{id}", { fee_details: tarifa, tarifa_centavos: tarifa.reduce((t, f) => t + centavos(f.amount), 0) })
      : aviso("GET /v1/payments/{id} não trouxe fee_details (pix pendente ainda não tem tarifa calculada — normal)")
  }

  // Achado da F0 (17/09): cancelar uma order Pix em processing_mode automatic dá 422 — a
  // transação já nasce "em andamento" do lado do banco. Por isso não tentamos cancelar no
  // fluxo real (spec §6.6): geramos uma order nova e deixamos a antiga expirar sozinha.
  const cancel = await mp("POST", `/v1/orders/${dados.id}/cancel`, {}, randomUUID())
  cancel.status < 300
    ? aviso("cancelar order Pix funcionou — contraria o achado registrado, revisar a spec")
    : ok("cancelar order Pix falha como esperado (422 — não usamos /cancel no fluxo real)", cancel.status)
}

async function tokenDeCartao(titular) {
  // Em produção quem faz isto é o Brick, no navegador. Aqui simulamos com a chave pública.
  // Cartão de teste atual (doc 17/09/2026): Mastercard 5480 8328 0103 3311.
  const res = await fetch(`${API}/v1/card_tokens?public_key=${PUBLIC_KEY}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      card_number: "5480832801033311",
      security_code: "123",
      expiration_month: 11,
      expiration_year: 2030,
      cardholder: { name: titular, identification: { type: "CPF", number: CPF_TESTE } },
    }),
  })
  const dados = await res.json().catch(() => ({}))
  if (!dados.id) {
    aviso(`token de cartão (${titular}): HTTP ${res.status}`, dados?.message ?? "")
    return null
  }
  return dados.id
}

// O nome do titular escolhe o desfecho no sandbox (tabela atual da doc do MP):
// APRO aprova, OTHE recusa por erro geral, CONT fica pendente, CALL pede autorização ao banco,
// FUND recusa por saldo insuficiente, SECU por código de segurança, EXPI por vencimento,
// FORM por erro no formulário.
async function provarCartao(titular, parcelas = 1) {
  const token = await tokenDeCartao(titular)
  if (!token) return null
  const chave = randomUUID()
  const { status, dados } = await mp("POST", "/v1/orders", {
    type: "online",
    processing_mode: "automatic",
    external_reference: `f0-cartao-${titular}-${chave}`,
    total_amount: VALOR,
    payer: { email: "test_user_br@testuser.com", first_name: titular, identification: { type: "CPF", number: CPF_TESTE } },
    transactions: { payments: [{ amount: VALOR, payment_method: { id: "master", type: "credit_card", token, installments: parcelas } }] },
  }, { idempotencia: chave })
  if (status >= 300 && !dados.id) {
    aviso(`cartão ${titular}: HTTP ${status}`, JSON.stringify(dados).slice(0, 400))
    return null
  }
  ok(`cartão ${titular} ${parcelas}x`, resumoOrder(dados))
  return dados
}

async function provarEstorno(order) {
  const { status, dados } = await mp("POST", `/v1/orders/${order.id}/refund`, {}, { idempotencia: randomUUID() })
  status < 300
    ? ok("estorno total", { order_id: dados.id ?? order.id, status: dados.status })
    : aviso(`estorno: HTTP ${status}`, dados?.message ?? "")
}

// ── Roteiro ──
autotesteAssinatura()
if (process.argv[2] === "assinatura") process.exit(0)

if (!TOKEN || !PUBLIC_KEY) {
  console.error("✗ faltam MERCADOPAGO_ACCESS_TOKEN e/ou MERCADOPAGO_PUBLIC_KEY no ambiente (credenciais de TESTE — prefixo APP_USR).")
  process.exit(1)
}
await conferirCredenciais()
await provarPix()
const aprovado = await provarCartao("APRO", 1)
await provarCartao("APRO", 4)
for (const titular of ["OTHE", "CONT", "CALL", "FUND", "SECU"]) await provarCartao(titular)
if (aprovado?.status === "processed") await provarEstorno(aprovado)
console.log("\nF0 (lado Mercado Pago) concluída. Copie os resultados para findings.md.")
