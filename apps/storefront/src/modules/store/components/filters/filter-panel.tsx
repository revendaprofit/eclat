"use client"

import { useState } from "react"
import { clx } from "@modules/common/components/ui"
import { hasActiveFilters, type FilterState } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import { resolveColor, type ColorMap } from "@lib/util/colors"
import { useFilterNavigation } from "./use-filter-navigation"

const selected = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase())
const grupo = "text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 mb-3"

export default function FilterPanel({ facets, filters, colorMap, onApplied }: { facets: Facets; filters: FilterState; colorMap: ColorMap; onApplied?: () => void }) {
  const nav = useFilterNavigation(filters)
  const [min, setMin] = useState(filters.preco?.min?.toString() ?? "")
  const [max, setMax] = useState(filters.preco?.max?.toString() ?? "")
  const apply = (fn: () => void) => { fn(); onApplied?.() }

  const faixas = facets.preco
    ? (() => {
        const lo = Math.floor(facets.preco.min), hi = Math.ceil(facets.preco.max)
        if (hi - lo < 20) return []
        const t = Math.round(lo + (hi - lo) / 3), u = Math.round(lo + (2 * (hi - lo)) / 3)
        return [
          { label: `até R$ ${t}`, preco: { min: null, max: t } },
          { label: `R$ ${t + 1}–${u}`, preco: { min: t + 1, max: u } },
          { label: `acima de R$ ${u}`, preco: { min: u + 1, max: null } },
        ]
      })()
    : []

  return (
    <div className="flex flex-col gap-8 text-sm" data-testid="filter-panel">
      {facets.tamanhos.length > 0 && (
        <section>
          <p className={grupo}>Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {facets.tamanhos.map((t) => (
              <button
                key={t.value}
                onClick={() => apply(() => nav.toggleList("tamanho", t.value))}
                className={clx("h-9 min-w-[44px] px-3 rounded-full border text-xs", selected(filters.tamanho, t.value) ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "border-eclat-pedra/60 hover:border-eclat-grafite")}
                data-testid={`filter-tamanho-${t.value}`}
              >
                {t.value} <span className="opacity-60">({t.count})</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {facets.cores.length > 0 && (
        <section>
          <p className={grupo}>Cor</p>
          <ul className="flex flex-col gap-2">
            {facets.cores.map((c) => {
              const r = resolveColor(colorMap, c.name)
              const on = selected(filters.cor, c.name)
              return (
                <li key={c.name}>
                  <button onClick={() => apply(() => nav.toggleList("cor", r.name))} className={clx("flex items-center gap-3 w-full text-left", on && "font-semibold")} data-testid={`filter-cor-${c.name}`}>
                    <span
                      className={clx("w-5 h-5 rounded-full border border-black/10 shrink-0", on && "ring-2 ring-eclat-terracota ring-offset-1")}
                      style={r.swatch_url ? { backgroundImage: `url(${r.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: r.hex }}
                      aria-hidden
                    />
                    <span className="flex-1">{r.name}</span>
                    <span className="text-eclat-grafite/50">{c.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {facets.preco && (
        <section>
          <p className={grupo}>Preço</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {faixas.map((fx) => (
              <button key={fx.label} onClick={() => apply(() => nav.setPrice(fx.preco))} className="text-xs px-3 h-8 rounded-full border border-eclat-pedra/60 hover:border-eclat-grafite">{fx.label}</button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const mi = min.trim() === "" ? null : Math.max(0, Math.round(Number(min)))
              const ma = max.trim() === "" ? null : Math.max(0, Math.round(Number(max)))
              apply(() => nav.setPrice(mi === null && ma === null ? null : { min: mi, max: ma }))
            }}
            className="flex items-center gap-2"
          >
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="de" aria-label="Preço mínimo" className="w-20 h-9 border border-eclat-pedra/60 rounded px-2" />
            <span>–</span>
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="até" aria-label="Preço máximo" className="w-20 h-9 border border-eclat-pedra/60 rounded px-2" />
            <button type="submit" className="h-9 px-3 text-xs uppercase tracking-wider bg-eclat-grafite text-eclat-luz rounded">Aplicar</button>
          </form>
        </section>
      )}
      <section>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={filters.disponivel} onChange={(e) => apply(() => nav.setDisponivel(e.target.checked))} className="accent-eclat-terracota w-4 h-4" data-testid="filter-disponivel" />
          <span>Só disponíveis</span>
        </label>
      </section>
      {hasActiveFilters(filters) && (
        <button onClick={() => apply(nav.clear)} className="self-start text-xs underline text-eclat-grafite/70" data-testid="filter-clear">Limpar tudo</button>
      )}
    </div>
  )
}
