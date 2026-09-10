import "server-only"
import crypto from "crypto"
import { headers, cookies } from "next/headers"
import { HttpTypes } from "@medusajs/types"
import { getSiteContent } from "@lib/data/site-content"
import { getBaseURL } from "@lib/util/env"
import { Marketing } from "./config"

// API de Conversões da Meta (server-side). Envia eventos direto do servidor,
// com o MESMO event_id do Pixel do navegador → deduplicação (event_id).
// Segredo (token) só via env META_CAPI_TOKEN; Pixel ID vem do Cockpit (site_content).

const sha256 = (s: string) =>
  crypto.createHash("sha256").update(s.trim().toLowerCase()).digest("hex")

type CapiOpts = {
  eventId: string
  value?: number
  currency?: string
  contents?: { id: string; quantity: number; item_price?: number }[]
  email?: string
  sourceUrl?: string
  // Código da aba "Eventos de teste" do Gerenciador de Eventos (ex.: TEST12345).
  // Quando presente, o evento aparece só lá e não conta como conversão real.
  testEventCode?: string
}

// Resultado resumido da chamada à Meta — NUNCA inclui o token.
export type CapiResult = {
  configured: { pixel: boolean; token: boolean }
  sent: boolean
  status?: number
  meta?: unknown // resposta bruta da Graph API (events_received, fbtrace_id, error)
}

async function sendCapi(eventName: string, opts: CapiOpts): Promise<CapiResult> {
  const token = process.env.META_CAPI_TOKEN
  const marketing = await getSiteContent<Marketing>("marketing")
  const pixel = marketing?.meta_pixel_id
  const configured = { pixel: Boolean(pixel), token: Boolean(token) }
  if (!token || !pixel) return { configured, sent: false }

  const h = await headers()
  const c = await cookies()
  const ua = h.get("user-agent") || undefined
  const ip =
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    h.get("x-real-ip") ||
    undefined
  const fbp = c.get("_fbp")?.value
  const fbc = c.get("_fbc")?.value

  const user_data: Record<string, unknown> = {}
  if (opts.email) user_data.em = [sha256(opts.email)]
  if (fbp) user_data.fbp = fbp
  if (fbc) user_data.fbc = fbc
  if (ip) user_data.client_ip_address = ip
  if (ua) user_data.client_user_agent = ua

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: opts.eventId,
        action_source: "website",
        event_source_url: opts.sourceUrl,
        user_data,
        custom_data: {
          currency: opts.currency,
          value: opts.value,
          contents: opts.contents,
        },
      },
    ],
    ...(opts.testEventCode ? { test_event_code: opts.testEventCode } : {}),
  }

  try {
    const r = await fetch(
      `https://graph.facebook.com/v19.0/${pixel}/events?access_token=${token}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        cache: "no-store",
        signal: AbortSignal.timeout(3000),
      }
    )
    const meta = await r.json().catch(() => undefined)
    return { configured, sent: r.ok, status: r.status, meta }
  } catch {
    /* nunca quebra a página */
    return { configured, sent: false }
  }
}

// Diagnóstico: dispara um PageView de teste para a aba "Eventos de teste" do
// Gerenciador de Eventos. Sem código de teste, só informa se pixel/token existem.
export async function fireCapiTest(testEventCode?: string): Promise<CapiResult> {
  if (!testEventCode) {
    const token = process.env.META_CAPI_TOKEN
    const marketing = await getSiteContent<Marketing>("marketing")
    return {
      configured: { pixel: Boolean(marketing?.meta_pixel_id), token: Boolean(token) },
      sent: false,
    }
  }
  return sendCapi("PageView", {
    eventId: `capi_test_${Date.now()}`,
    sourceUrl: `${getBaseURL()}/`,
    testEventCode,
  })
}

// Dispara Purchase server-side a partir do pedido concluído.
/* eslint-disable @typescript-eslint/no-explicit-any */
export async function fireCapiPurchase(order: HttpTypes.StoreOrder) {
  await sendCapi("Purchase", {
    eventId: `purchase_${order.id}`,
    value: typeof (order as any).total === "number" ? (order as any).total : undefined,
    currency: (order.currency_code || "brl").toUpperCase(),
    email: (order as any).email,
    sourceUrl: `${getBaseURL()}/`,
    contents: (order.items || []).map((it: any) => ({
      id: it.variant_sku || it.product_id || it.id,
      quantity: it.quantity,
      item_price: typeof it.unit_price === "number" ? it.unit_price : undefined,
    })),
  })
}
