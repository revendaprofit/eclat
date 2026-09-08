"use client"

import { clx } from "@modules/common/components/ui"
import { findOption, sizeValues, variantFor, variantLabel } from "@lib/util/pdp-variants"
import { useProductSelection } from "../product-selection"

export default function SizeSelect({ disabled, onNotify }: { disabled?: boolean; onNotify?: (variantId: string, label: string) => void }) {
  const { product, selection, setValue, color, sizeAvail } = useProductSelection()
  const opt = findOption(product, "Tamanho")
  if (!opt) return null
  const corOpt = findOption(product, "Cor")
  return (
    <div className="flex flex-col gap-y-2" data-testid="size-select">
      <div className="flex items-center justify-between">
        <span className="text-sm">Tamanho{selection[opt.id] ? <>: <strong>{selection[opt.id]}</strong></> : null}</span>
        <a href="#medidas" className="text-xs underline text-eclat-grafite/70">Guia de medidas</a>
      </div>
      <div className="flex flex-wrap gap-2">
        {sizeValues(product).map((s) => {
          const esgotado = color !== null && sizeAvail[s] === false
          const on = selection[opt.id] === s
          const variant = corOpt && color ? variantFor(product, { ...selection, [opt.id]: s, [corOpt.id]: color }) : null
          return (
            <div key={s} className="flex flex-col items-center gap-1">
              <button
                type="button"
                disabled={disabled || esgotado}
                onClick={() => setValue(opt.id, s)}
                aria-pressed={on}
                className={clx("h-10 min-w-[44px] px-3 rounded border text-sm", on ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "border-eclat-pedra/60 hover:border-eclat-grafite", esgotado && "line-through text-eclat-grafite/40 hover:border-eclat-pedra/60 cursor-not-allowed")}
                data-testid={`size-${s}`}
              >
                {s}
              </button>
              {esgotado && variant && onNotify && (
                <button type="button" onClick={() => onNotify(variant.id, variantLabel(product, variant))} className="text-[11px] underline text-eclat-terracota">Avise-me</button>
              )}
            </div>
          )
        })}
      </div>
      {color === null && corOpt && <p className="text-xs text-eclat-grafite/60">Escolha a cor para ver os tamanhos disponíveis.</p>}
    </div>
  )
}
