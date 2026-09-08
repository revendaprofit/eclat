"use client"

import type { CardColor } from "@lib/util/product-card-data"
import { clx } from "@modules/common/components/ui"
import { FALLBACK_HEX } from "@lib/util/colors"

const MAX = 5
export default function Swatches({ colors, active, onSelect }: { colors: CardColor[]; active: number; onSelect: (i: number) => void }) {
  if (colors.length <= 1 && !colors[0]?.name) return null
  const shown = colors.slice(0, MAX)
  return (
    <div className="flex items-end gap-1.5 mt-2" data-testid="swatches">
      {shown.map((c, i) => (
        <div key={c.name || i} className="flex flex-col items-center gap-0.5">
          <button
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
          {/* Sem hex/swatch: mostra nome (mapa sem hex ou desconhecida) */}
          {!c.swatch_url && (!c.known || c.hex === FALLBACK_HEX) && <span className="text-[8px] text-eclat-grafite/60 leading-none max-w-[32px] text-center truncate">{c.name}</span>}
        </div>
      ))}
      {colors.length > MAX && <span className="text-[11px] text-eclat-grafite/60">+{colors.length - MAX}</span>}
    </div>
  )
}
