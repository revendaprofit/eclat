import type { ReactNode } from "react"
import { listProductsFiltered, type ListingScope } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getColorMap } from "@lib/data/colors"
import { getConjuntosDaListagem, getElegibilidade } from "@lib/data/conjuntos"
import { getBaseURL } from "@lib/util/env"
import { hasActiveFilters, serializeFilters, type FilterState } from "@lib/util/catalog-filters"
import { entryKey } from "@lib/util/listagem-cores"
import { hrefConjunto } from "@lib/util/conjuntos"
import CardConjunto from "@modules/conjuntos/components/card-conjunto"
import ProductPreview from "@modules/products/components/product-preview"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import Breadcrumb, { type Crumb } from "@modules/common/components/breadcrumb"
import { Pagination } from "@modules/store/components/pagination"
import EmptyResults from "@modules/store/components/filters/empty-results"
import FilterPanel from "@modules/store/components/filters/filter-panel"
import ListingToolbar from "@modules/store/components/filters/listing-toolbar"
import { ListingTransitionProvider } from "@modules/store/components/filters/listing-transition"
import PendingGrid from "@modules/store/components/filters/pending-grid"
import Track from "@modules/analytics/track"
import { conjuntosToItemList, entriesToItemList } from "@modules/analytics/items"

// Listagem única (loja, categoria, coleção): cabeçalho + ferramentas + filtros + grade.
// Toolbar/painel/gaveta ficam FORA de qualquer boundary com key — precisam manter identidade
// estável entre navegações de filtro (senão a gaveta mobile fecha e os rascunhos de preço somem).
// O feedback de "carregando" vem do ListingTransitionProvider (useTransition), não de um
// remount via Suspense key.
export default async function ProductListing({
  filters,
  scope,
  countryCode,
  listName,
  header,
  breadcrumb,
  query,
  implicitSize,
}: {
  filters: FilterState
  scope: ListingScope
  countryCode: string
  listName: string
  header?: ReactNode
  breadcrumb?: Crumb[]
  query?: string
  implicitSize?: string | null
}) {
  const region = await getRegion(countryCode)
  if (!region) return null
  const colorMap = await getColorMap()
  // Selo "Forma conjunto" (spec §7.3): predicado calculado UMA vez por listagem, aplicado por
  // card — nunca uma chamada por produto (ver `getElegibilidade`). Em paralelo com a listagem:
  // as duas leituras são independentes e a sequencial somava as duas latências.
  const [result, elegivel] = await Promise.all([
    listProductsFiltered({ filters, scope, countryCode }),
    getElegibilidade(),
  ])
  const base = getBaseURL()
  // Conjuntos montados dentro da grade (vitrine com mais opções, decisão do dono 14/09/2026): só
  // sem filtros ativos (filtro é sobre peças) e fora da busca, depois do último card de produto
  // (última página). Não entram na contagem de "peças".
  const mostrarConjuntos =
    result.conjuntosNaListagem && !scope.q && !hasActiveFilters(filters) && result.count > 0 && result.pagina === result.totalPages
  const conjuntos = mostrarConjuntos
    ? await getConjuntosDaListagem(result.scopeProductIds, countryCode, result.cardsPorCor)
    : []
  const listNameConjuntos = `${listName}: conjuntos`

  return (
    <div className="content-container py-6" data-testid="category-container">
      {breadcrumb && <Breadcrumb items={breadcrumb} countryCode={countryCode} />}
      {header}
      <ListingTransitionProvider implicitSize={implicitSize ?? null}>
        <ListingToolbar count={result.count} total={result.total} filters={filters} facets={result.facets} colorMap={colorMap} />
        <div className="flex flex-col small:flex-row small:items-start gap-8">
          <aside id="filtros" className="hidden small:block small:w-[250px] shrink-0">
            <FilterPanel facets={result.facets} filters={filters} colorMap={colorMap} />
          </aside>
          <PendingGrid className="w-full">
            {result.count === 0 ? (
              <EmptyResults filters={filters} query={query} />
            ) : (
              <>
                <ItemListJsonLd
                  name={listName}
                  items={[
                    ...result.entries
                      .filter((e) => e.product.handle)
                      .map((e) => ({
                        name: e.cor ? `${e.product.title ?? ""} ${e.cor}` : e.product.title ?? "",
                        url: `${base}/${countryCode}/products/${e.product.handle}${e.cor ? `?cor=${encodeURIComponent(e.cor)}` : ""}`,
                      })),
                    ...conjuntos.map((c) => ({
                      name: c.cor ? `Conjunto ${c.nome} ${c.cor}` : `Conjunto ${c.nome}`,
                      url: `${base}/${countryCode}${hrefConjunto(c)}`,
                    })),
                  ]}
                />
                {/* key por estado de filtro: Track não tem estado local a preservar, então continua
                    remontando para refazer o disparo de view_item_list a cada mudança. */}
                <Track key={`${listName}|${serializeFilters(filters)}`} event="view_item_list" ecommerce={entriesToItemList(result.entries, listName)} />
                {conjuntos.length > 0 && (
                  <Track key={`${listNameConjuntos}|${serializeFilters(filters)}`} event="view_item_list" ecommerce={conjuntosToItemList(conjuntos, listNameConjuntos)} />
                )}
                <ul className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8" data-testid="products-list">
                  {result.entries.map((e) => (
                    <li key={entryKey(e)}>
                      <ProductPreview
                        product={e.product}
                        cor={e.cor}
                        region={region}
                        listName={listName}
                        formaConjunto={elegivel(e.product.id, e.product.collection_id ?? null, (e.product.categories ?? []).map((c) => c.id))}
                      />
                    </li>
                  ))}
                  {conjuntos.map((c) => (
                    <li key={`conjunto|${c.handle}|${c.cor ?? ""}`}>
                      <CardConjunto card={c} listName={listNameConjuntos} />
                    </li>
                  ))}
                </ul>
                {result.totalPages > 1 && <Pagination page={result.pagina} totalPages={result.totalPages} data-testid="product-pagination" />}
              </>
            )}
          </PendingGrid>
        </div>
      </ListingTransitionProvider>
    </div>
  )
}
