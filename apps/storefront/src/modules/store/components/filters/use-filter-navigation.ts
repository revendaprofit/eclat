"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { DEFAULT_FILTERS, isSelected, listingHref, toggleValue, type FilterState, type PriceRange, type SortKey } from "@lib/util/catalog-filters"
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
  const { startTransition, implicitSize } = useListingTransition()

  const replace = useCallback(
    (next: FilterState, type: FilterType, value: string) => {
      track(type, value)
      const href = listingHref(pathname, next, implicitSize, searchParams.get("q"))
      startTransition(() => router.push(href, { scroll: false }))
    },
    [router, pathname, searchParams, startTransition, implicitSize]
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
    // chip "Seu tamanho: M": some sem virar filtro explícito (opt-out via listingHref)
    clearImplicitSize: () => replace({ ...filters, tamanho: [] }, "tamanho", "-pref"),
  }
}
