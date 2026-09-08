// Dados do card de produto (spec §7), calculados no servidor a partir do produto
// da Store API + mapa de cores. Puro. O card (client) só apresenta.
import type { HttpTypes } from "@medusajs/types"
import type { VariantPrice } from "types/global"
import { isLowStock, isNew, isProductAvailable, isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { sortSizes } from "./catalog-facets"
import { resolveColor, type ColorMap } from "./colors"
import { getProductPrice } from "./get-product-price"

export type CardVariant = { id: string; size: string | null; available: boolean }
export type CardColor = {
  name: string
  hex: string
  swatch_url: string | null
  known: boolean
  images: string[]
  variants: CardVariant[]
  available: boolean
  lowStock: boolean
  firstAvailableVariantId: string | null
}
export type CardBadge = "esgotado" | "ultimas" | "promo" | "novo" | null
export type ProductCardData = {
  id: string
  handle: string
  title: string
  price: VariantPrice | null
  colors: CardColor[]
  images: string[]
  isNew: boolean
  onSale: boolean
  available: boolean
}

type V = HttpTypes.StoreProductVariant & { images?: { url?: string | null }[] | null }

const urls = (imgs: { url?: string | null }[] | null | undefined) => (imgs ?? []).map((i) => i.url).filter((u): u is string => !!u)

export function buildProductCardData(product: HttpTypes.StoreProduct, colorMap: ColorMap, now = Date.now()): ProductCardData {
  const variants = (product.variants ?? []) as V[]
  const productImages = [product.thumbnail, ...urls(product.images)].filter((u, i, a): u is string => !!u && a.indexOf(u) === i)
  const corOpt = (product.options ?? []).find((o) => (o.title ?? "").toLowerCase() === "cor")
  const colorNames: string[] = corOpt
    ? (corOpt.values ?? []).map((x) => x.value).filter((x): x is string => !!x)
    : [""]

  const buildColor = (name: string): CardColor => {
    const vs = name === "" ? variants : variants.filter((v) => optionValue(product.options, v as StockVariant, "Cor") === name)
    const r = name === "" ? { name: "", hex: "", swatch_url: null, known: false } : resolveColor(colorMap, name)
    const withImages = vs.find((v) => urls(v.images).length > 0)
    const sizeOf = (v: V) => optionValue(product.options, v as StockVariant, "Tamanho")
    const distinctSizes = Array.from(new Set(vs.map((v) => sizeOf(v)).filter((s): s is string => !!s)))
    const orderedSizes = sortSizes(distinctSizes)
    const ordered = [
      ...orderedSizes.flatMap((s) => vs.filter((v) => sizeOf(v) === s)),
      ...vs.filter((v) => !sizeOf(v)),
    ]
    const cardVariants = ordered.map((v) => ({ id: v.id, size: sizeOf(v), available: isVariantAvailable(v as StockVariant) }))
    return {
      name: r.name,
      hex: r.hex,
      swatch_url: r.swatch_url,
      known: r.known,
      images: withImages ? urls(withImages.images) : productImages,
      variants: cardVariants,
      available: cardVariants.some((v) => v.available),
      lowStock: isLowStock(product, name),
      firstAvailableVariantId: cardVariants.find((v) => v.available)?.id ?? null,
    }
  }

  const price = getProductPrice({ product }).cheapestPrice
  return {
    id: product.id,
    handle: product.handle ?? "",
    title: product.title ?? "",
    price,
    colors: colorNames.map(buildColor),
    images: productImages,
    isNew: isNew(product, now),
    onSale: price?.price_type === "sale",
    available: isProductAvailable(variants as StockVariant[]),
  }
}

export function badgeFor(data: ProductCardData, colorIndex: number): CardBadge {
  const c = data.colors[colorIndex] ?? data.colors[0]
  if (!c || !c.available) return "esgotado"
  if (c.lowStock) return "ultimas"
  if (data.onSale) return "promo"
  if (data.isNew) return "novo"
  return null
}
