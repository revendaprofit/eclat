"use client"

import { usePathname } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { DEFAULT_FILTERS, serializeFilters, type FilterState } from "@lib/util/catalog-filters"

// Estado vazio útil (spec §6.3): sempre oferece um caminho de volta.
export default function EmptyResults({ filters }: { filters: FilterState }) {
  const pathname = usePathname()
  const link = (f: FilterState) => {
    const q = serializeFilters({ ...f, pagina: 1 })
    return q ? `${pathname}?${q}` : pathname
  }
  const partes: string[] = []
  if (filters.tamanho.length) partes.push(`tamanho ${filters.tamanho.join("/")}`)
  if (filters.cor.length) partes.push(`cor ${filters.cor.join("/")}`)
  return (
    <div className="py-16 text-center flex flex-col items-center gap-4" data-testid="empty-results">
      <p className="font-serif text-2xl text-eclat-grafite">
        Nenhuma peça {partes.length ? `em ${partes.join(" e ")}` : "com esses filtros"}.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        {filters.cor.length > 0 && (
          <a href={link({ ...filters, cor: [] })} className="underline text-eclat-terracota">Ver em outras cores</a>
        )}
        {filters.tamanho.length > 0 && (
          <a href={link({ ...filters, tamanho: [] })} className="underline text-eclat-terracota">Ver todos os tamanhos</a>
        )}
        <a href={link({ ...DEFAULT_FILTERS, ordenar: filters.ordenar })} className="underline text-eclat-grafite/70">Limpar filtros</a>
        <LocalizedClientLink href="/store?ordenar=novidades" className="underline text-eclat-grafite/70">Ver novidades</LocalizedClientLink>
      </div>
    </div>
  )
}
