"use client"

import { clx } from "@modules/common/components/ui"
import { resolveColor, type ColorMap } from "@lib/util/colors"
import { colorValues, findOption, firstAvailableVariantId } from "@lib/util/pdp-variants"
import { normalizeColorName } from "@lib/util/colors"
import { useProductSelection } from "../product-selection"

export default function ColorSelect({ colorMap, disabled }: { colorMap: ColorMap; disabled?: boolean }) {
  const { product, selection, setValue, color } = useProductSelection()
  const opt = findOption(product, "Cor")
  if (!opt) return null
  const cores = colorValues(product)
  const atual = color ? resolveColor(colorMap, color).name : null
  return (
    <div className="flex flex-col gap-y-2" data-testid="color-select">
      <span className="text-sm">Cor{atual ? <>: <strong>{atual}</strong></> : null}</span>
      <div className="flex flex-wrap gap-2">
        {cores.map((c) => {
          const r = resolveColor(colorMap, c)
          const on = color !== null && normalizeColorName(color) === normalizeColorName(c)
          const disponivel = firstAvailableVariantId(product, c) !== null
          return (
            <button
              key={c}
              type="button"
              disabled={disabled}
              onClick={() => setValue(opt.id, c)}
              aria-pressed={on}
              aria-label={`Cor ${r.name}${disponivel ? "" : " (esgotada)"}`}
              title={r.name}
              className={clx("relative w-8 h-8 rounded-full border border-black/10", on && "ring-2 ring-eclat-terracota ring-offset-2", !disponivel && "opacity-60")}
              style={r.swatch_url ? { backgroundImage: `url(${r.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: r.hex }}
              data-testid={`color-${c}`}
            >
              {!disponivel && <span aria-hidden className="absolute inset-0 rounded-full bg-[linear-gradient(135deg,transparent_46%,rgba(0,0,0,.55)_48%,rgba(0,0,0,.55)_52%,transparent_54%)]" />}
            </button>
          )
        })}
      </div>
    </div>
  )
}
