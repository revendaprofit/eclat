import { Metadata } from "next"
import { permanentRedirect } from "next/navigation"

import { isIndexable, legacyRedirectQuery, parseFilters } from "@lib/util/catalog-filters"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  params: Promise<{
    countryCode: string
  }>
}

export async function generateMetadata(props: Params): Promise<Metadata> {
  const params = await props.params
  const path = `/${params.countryCode}/store`
  const description =
    "Todos os produtos use.ÉCLAT — leggings, tops e conjuntos de athleisure premium."
  return {
    title: "Loja",
    description,
    alternates: {
      canonical: path,
    },
    robots: isIndexable(parseFilters(await props.searchParams)) ? undefined : { index: false, follow: true },
    openGraph: {
      title: "Loja | use.ÉCLAT",
      description,
      url: path,
    },
  }
}

export default async function StorePage(props: Params) {
  const params = await props.params
  const sp = await props.searchParams
  const path = `/${params.countryCode}/store`
  const legacy = legacyRedirectQuery(sp)
  if (legacy !== null) permanentRedirect(legacy ? `${path}?${legacy}` : path)
  const filters = parseFilters(sp)

  return <StoreTemplate filters={filters} countryCode={params.countryCode} />
}
