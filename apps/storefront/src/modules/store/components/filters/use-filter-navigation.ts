"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback } from "react"
import { DEFAULT_FILTERS, explicitFilters, isSelected, listingHref, shouldOptOut, toggleValue, type FilterState, type PriceRange, type SortKey } from "@lib/util/catalog-filters"
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
// Ruling 7: ações fora de "tamanho" partem do estado SEM o tamanho implícito (`base`) — o
// implícito nunca vira explícito só porque outro filtro mudou. O opt-out `?tamanho=` só é
// gravado ao remover o tamanho (ação "tamanho"/"limpar") ou quando a URL atual já está em
// opt-out (preserva ao mexer em outros filtros).
export function useFilterNavigation(filters: FilterState) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { startTransition, implicitSize } = useListingTransition()
  const optedOut = searchParams.get("tamanho") === ""
  const base = explicitFilters(filters, implicitSize)

  const replace = useCallback(
    (next: FilterState, type: FilterType, value: string) => {
      track(type, value)
      const action = type === "tamanho" ? "tamanho" : type === "limpar" ? "limpar" : "outro"
      const href = listingHref(pathname, next, shouldOptOut(next, action, implicitSize, optedOut), searchParams.get("q"))
      startTransition(() => router.push(href, { scroll: false }))
    },
    [router, pathname, searchParams, startTransition, implicitSize, optedOut]
  )

  return {
    filters,
    toggleList: (field: "tamanho" | "cor", value: string) => {
      const from = field === "tamanho" ? filters : base
      const has = isSelected(from[field], value, field)
      const list = toggleValue(from[field], value, field)
      replace({ ...from, [field]: list }, field, `${has ? "-" : "+"}${value}`)
    },
    setPrice: (preco: PriceRange | null) => replace({ ...base, preco }, "preco", preco ? `${preco.min ?? ""}-${preco.max ?? ""}` : ""),
    setDisponivel: (on: boolean) => replace({ ...base, disponivel: on }, "disponivel", on ? "1" : "0"),
    setSort: (ordenar: SortKey) => replace({ ...base, ordenar }, "ordenar", ordenar),
    clear: () => replace({ ...DEFAULT_FILTERS, ordenar: filters.ordenar }, "limpar", ""),
    // chip "Seu tamanho: M": some sem virar filtro explícito (opt-out via listingHref)
    clearImplicitSize: () => replace({ ...filters, tamanho: [] }, "tamanho", "-pref"),
  }
}
