"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { DEFAULT_FILTERS, isSelected, serializeFilters, toggleValue, type FilterState, type PriceRange, type SortKey } from "@lib/util/catalog-filters"
import { useListingTransition } from "./listing-transition"

type FilterType = "tamanho" | "cor" | "preco" | "disponivel" | "ordenar" | "limpar"

function track(filter_type: FilterType, filter_value: string) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: "filter_apply", filter_type, filter_value })
  } catch {}
}

// Navegação dos filtros: toda mudança vira URL (compartilhável, botão voltar funciona).
export function useFilterNavigation(filters: FilterState) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startTransition } = useListingTransition()

  const replace = useCallback(
    (next: FilterState, type: FilterType, value: string) => {
      const params = new URLSearchParams(serializeFilters({ ...next, pagina: 1 }))
      const q = searchParams.get("q")
      if (q) params.set("q", q)
      const qs = params.toString()
      track(type, value)
      startTransition(() => {
        router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
      })
    },
    [router, pathname, searchParams, startTransition]
  )

  return {
    filters,
    toggleList: (field: "tamanho" | "cor", value: string) => {
      const has = isSelected(filters[field], value, field)
      const list = toggleValue(filters[field], value, field)
      replace({ ...filters, [field]: list }, field, `${has ? "-" : "+"}${value}`)
    },
    setPrice: (preco: PriceRange | null) => replace({ ...filters, preco }, "preco", preco ? `${preco.min ?? ""}-${preco.max ?? ""}` : ""),
    setDisponivel: (on: boolean) => replace({ ...filters, disponivel: on }, "disponivel", on ? "1" : "0"),
    setSort: (ordenar: SortKey) => replace({ ...filters, ordenar }, "ordenar", ordenar),
    clear: () => replace({ ...DEFAULT_FILTERS, ordenar: filters.ordenar }, "limpar", ""),
  }
}
