import { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"

import { getCollectionByHandle, listCollections } from "@lib/data/collections"
import { listRegions } from "@lib/data/regions"
import { isIndexable, legacyRedirectQuery, parseFilters } from "@lib/util/catalog-filters"
import { StoreCollection, StoreRegion } from "@medusajs/types"
import CollectionTemplate from "@modules/collections/templates"

type Props = {
  params: Promise<{ handle: string; countryCode: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export const PRODUCT_LIMIT = 12

export async function generateStaticParams() {
  const { collections } = await listCollections({
    fields: "*products",
  })

  if (!collections) {
    return []
  }

  const countryCodes = await listRegions().then(
    (regions: StoreRegion[]) =>
      regions
        ?.map((r) => r.countries?.map((c) => c.iso_2))
        .flat()
        .filter(Boolean) as string[]
  )

  const collectionHandles = collections.map(
    (collection: StoreCollection) => collection.handle
  )

  const staticParams = countryCodes
    ?.map((countryCode: string) =>
      collectionHandles.map((handle: string | undefined) => ({
        countryCode,
        handle,
      }))
    )
    .flat()

  return staticParams
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const collection = await getCollectionByHandle(params.handle)

  if (!collection) {
    notFound()
  }

  const description = `Coleção ${collection.title} — athleisure premium da use.ÉCLAT.`
  const path = `/${params.countryCode}/collections/${params.handle}`

  const metadata = {
    // o template do layout raiz acrescenta "· use.ÉCLAT"
    title: collection.title,
    description,
    alternates: {
      canonical: path,
    },
    robots: isIndexable(parseFilters(await props.searchParams)) ? undefined : { index: false, follow: true },
    openGraph: {
      title: `${collection.title} | use.ÉCLAT`,
      description,
      url: path,
    },
  } as Metadata

  return metadata
}

export default async function CollectionPage(props: Props) {
  const params = await props.params
  const sp = await props.searchParams
  const path = `/${params.countryCode}/collections/${params.handle}`
  const legacy = legacyRedirectQuery(sp)
  if (legacy !== null) permanentRedirect(legacy ? `${path}?${legacy}` : path)
  const filters = parseFilters(sp)

  const collection = await getCollectionByHandle(params.handle).then(
    (collection) => collection
  )

  if (!collection) {
    notFound()
  }

  return (
    <CollectionTemplate
      collection={collection}
      filters={filters}
      countryCode={params.countryCode}
    />
  )
}
