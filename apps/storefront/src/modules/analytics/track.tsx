"use client"

import { useEffect, useRef } from "react"

// Empurra um evento de e-commerce para o dataLayer (consumido pelo GTM → GA4/Meta/Ads).
// Segue o schema GA4 (ecommerce.items, currency, value).
export type GA4Item = {
  item_id?: string
  item_name?: string
  price?: number
  quantity?: number
  item_category?: string
}

export type EcommercePayload = {
  currency?: string
  value?: number
  transaction_id?: string
  items?: GA4Item[]
}

export default function Track({
  event,
  ecommerce,
  eventId,
}: {
  event: string
  ecommerce?: EcommercePayload
  eventId?: string
}) {
  const fired = useRef(false)
  useEffect(() => {
    if (fired.current) return
    fired.current = true
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    // limpa o ecommerce anterior (boa prática GA4)
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({
      event,
      ...(eventId ? { event_id: eventId } : {}),
      ...(ecommerce ? { ecommerce } : {}),
    })
  }, [event, ecommerce, eventId])
  return null
}
