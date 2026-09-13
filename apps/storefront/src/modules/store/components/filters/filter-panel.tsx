"use client"

import { clx } from "@modules/common/components/ui"
import { hasActiveFilters, isSelected, type FilterState } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import { resolveColor, type ColorMap } from "@lib/util/colors"
import { useFilterNavigation } from "./use-filter-navigation"

const grupo = "text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 mb-3"

export default function FilterPanel({ facets, filters, colorMap, onApplied }: { facets: Facets; filters: FilterState; colorMap: ColorMap; onApplied?: () => void }) {
  const nav = useFilterNavigation(filters)
  const apply = (fn: () => void) => { fn(); onApplied?.() }

  // Filtro de faixa de preço retirado da interface a pedido do dono (2026-09-13). O parâmetro `preco`
  // da URL continua aceito (link antigo ainda filtra e a chip ativa permite remover), só não há mais
  // controle para criá-lo aqui.

  return (
    <div className="flex flex-col gap-8 text-sm" data-testid="filter-panel">
      {facets.tamanhos.length > 0 && (
        <section>
          <p className={grupo}>Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {facets.tamanhos.map((t) => {
              const on = isSelected(filters.tamanho, t.value, "tamanho")
              return (
                <button
                  key={t.value}
                  onClick={() => apply(() => nav.toggleList("tamanho", t.value))}
                  aria-pressed={on}
                  className={clx("h-9 min-w-[44px] px-3 rounded-full border text-xs", on ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "border-eclat-pedra/60 hover:border-eclat-grafite")}
                  data-testid={`filter-tamanho-${t.value}`}
                >
                  {t.value} <span className="opacity-60">({t.count})</span>
                </button>
              )
            })}
          </div>
        </section>
      )}
      {facets.cores.length > 0 && (
        <section>
          <p className={grupo}>Cor</p>
          <ul className="flex flex-col gap-2">
            {facets.cores.map((c) => {
              const r = resolveColor(colorMap, c.name)
              const on = isSelected(filters.cor, c.name, "cor")
              return (
                <li key={c.name}>
                  <button onClick={() => apply(() => nav.toggleList("cor", r.name))} aria-pressed={on} className={clx("flex items-center gap-3 w-full text-left", on && "font-semibold")} data-testid={`filter-cor-${c.name}`}>
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
