import type { CardBadge } from "@lib/util/product-card-data"

const LABEL: Record<Exclude<CardBadge, null>, string> = { esgotado: "Esgotado", ultimas: "Últimas peças", promo: "Promoção", novo: "Novo" }

export default function Badge({ badge, percent }: { badge: CardBadge; percent?: string }) {
  if (!badge) return null
  const text = badge === "promo" && percent ? `-${percent}%` : LABEL[badge]
  return (
    <span className={`absolute top-2 left-2 z-10 text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded ${badge === "esgotado" ? "bg-eclat-grafite/80 text-eclat-luz" : "bg-eclat-luz/90 text-eclat-grafite"}`} data-testid={`badge-${badge}`}>
      {text}
    </span>
  )
}
