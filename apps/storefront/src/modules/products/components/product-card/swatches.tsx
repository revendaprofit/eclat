"use client"

import type { CardColor } from "@lib/util/product-card-data"
import { clx } from "@modules/common/components/ui"

const MAX = 5
export default function Swatches({ colors, active, onSelect }: { colors: CardColor[]; active: number; onSelect: (i: number) => void }) {
  if (colors.length <= 1 && !colors[0]?.name) return null
  const shown = colors.slice(0, MAX)
  return (
    <div className="flex items-center gap-1.5 mt-2" data-testid="swatches">
      {shown.map((c, i) => (
        <button
          key={c.name || i}
          type="button"
          onClick={(e) => { e.preventDefault(); onSelect(i) }}
          title={c.name}
          aria-label={`Cor ${c.name}${c.available ? "" : " (esgotada)"}`}
          aria-pressed={i === active}
          className={clx("relative w-5 h-5 rounded-full border border-black/10", i === active && "ring-2 ring-eclat-terracota ring-offset-1")}
          style={c.swatch_url ? { backgroundImage: `url(${c.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: c.hex }}
        >
          {!c.available && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-eclat-grafite/70 text-[14px] leading-none">/</span>}
        </button>
      ))}
      {colors.length > MAX && <span className="text-[11px] text-eclat-grafite/60">+{colors.length - MAX}</span>}
    </div>
  )
}
