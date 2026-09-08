import { notFound } from "next/navigation"

import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "@modules/store/templates/product-listing"
import CategoryHeader from "@modules/categories/components/category-header"
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
      header={<CategoryHeader category={category} />}
    />
  )
}
