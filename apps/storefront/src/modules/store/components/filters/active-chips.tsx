"use client"

import { hasActiveFilters, type FilterState } from "@lib/util/catalog-filters"
import { useFilterNavigation } from "./use-filter-navigation"
import { useListingTransition } from "./listing-transition"

export default function ActiveChips({ filters }: { filters: FilterState }) {
  const nav = useFilterNavigation(filters)
  const { implicitSize } = useListingTransition()
  if (!hasActiveFilters(filters)) return null
  const chip = (label: string, onRemove: () => void, key: string, testId = "active-chip") => (
    <button key={key} onClick={onRemove} className="h-8 px-3 rounded-full bg-eclat-areia/60 text-xs flex items-center gap-2" data-testid={testId}>
      {label} <span aria-hidden>×</span>
    </button>
  )
  return (
    <div className="flex flex-wrap gap-2 items-center mb-6" data-testid="active-chips">
      {filters.tamanho.map((t) =>
        implicitSize && t === implicitSize
          ? chip(`Seu tamanho: ${t}`, nav.clearImplicitSize, `t-${t}`, "implicit-size-chip")
          : chip(`Tamanho ${t}`, () => nav.toggleList("tamanho", t), `t-${t}`)
      )}
      {filters.cor.map((c) => chip(c, () => nav.toggleList("cor", c), `c-${c}`))}
      {filters.preco && chip(`R$ ${filters.preco.min ?? "0"} – ${filters.preco.max ?? "∞"}`, () => nav.setPrice(null), "preco")}
      {filters.disponivel && chip("Só disponíveis", () => nav.setDisponivel(false), "disp")}
      <button onClick={nav.clear} className="text-xs underline text-eclat-grafite/70 ml-2">Limpar tudo</button>
    </div>
  )
}
