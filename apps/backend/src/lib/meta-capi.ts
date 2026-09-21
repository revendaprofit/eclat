// API de Conversões da Meta pelo BACKEND — evento Purchase no `order.placed`.
// Por que aqui e não só na vitrine: com Pix o pedido nasce pelo webhook do Mercado Pago, e a cliente
// que pagou no app do banco muitas vezes não volta para a página de confirmação — o Purchase da
// vitrine (pixel + CAPI na renderização da página) nunca sai. Aqui ele sai sempre.
// Deduplicação: mesmo `event_id` da vitrine (`purchase_<id do pedido>`) — a Meta conta um só.
// Segredo só por env (`META_CAPI_TOKEN`, o mesmo valor da vitrine); o pixel vem do Cockpit
// (site_content "marketing"). Sem os dois, não faz nada.
import crypto from "crypto"
import { sbSelect, supabaseConfigured } from "./supabase"

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex")
const soDigitos = (s: string) => s.replace(/\D/g, "")

export type PedidoParaMeta = {
  id: string
  email?: string | null
  total?: unknown
  currency_code?: string | null
  metadata?: Record<string, unknown> | null
  items?: Array<{ variant_id?: string | null; product_id?: string | null; id: string; quantity?: unknown; unit_price?: unknown }> | null
  shipping_address?: { phone?: string | null; first_name?: string | null; last_name?: string | null; city?: string | null; province?: string | null; postal_code?: string | null } | null
}

const texto = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined)
const numero = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(v)
  return Number.isFinite(n) ? n : undefined
}

// Telefone no formato da Meta: só dígitos, com DDI. Número brasileiro sem DDI ganha o 55.
export function telefoneParaMeta(bruto: string): string | undefined {
  const d = soDigitos(bruto)
  if (d.length < 10) return undefined
  return d.length <= 11 ? `55${d}` : d
}

/** Corpo do evento (puro, testável). `agora` em ms. */
export function montarEventoDeCompra(pedido: PedidoParaMeta, lojaUrl: string, agora: number) {
  const meta = pedido.metadata ?? {}
  const end = pedido.shipping_address ?? {}
  const user_data: Record<string, unknown> = { country: [sha256("br")] }
  const email = texto(pedido.email)
  if (email) user_data.em = [sha256(email.toLowerCase())]
  const fone = telefoneParaMeta(texto(end.phone) ?? "")
  if (fone) user_data.ph = [sha256(fone)]
  const hashNorm = (v: unknown) => {
    const t = texto(v)
    return t ? [sha256(t.toLowerCase().normalize("NFD").replace(/[^a-z]/g, ""))] : undefined
  }
  const fn = hashNorm(end.first_name)
  const ln = hashNorm(end.last_name)
  const ct = hashNorm(end.city)
  if (fn) user_data.fn = fn
  if (ln) user_data.ln = ln
  if (ct) user_data.ct = ct
  const cep = soDigitos(texto(end.postal_code) ?? "")
  if (cep) user_data.zp = [sha256(cep)]
  const fbp = texto(meta.meta_fbp)
  const fbc = texto(meta.meta_fbc)
  const ua = texto(meta.meta_ua)
  if (fbp) user_data.fbp = fbp
  if (fbc) user_data.fbc = fbc
  if (ua) user_data.client_user_agent = ua

  const contents = (pedido.items ?? []).map((it) => ({
    id: it.variant_id || it.product_id || it.id, // = g:id do feed (variant.id)
    quantity: numero(it.quantity) ?? 1,
    item_price: numero(it.unit_price),
  }))

  return {
    event_name: "Purchase",
    event_time: Math.floor(agora / 1000),
    event_id: `purchase_${pedido.id}`,
    // "website" exige o user agent do navegador; sem ele (sem aceite de cookies) o evento vai como
    // gerado pelo sistema — conta a venda, só não casa com o clique.
    action_source: ua ? "website" : "system_generated",
    ...(ua ? { event_source_url: `${lojaUrl}/` } : {}),
    user_data,
    custom_data: {
      currency: (pedido.currency_code || "brl").toUpperCase(),
      value: numero(pedido.total),
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      order_id: pedido.id,
    },
  }
}

async function pixelDoCockpit(): Promise<string | undefined> {
  if (!supabaseConfigured()) return undefined
  const linhas = await sbSelect<{ value: { meta_pixel_id?: string } | null }>(
    "site_content",
    "key=eq.marketing&select=value&limit=1"
  )
  return texto(linhas[0]?.value?.meta_pixel_id)
}

/** Envia o Purchase. Devolve um resumo para o log — NUNCA o token. */
export async function enviarCompraParaMeta(pedido: PedidoParaMeta, lojaUrl: string): Promise<string> {
  const token = process.env.META_CAPI_TOKEN
  if (!token) return "desligado (sem META_CAPI_TOKEN)"
  const pixel = await pixelDoCockpit()
  if (!pixel) return "desligado (sem pixel no Cockpit)"

  const r = await fetch(`https://graph.facebook.com/v19.0/${pixel}/events?access_token=${token}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: [montarEventoDeCompra(pedido, lojaUrl, Date.now())] }),
    signal: AbortSignal.timeout(5000),
  })
  if (r.ok) return "enviado"
  const corpo = (await r.json().catch(() => null)) as { error?: { message?: string } } | null
  return `recusado ${r.status}: ${corpo?.error?.message ?? "sem detalhe"}`
}
