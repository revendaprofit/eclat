import type { ReactNode } from "react"
import { Suspense } from "react"
import { HttpTypes } from "@medusajs/types"
import { listProductsFiltered, type ListingScope } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getColorMap } from "@lib/data/colors"
import { getBaseURL } from "@lib/util/env"
import { serializeFilters, type FilterState } from "@lib/util/catalog-filters"
import type { ColorMap } from "@lib/util/colors"
import ProductPreview from "@modules/products/components/product-preview"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import { Pagination } from "@modules/store/components/pagination"
import EmptyResults from "@modules/store/components/filters/empty-results"
import FilterPanel from "@modules/store/components/filters/filter-panel"
import ListingToolbar from "@modules/store/components/filters/listing-toolbar"
import SkeletonProductGrid from "@modules/skeletons/templates/skeleton-product-grid"
import Track from "@modules/analytics/track"
import { productsToItemList } from "@modules/analytics/items"

// Listagem única (loja, categoria, coleção): cabeçalho + ferramentas + filtros + grade.
export default async function ProductListing({
  filters,
  scope,
  countryCode,
  listName,
  header,
}: {
  filters: FilterState
  scope: ListingScope
  countryCode: string
  listName: string
  header?: ReactNode
}) {
  const region = await getRegion(countryCode)
  if (!region) return null
  // colorMap não depende do filtro — busca fora do Suspense, junto com a região.
  const colorMap = await getColorMap()

  return (
    <div className="content-container py-6" data-testid="category-container">
      {header}
      {/* key por estado de filtro: remonta (e reexibe o skeleton) a cada mudança de
          filtro/ordenação/página, e é o que faz o Track de view_item_list re-disparar. */}
      <Suspense key={serializeFilters(filters)} fallback={<SkeletonProductGrid />}>
        <ListingResults filters={filters} scope={scope} countryCode={countryCode} listName={listName} colorMap={colorMap} region={region} />
      </Suspense>
    </div>
  )
}

async function ListingResults({
  filters,
  scope,
  countryCode,
  listName,
  colorMap,
  region,
}: {
  filters: FilterState
  scope: ListingScope
  countryCode: string
  listName: string
  colorMap: ColorMap
  region: HttpTypes.StoreRegion
}) {
  const result = await listProductsFiltered({ filters, scope, countryCode })
  const base = getBaseURL()

  return (
    <>
      <ListingToolbar count={result.count} total={result.total} filters={filters} facets={result.facets} colorMap={colorMap} />
      <div className="flex flex-col small:flex-row small:items-start gap-8">
        <aside id="filtros" className="hidden small:block small:w-[250px] shrink-0">
          <FilterPanel facets={result.facets} filters={filters} colorMap={colorMap} />
        </aside>
        <div className="w-full">
          {result.count === 0 ? (
            <EmptyResults filters={filters} />
          ) : (
            <>
              <ItemListJsonLd
                name={listName}
                items={result.products.filter((p) => p.handle).map((p) => ({ name: p.title ?? "", url: `${base}/${countryCode}/products/${p.handle}` }))}
              />
              <Track event="view_item_list" ecommerce={productsToItemList(result.products, listName)} />
              <ul className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8" data-testid="products-list">
                {result.products.map((p) => (
                  <li key={p.id}>
                    <ProductPreview product={p} region={region} listName={listName} />
                  </li>
                ))}
              </ul>
              {result.totalPages > 1 && <Pagination page={result.pagina} totalPages={result.totalPages} data-testid="product-pagination" />}
            </>
          )}
        </div>
      </div>
    </>
  )
}
