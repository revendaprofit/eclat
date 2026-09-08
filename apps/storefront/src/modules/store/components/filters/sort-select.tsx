"use client"

import { SORT_KEYS, SORT_LABELS, type FilterState, type SortKey } from "@lib/util/catalog-filters"
import { useFilterNavigation } from "./use-filter-navigation"

export default function SortSelect({ filters }: { filters: FilterState }) {
  const nav = useFilterNavigation(filters)
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-eclat-grafite/60">Ordenar</span>
      <select value={filters.ordenar} onChange={(e) => nav.setSort(e.target.value as SortKey)} className="h-9 border border-eclat-pedra/60 rounded px-2 bg-white" data-testid="sort-select">
        {SORT_KEYS.map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
      </select>
    </label>
  )
}
