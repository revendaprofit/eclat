// Lógica pura da seleção de variante na PDP (spec §8): qual variante casa com as
// opções, disponibilidade por tamanho na cor, fotos por cor, seleção inicial.
import type { HttpTypes } from "@medusajs/types"
import { isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { sortSizes } from "./catalog-facets"
import { normalizeColorName } from "./colors"

type Product = HttpTypes.StoreProduct
type Variant = HttpTypes.StoreProductVariant & { images?: HttpTypes.StoreProductImage[] | null }
export type Selection = Record<string, string | undefined>

const norm = (s: string) => normalizeColorName(s)
const sameValue = (title: string, a: string | null | undefined, b: string | null | undefined) =>
  a != null && b != null && (title.toLowerCase() === "cor" ? norm(a) === norm(b) : a.toLowerCase() === b.toLowerCase())

export function findOption(product: Product, title: string): HttpTypes.StoreProductOption | null {
  return (product.options ?? []).find((o) => (o.title ?? "").toLowerCase() === title.toLowerCase()) ?? null
}

export function colorValues(product: Product): string[] {
  return (findOption(product, "Cor")?.values ?? []).map((x) => x.value).filter((x): x is string => !!x)
}

export function sizeValues(product: Product): string[] {
  return sortSizes((findOption(product, "Tamanho")?.values ?? []).map((x) => x.value).filter((x): x is string => !!x))
}

function variantMatches(product: Product, v: Variant, sel: Selection): boolean {
  return (product.options ?? []).every((o) => {
    const want = sel[o.id]
    if (want === undefined) return false
    const has = (v.options ?? []).find((vo) => vo.option_id === o.id)?.value ?? null
    return sameValue(o.title ?? "", has, want)
  })
}

export function isCompleteSelection(product: Product, sel: Selection): boolean {
  return (product.options ?? []).every((o) => sel[o.id] !== undefined)
}

export function variantFor(product: Product, sel: Selection): HttpTypes.StoreProductVariant | null {
  if (!isCompleteSelection(product, sel)) return null
  return ((product.variants ?? []) as Variant[]).find((v) => variantMatches(product, v, sel)) ?? null
}

export function selectedColor(product: Product, sel: Selection): string | null {
  const opt = findOption(product, "Cor")
  return opt ? sel[opt.id] ?? null : null
}

function variantsOf(product: Product, color: string | null): Variant[] {
  const all = (product.variants ?? []) as Variant[]
  if (color === null) return all
  return all.filter((v) => sameValue("Cor", optionValue(product.options, v as StockVariant, "Cor"), color))
}

export function sizeAvailability(product: Product, color: string | null): Record<string, boolean> {
  const out: Record<string, boolean> = {}
  for (const s of sizeValues(product)) {
    out[s] = variantsOf(product, color).some(
      (v) => sameValue("Tamanho", optionValue(product.options, v as StockVariant, "Tamanho"), s) && isVariantAvailable(v as StockVariant)
    )
  }
  return out
}

export function imagesForColor(product: Product, color: string | null): HttpTypes.StoreProductImage[] {
  if (color !== null) {
    const withImages = variantsOf(product, color).find((v) => (v.images ?? []).length > 0)
    if (withImages) return withImages.images as HttpTypes.StoreProductImage[]
  }
  return product.images ?? []
}

export function firstAvailableVariantId(product: Product, color: string): string | null {
  const bySize = sizeValues(product)
  const vs = variantsOf(product, color)
  const ordered = [
    ...bySize.flatMap((s) => vs.filter((v) => sameValue("Tamanho", optionValue(product.options, v as StockVariant, "Tamanho"), s))),
    ...vs.filter((v) => !optionValue(product.options, v as StockVariant, "Tamanho")),
  ]
  return ordered.find((v) => isVariantAvailable(v as StockVariant))?.id ?? null
}

export function initialSelection(product: Product, opts: { variantId?: string | null; prefSize?: string | null; color?: string | null }): Selection {
  const sel: Selection = {}
  const variant = opts.variantId ? (product.variants ?? []).find((v) => v.id === opts.variantId) : undefined
  if (variant) {
    for (const vo of variant.options ?? []) if (vo.option_id && vo.value) sel[vo.option_id] = vo.value
    return sel
  }
  // Produto com uma única variante: pré-seleciona todos os valores dela (mesmo quando a única opção não
  // é Cor, ex.: "Tamanho: Único") — sem isso o botão fica preso em "Escolha as opções" sem nada pra escolher.
  const variants = product.variants ?? []
  if (variants.length === 1) {
    for (const vo of variants[0].options ?? []) if (vo.option_id && vo.value) sel[vo.option_id] = vo.value
    return sel
  }
  const corOpt = findOption(product, "Cor")
  const cores = colorValues(product)
  if (corOpt && cores.length === 1) {
    sel[corOpt.id] = cores[0]
  } else if (corOpt && opts.color) {
    // Cor vinda do link do card (`?cor=`, ver product-card): pré-seleciona SÓ a cor, com a grafia do
    // catálogo — nunca o tamanho, que a cliente ainda não escolheu (decisão do controller, ver spec §8).
    const hit = cores.find((c) => norm(c) === norm(opts.color!))
    if (hit) sel[corOpt.id] = hit
  }
  const tamOpt = findOption(product, "Tamanho")
  if (tamOpt && opts.prefSize) {
    const cor = corOpt ? sel[corOpt.id] ?? null : null
    const disp = sizeAvailability(product, cor)
    const hit = Object.keys(disp).find((s) => s.toLowerCase() === opts.prefSize!.toLowerCase())
    if (hit && disp[hit]) sel[tamOpt.id] = hit
  }
  return sel
}

export function variantLabel(product: Product, variant: HttpTypes.StoreProductVariant): string {
  const cor = optionValue(product.options, variant as StockVariant, "Cor")
  const tam = optionValue(product.options, variant as StockVariant, "Tamanho")
  return [cor, tam].filter(Boolean).join(" / ")
}
