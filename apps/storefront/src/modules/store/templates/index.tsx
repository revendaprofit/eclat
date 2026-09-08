import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "./product-listing"

export default function StoreTemplate({ filters, countryCode }: { filters: FilterState; countryCode: string }) {
  return (
    <ProductListing
      filters={filters}
      scope={{}}
      countryCode={countryCode}
      listName="Todos os produtos"
      header={<h1 className="font-serif text-3xl text-eclat-grafite mb-6" data-testid="store-page-title">Todos os produtos</h1>}
    />
  )
}
