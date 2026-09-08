import { Metadata } from "next"
import { permanentRedirect, redirect } from "next/navigation"

import { legacyRedirectQuery } from "@lib/util/catalog-filters"
import { resolveListingFilters } from "@lib/data/prefs"
import { synonymCategoryHandle } from "@lib/util/search-synonyms"
import ProductListing from "@modules/store/templates/product-listing"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  params: Promise<{ countryCode: string }>
}

const termoDe = (sp: Record<string, string | string[] | undefined>) => (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim()

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode } = await props.params
  const termo = termoDe(await props.searchParams)
  return {
    title: termo ? `Busca: ${termo}` : "Busca",
    description: termo ? `Resultados da busca por "${termo}" na use.ÉCLAT.` : "Busque peças da use.ÉCLAT.",
    alternates: { canonical: `/${countryCode}/busca` },
    robots: { index: false, follow: true }, // resultados de busca nunca indexam (spec §6.4/§9)
  }
}

export default async function BuscaPage(props: Props) {
  const { countryCode } = await props.params
  const sp = await props.searchParams
  const termo = termoDe(sp)
  const path = `/${countryCode}/busca`

  // "calça" → /categories/leggings (ruling 2: só quando a busca inteira é sinônimo; 307, sinônimos mudam)
  if (termo) {
    const handle = synonymCategoryHandle(termo)
    if (handle) redirect(`/${countryCode}/categories/${handle}`)
  }
  const legacy = legacyRedirectQuery(sp)
  if (legacy !== null) permanentRedirect(`${path}?q=${encodeURIComponent(termo)}${legacy ? `&${legacy}` : ""}`)
  const { filters, implicitSize } = await resolveListingFilters(sp)

  const header = (
    <div className="mb-6">
      <p className="uppercase tracking-[0.25em] text-[11px] text-eclat-terracota">Busca</p>
      <h1 className="font-serif text-3xl text-eclat-grafite mt-1">
        {termo ? <>Resultados para “{termo}”</> : "O que você procura?"}
      </h1>
    </div>
  )

  if (!termo) {
    return (
      <div className="content-container py-10">
        {header}
        <p className="text-sm text-eclat-grafite/60">Digite um termo na busca acima — por nome, cor ou tipo de peça.</p>
      </div>
    )
  }

  return (
    <ProductListing
      filters={filters}
      scope={{ q: termo }}
      countryCode={countryCode}
      implicitSize={implicitSize}
      listName={`Busca: ${termo}`}
      query={termo}
      breadcrumb={[
        { name: "Início", href: "" },
        { name: "Busca", href: "/busca" },
      ]}
      header={header}
    />
  )
}
