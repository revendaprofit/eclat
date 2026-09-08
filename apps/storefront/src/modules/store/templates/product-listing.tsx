import type { ReactNode } from "react"
import { listProductsFiltered, type ListingScope } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getBaseURL } from "@lib/util/env"
import type { FilterState } from "@lib/util/catalog-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import { Pagination } from "@modules/store/components/pagination"
import EmptyResults from "@modules/store/components/filters/empty-results"
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
  const result = await listProductsFiltered({ filters, scope, countryCode })
  const base = getBaseURL()

  return (
    <div className="content-container py-6" data-testid="category-container">
      {header}
      <div className="flex items-center justify-between mb-6 text-sm text-eclat-grafite/70" data-testid="listing-toolbar">
        <span data-testid="result-count">
          {result.count === result.total ? `${result.total} peças` : `${result.count} de ${result.total} peças`}
        </span>
        {/* Task 5: ordenação + botão de filtros (mobile) entram aqui */}
      </div>
      <div className="flex flex-col small:flex-row small:items-start gap-8">
        <aside id="filtros" className="hidden small:block small:w-[250px] shrink-0">
          {/* Task 5: <FilterPanel facets={result.facets} filters={filters} /> */}
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
                    <ProductPreview product={p} region={region} />
                  </li>
                ))}
              </ul>
              {result.totalPages > 1 && <Pagination page={result.pagina} totalPages={result.totalPages} data-testid="product-pagination" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
