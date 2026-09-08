"use client"

import { useState } from "react"
import { addToCart } from "@lib/data/cart"
import type { CardColor, ProductCardData } from "@lib/util/product-card-data"
import { clx } from "@modules/common/components/ui"
import { showToast } from "@modules/common/components/toast"

function pushAddToCart(data: ProductCardData, v: { id: string; size: string | null }, color: string) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({
      event: "add_to_cart",
      ecommerce: {
        currency: (data.price?.currency_code || "brl").toUpperCase(),
        value: data.price?.calculated_price_number,
        items: [{ item_id: v.id, item_name: data.title, price: data.price?.calculated_price_number, quantity: 1, item_variant: [color, v.size].filter(Boolean).join(" / ") }],
      },
    })
  } catch {}
}

// Faixa de tamanhos com adição rápida (spec §7): desktop no hover, mobile via "+".
export default function QuickAdd({ data, color, countryCode, open, onClose }: { data: ProductCardData; color: CardColor; countryCode: string; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches

  async function add(v: CardColor["variants"][number]) {
    if (!v.available || busy) return
    setBusy(v.id)
    try {
      await addToCart({ variantId: v.id, quantity: 1, countryCode })
      pushAddToCart(data, v, color.name)
      if (isMobile()) showToast({ message: `${data.title} ${v.size ?? ""} adicionado à sacola`, action: { label: "Ver sacola", href: "/cart" } })
      onClose()
    } catch {
      showToast({ message: "Não foi possível adicionar. Tente de novo." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className={clx(
        "absolute inset-x-0 bottom-0 z-10 bg-eclat-luz/95 backdrop-blur px-2 py-2 transition-opacity",
        open ? "opacity-100" : "opacity-0 pointer-events-none small:group-hover:opacity-100 small:group-hover:pointer-events-auto"
      )}
      data-testid="quick-add"
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-eclat-grafite/60 mb-1 text-center">Adicionar rápido</p>
      <div className="flex justify-center gap-1.5 flex-wrap">
        {color.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={!v.available || busy !== null}
            onClick={() => add(v)}
            className={clx("h-8 min-w-[36px] px-2 text-xs rounded border", v.available ? "border-eclat-grafite hover:bg-eclat-grafite hover:text-eclat-luz" : "border-eclat-pedra/50 text-eclat-grafite/40 line-through cursor-not-allowed")}
            data-testid={`quick-add-${v.size ?? "unico"}`}
          >
            {busy === v.id ? "…" : v.size ?? "Único"}
          </button>
        ))}
      </div>
    </div>
  )
}
