import { Metadata } from "next"

import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import ProductPreview from "@modules/products/components/product-preview"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type Props = {
  searchParams: Promise<{ q?: string }>
  params: Promise<{ countryCode: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { q } = await props.searchParams
  const termo = (q || "").trim()
  return {
    title: termo ? `Busca: ${termo} | use.ÉCLAT` : "Busca | use.ÉCLAT",
    description: termo ? `Resultados da busca por "${termo}" na use.ÉCLAT.` : "Busque peças da use.ÉCLAT.",
    robots: { index: false }, // páginas de resultado não são indexadas
  }
}

export default async function BuscaPage(props: Props) {
  const { countryCode } = await props.params
  const { q } = await props.searchParams
  const termo = (q || "").trim()

  const region = await getRegion(countryCode)

  let produtos: Awaited<ReturnType<typeof listProducts>>["response"]["products"] = []
  if (termo && region) {
    const { response } = await listProducts({
      countryCode,
      queryParams: { q: termo, limit: 24 },
    })
    produtos = response.products
  }

  return (
    <div className="content-container py-10">
      <div className="mb-8">
        <p className="uppercase tracking-[0.25em] text-[11px] text-eclat-terracota">Busca</p>
        <h1 className="font-serif text-3xl text-eclat-grafite mt-1">
          {termo ? <>Resultados para “{termo}”</> : "O que você procura?"}
        </h1>
        {termo && (
          <p className="text-sm text-eclat-grafite/60 mt-1">
            {produtos.length === 0 ? "Nenhuma peça encontrada." : `${produtos.length} peça(s) encontrada(s).`}
          </p>
        )}
      </div>

      {!termo ? (
        <p className="text-sm text-eclat-grafite/60">
          Digite um termo na busca acima — por nome, coleção ou estilo.
        </p>
      ) : produtos.length === 0 ? (
        <div className="text-sm text-eclat-grafite/70">
          <p>Não encontramos peças para “{termo}”.</p>
          <LocalizedClientLink href="/store" className="text-eclat-terracota underline mt-2 inline-block">
            Ver toda a loja
          </LocalizedClientLink>
        </div>
      ) : (
        region && (
          <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
            {produtos.map((p) => (
              <li key={p.id}>
                <ProductPreview product={p} region={region} />
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  )
}
