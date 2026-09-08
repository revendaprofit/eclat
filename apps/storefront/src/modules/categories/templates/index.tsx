import { notFound } from "next/navigation"

import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "@modules/store/templates/product-listing"
import CategoryHeader from "@modules/categories/components/category-header"
import { getCategoryChain } from "@lib/data/category-path"
import { HttpTypes } from "@medusajs/types"

export default async function CategoryTemplate({
  category,
  filters,
  countryCode,
  implicitSize,
}: {
  category: HttpTypes.StoreProductCategory
  filters: FilterState
  countryCode: string
  implicitSize?: string | null
}) {
  if (!category || !countryCode) notFound()

  const chain = await getCategoryChain(category.id)

  return (
    <ProductListing
      filters={filters}
      scope={{
        categoryIds: [category.id, ...(category.category_children ?? []).map((c) => c.id)],
      }}
      countryCode={countryCode}
      implicitSize={implicitSize}
      listName={category.name ?? ""}
      breadcrumb={[
        { name: "Início", href: "" },
        ...chain.map((c) => ({ name: c.name, href: `/categories/${c.handle}` })),
      ]}
      header={<CategoryHeader category={category} />}
    />
  )
}
