import type { EcommercePayload } from "./track"

// Único ponto de push de eventos de e-commerce no dataLayer (GA4 via GTM).
// Limpa o objeto ecommerce anterior antes de cada evento (boa prática GA4).
export function pushEcommerceEvent(event: string, ecommerce?: EcommercePayload, extra: Record<string, unknown> = {}): void {
  if (typeof window === "undefined") return
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({ event, ...extra, ...(ecommerce ? { ecommerce } : {}) })
  } catch {
    /* noop */
  }
}
