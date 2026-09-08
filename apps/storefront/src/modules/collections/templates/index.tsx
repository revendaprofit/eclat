import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "@modules/store/templates/product-listing"
import { HttpTypes } from "@medusajs/types"

export default function CollectionTemplate({
  collection,
  filters,
  countryCode,
}: {
  collection: HttpTypes.StoreCollection
  filters: FilterState
  countryCode: string
}) {
  return (
    <ProductListing
      filters={filters}
      scope={{ collectionId: collection.id }}
      countryCode={countryCode}
      listName={collection.title}
      header={<h1 className="font-serif text-3xl text-eclat-grafite mb-6">{collection.title}</h1>}
    />
  )
}
