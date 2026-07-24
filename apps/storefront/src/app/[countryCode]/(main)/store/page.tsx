import { Metadata } from "next"

import { SortOptions } from "@modules/store/components/refinement-list/sort-products"
import StoreTemplate from "@modules/store/templates"

type Params = {
  searchParams: Promise<{
    sortBy?: SortOptions
    page?: string
  }>
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
    openGraph: {
      title: "Loja | use.ÉCLAT",
      description,
      url: path,
    },
  }
}

export default async function StorePage(props: Params) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const { sortBy, page } = searchParams

  return (
    <StoreTemplate
      sortBy={sortBy}
      page={page}
      countryCode={params.countryCode}
    />
  )
}
