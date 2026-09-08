import { notFound } from "next/navigation"

import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "@modules/store/templates/product-listing"
import { HttpTypes } from "@medusajs/types"

export default function CategoryTemplate({
  category,
  filters,
  countryCode,
}: {
  category: HttpTypes.StoreProductCategory
  filters: FilterState
  countryCode: string
}) {
  if (!category || !countryCode) notFound()

  return (
    <ProductListing
      filters={filters}
      scope={{
        categoryIds: [category.id, ...(category.category_children ?? []).map((c) => c.id)],
      }}
      countryCode={countryCode}
      listName={category.name ?? ""}
      header={
        <h1 className="font-serif text-3xl text-eclat-grafite mb-6" data-testid="category-page-title">
          {category.name}
        </h1>
      }
    />
  )
}
