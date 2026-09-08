import { Metadata } from "next"
import { notFound } from "next/navigation"
import { listProducts } from "@lib/data/products"
import { getPersonaMediaForProduct } from "@lib/data/personas"
import { getRegion, listRegions } from "@lib/data/regions"
import ProductTemplate from "@modules/products/templates"
import { imagesForColor } from "@lib/util/pdp-variants"
import { optionValue, type StockVariant } from "@lib/util/availability"

type Props = {
  params: Promise<{ countryCode: string; handle: string }>
  searchParams: Promise<{ v_id?: string }>
}

export async function generateStaticParams() {
  try {
    const countryCodes = await listRegions().then((regions) =>
      regions?.map((r) => r.countries?.map((c) => c.iso_2)).flat()
    )

    if (!countryCodes) {
      return []
    }

    const promises = countryCodes.map(async (country) => {
      const { response } = await listProducts({
        countryCode: country,
        queryParams: { limit: 100, fields: "handle" },
      })

      return {
        country,
        products: response.products,
      }
    })

    const countryProducts = await Promise.all(promises)

    return countryProducts
      .flatMap((countryData) =>
        countryData.products.map((product) => ({
          countryCode: countryData.country,
          handle: product.handle,
        }))
      )
      .filter((param) => param.handle)
  } catch (error) {
    console.error(
      `Failed to generate static paths for product pages: ${
        error instanceof Error ? error.message : "Unknown error"
      }.`
    )
    return []
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const { handle } = params
  const region = await getRegion(params.countryCode)

  if (!region) {
    notFound()
  }

  const product = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle },
  }).then(({ response }) => response.products[0])

  if (!product) {
    notFound()
  }

  // description real do produto (1ª linha, ~160 chars); fallback padrão da marca
  const rawDescription = product.description?.trim().split("\n")[0] || ""
  const description = rawDescription
    ? rawDescription.length > 160
      ? `${rawDescription.slice(0, 157)}…`
      : rawDescription
    : `${product.title} — athleisure premium use.ÉCLAT.`

  const path = `/${params.countryCode}/products/${handle}`

  return {
    // o template do layout raiz acrescenta "· use.ÉCLAT"
    title: product.title,
    description,
    alternates: {
      canonical: path,
    },
    openGraph: {
      title: `${product.title} | use.ÉCLAT`,
      description,
      url: path,
      images: product.thumbnail ? [product.thumbnail] : [],
    },
  }
}

export default async function ProductPage(props: Props) {
  const params = await props.params
  const region = await getRegion(params.countryCode)
  const searchParams = await props.searchParams

  const selectedVariantId = searchParams.v_id

  if (!region) {
    notFound()
  }

  const pricedProduct = await listProducts({
    countryCode: params.countryCode,
    queryParams: { handle: params.handle },
  }).then(({ response }) => response.products[0])

  // Mesma regra de "fotos por cor" usada no client (VariantGallery, spec §4.5):
  // v_id → variante → cor da variante → imagesForColor. Sem variante/sem cor → fotos do produto.
  const selectedVariant = selectedVariantId
    ? pricedProduct.variants?.find((v) => v.id === selectedVariantId)
    : undefined
  const selectedColor = selectedVariant
    ? optionValue(pricedProduct.options, selectedVariant as StockVariant, "Cor")
    : null
  const images =
    selectedVariant && selectedColor
      ? imagesForColor(pricedProduct, selectedColor)
      : pricedProduct.images ?? []

  if (!pricedProduct) {
    notFound()
  }

  // fotos por persona ("Minha ÉCLAT") — busca por id E handle do produto
  const personaMedia = await getPersonaMediaForProduct(
    pricedProduct.id,
    pricedProduct.handle ?? undefined
  )

  return (
    <ProductTemplate
      product={pricedProduct}
      region={region}
      countryCode={params.countryCode}
      images={images ?? []}
      personaMedia={personaMedia}
      selectedVariantId={selectedVariantId ?? null}
    />
  )
}
