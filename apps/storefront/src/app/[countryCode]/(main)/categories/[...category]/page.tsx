import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import { getCategoryByHandle, listCategories } from "@lib/data/categories"
import { listRegions } from "@lib/data/regions"
import { isIndexable, legacyRedirectQuery, parseFilters } from "@lib/util/catalog-filters"
import { HttpTypes, StoreRegion } from "@medusajs/types"
import CategoryTemplate from "@modules/categories/templates"

type Props = {
  params: Promise<{ category: string[]; countryCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export async function generateStaticParams() {
  const product_categories = await listCategories()

  if (!product_categories) {
    return []
  }

  const countryCodes = await listRegions().then((regions: StoreRegion[]) =>
    regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
  )

  const categoryHandles = product_categories.map(
    (category: HttpTypes.StoreProductCategory) => category.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string | undefined) =>
      categoryHandles.map((handle: string) => ({
        countryCode,
        category: [handle],
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  try {
    const productCategory = await getCategoryByHandle(params.category)

    const title = productCategory.name

    const description =
      productCategory.description ?? `${title} — athleisure premium da use.ÉCLAT.`

    const path = `/${params.countryCode}/categories/${params.category.join("/")}`

    return {
      // o template do layout raiz acrescenta "· use.ÉCLAT"
      title,
      description,
      alternates: {
        canonical: path,
      },
      robots: isIndexable(parseFilters(await props.searchParams)) ? undefined : { index: false, follow: true },
      openGraph: {
        title: `${title} | use.ÉCLAT`,
        description,
        url: path,
      },
    }
  } catch {
    notFound()
  }
}

export default async function CategoryPage(props: Props) {
  const params = await props.params
  const sp = await props.searchParams
  const path = `/${params.countryCode}/categories/${params.category.join("/")}`
  const legacy = legacyRedirectQuery(sp)
  if (legacy !== null) permanentRedirect(legacy ? `${path}?${legacy}` : path)
  const filters = parseFilters(sp)

  const productCategory = await getCategoryByHandle(params.category)

  if (!productCategory) {
    notFound()
  }

  return (
    <CategoryTemplate
      category={productCategory}
      filters={filters}
      countryCode={params.countryCode}
    />
  )
}
