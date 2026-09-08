import type { ReactNode } from "react"
import { listProductsFiltered, type ListingScope } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getColorMap } from "@lib/data/colors"
import { getBaseURL } from "@lib/util/env"
import type { FilterState } from "@lib/util/catalog-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import { Pagination } from "@modules/store/components/pagination"
import EmptyResults from "@modules/store/components/filters/empty-results"
import FilterPanel from "@modules/store/components/filters/filter-panel"
import ListingToolbar from "@modules/store/components/filters/listing-toolbar"
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
  const [result, colorMap] = await Promise.all([listProductsFiltered({ filters, scope, countryCode }), getColorMap()])
  const base = getBaseURL()

  return (
    <div className="content-container py-6" data-testid="category-container">
      {header}
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
