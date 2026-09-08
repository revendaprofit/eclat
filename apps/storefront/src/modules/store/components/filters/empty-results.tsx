"use client"

import { usePathname, useSearchParams } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { DEFAULT_FILTERS, listingHref, shouldOptOut, type FilterState } from "@lib/util/catalog-filters"
import { useListingTransition } from "./listing-transition"

// Estado vazio útil (spec §6.3): sempre oferece um caminho de volta. Todo link daqui que termina
// sem tamanho é uma remoção deliberada do tamanho (ação "tamanho" — ruling 7), não uma ação "outro".
export default function EmptyResults({ filters, query }: { filters: FilterState; query?: string }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { implicitSize } = useListingTransition()
  const optedOut = searchParams.get("tamanho") === ""
  const link = (f: FilterState) => listingHref(pathname, f, shouldOptOut(f, "tamanho", implicitSize, optedOut), searchParams.get("q"))
  const partes: string[] = []
  if (filters.tamanho.length) partes.push(`tamanho ${filters.tamanho.join("/")}`)
  if (filters.cor.length) partes.push(`cor ${filters.cor.join("/")}`)
  const semFiltro = partes.length === 0
  return (
    <div className="py-16 text-center flex flex-col items-center gap-4" data-testid="empty-results">
      <p className="font-serif text-2xl text-eclat-grafite">
        {query && semFiltro
          ? <>Não encontramos peças para “{query}”.</>
          : <>Nenhuma peça {partes.length ? `em ${partes.join(" e ")}` : "com esses filtros"}.</>}
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
        {query && (
          <LocalizedClientLink href="/store" className="underline text-eclat-grafite/70">Ver toda a loja</LocalizedClientLink>
        )}
      </div>
    </div>
  )
}
