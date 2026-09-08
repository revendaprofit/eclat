import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "./product-listing"

export default function StoreTemplate({
  filters,
  countryCode,
  implicitSize,
}: {
  filters: FilterState
  countryCode: string
  implicitSize?: string | null
}) {
  return (
    <ProductListing
      filters={filters}
      scope={{}}
      countryCode={countryCode}
      implicitSize={implicitSize}
      listName="Todos os produtos"
      breadcrumb={[
        { name: "Início", href: "" },
        { name: "Todos os produtos", href: "/store" },
      ]}
      header={<h1 className="font-serif text-3xl text-eclat-grafite mb-6" data-testid="store-page-title">Todos os produtos</h1>}
    />
  )
}
