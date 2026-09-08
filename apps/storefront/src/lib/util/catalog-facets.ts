// Filtro em memória, facetas, ordenação e paginação da listagem (spec §6.1).
// Puro: opera sobre os produtos já buscados (até 100 por listagem — limite
// conhecido; acima disso migrar tamanho/cor para `variants.options.value` na Store API).
import type { HttpTypes } from "@medusajs/types"
import { isProductAvailable, isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName } from "./colors"
import { PRODUCT_LIMIT, type FilterState, type SortKey } from "./catalog-filters"

type Product = HttpTypes.StoreProduct
type Variant = HttpTypes.StoreProductVariant & { calculated_price?: { calculated_amount?: number | null } | null }

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG"]

export function sortSizes(values: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase())
    return i === -1 ? SIZE_ORDER.length : i
  }
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt-BR"))
}

export function variantSize(product: Product, v: Variant): string | null {
  return optionValue(product.options, v as StockVariant, "Tamanho")
}
export function variantColor(product: Product, v: Variant): string | null {
  return optionValue(product.options, v as StockVariant, "Cor")
}

export function productMinPrice(product: Product): number | null {
  const prices = ((product.variants ?? []) as Variant[])
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((n): n is number => typeof n === "number")
  return prices.length ? Math.min(...prices) : null
}

const sameColor = (a: string | null, b: string) => a !== null && normalizeColorName(a) === normalizeColorName(b)
const inList = (value: string | null, list: string[]) => value !== null && list.some((x) => x.toLowerCase() === value.toLowerCase())

export function matchesFilters(
  product: Product,
  f: FilterState,
  ignore?: "tamanho" | "cor" | "preco" | "disponivel"
): boolean {
  const tamanho = ignore === "tamanho" ? [] : f.tamanho
  const cor = ignore === "cor" ? [] : f.cor
  const preco = ignore === "preco" ? null : f.preco
  const disponivel = ignore === "disponivel" ? false : f.disponivel
  const variants = (product.variants ?? []) as Variant[]

  if (tamanho.length || cor.length) {
    const ok = variants.some((v) => {
      if (!isVariantAvailable(v as StockVariant)) return false
      if (tamanho.length && !inList(variantSize(product, v), tamanho)) return false
      if (cor.length && !cor.some((c) => sameColor(variantColor(product, v), c))) return false
      return true
    })
    if (!ok) return false
  }
  if (preco) {
    const min = productMinPrice(product)
    if (min === null) return false
    if (preco.min !== null && min < preco.min) return false
    if (preco.max !== null && min > preco.max) return false
  }
  if (disponivel && !isProductAvailable(variants as StockVariant[])) return false
  return true
}

export function applyFilters(products: Product[], f: FilterState): Product[] {
  return products.filter((p) => matchesFilters(p, f))
}

export type Facets = {
  tamanhos: { value: string; count: number }[]
  cores: { name: string; count: number }[]
  preco: { min: number; max: number } | null
}

export function computeFacets(products: Product[], f: FilterState): Facets {
  const sizeCount = new Map<string, number>()
  const colorCount = new Map<string, { name: string; count: number }>()
  const prices: number[] = []

  for (const p of products) {
    const variants = (p.variants ?? []) as Variant[]
    if (matchesFilters(p, f, "tamanho")) {
      const sizes = new Set<string>()
      for (const v of variants) {
        if (!isVariantAvailable(v as StockVariant)) continue
        if (f.cor.length && !f.cor.some((c) => sameColor(variantColor(p, v), c))) continue
        const s = variantSize(p, v)
        if (s) sizes.add(s)
      }
      sizes.forEach((s) => sizeCount.set(s, (sizeCount.get(s) ?? 0) + 1))
    }
    if (matchesFilters(p, f, "cor")) {
      const colors = new Map<string, string>()
      for (const v of variants) {
        if (!isVariantAvailable(v as StockVariant)) continue
        if (f.tamanho.length && !inList(variantSize(p, v), f.tamanho)) continue
        const c = variantColor(p, v)
        if (c) colors.set(normalizeColorName(c), c)
      }
      colors.forEach((name, key) => {
        const cur = colorCount.get(key)
        colorCount.set(key, { name: cur?.name ?? name, count: (cur?.count ?? 0) + 1 })
      })
    }
    if (matchesFilters(p, f, "preco")) {
      const min = productMinPrice(p)
      if (min !== null) prices.push(min)
    }
  }

  return {
    tamanhos: sortSizes(Array.from(sizeCount.keys())).map((value) => ({ value, count: sizeCount.get(value)! })),
    cores: Array.from(colorCount.values()),
    preco: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  }
}

const createdAt = (p: Product) => (p.created_at ? Date.parse(String(p.created_at)) : 0)
const destaqueRank = (p: Product): number | null => {
  const raw = (p.metadata as Record<string, unknown> | null | undefined)?.destaque_rank
  const n = Number(raw)
  return raw === undefined || raw === null || raw === "" || !Number.isFinite(n) ? null : n
}

export function sortByKey(products: Product[], key: SortKey): Product[] {
  const out = [...products]
  const byNew = (a: Product, b: Product) => createdAt(b) - createdAt(a)
  if (key === "novidades") return out.sort(byNew)
  if (key === "menor-preco" || key === "maior-preco") {
    const sign = key === "menor-preco" ? 1 : -1
    return out.sort((a, b) => {
      const pa = productMinPrice(a)
      const pb = productMinPrice(b)
      // Produto sem preço vai por último em qualquer direção
      if (pa === null && pb === null) return byNew(a, b)
      if (pa === null) return 1
      if (pb === null) return -1
      return pa === pb ? byNew(a, b) : sign * (pa - pb)
    })
  }
  return out.sort((a, b) => {
    const ra = destaqueRank(a)
    const rb = destaqueRank(b)
    if (ra === null && rb === null) return byNew(a, b)
    if (ra === null) return 1
    if (rb === null) return -1
    return ra === rb ? byNew(a, b) : ra - rb
  })
}

export function paginate<T>(items: T[], pagina: number, limit = PRODUCT_LIMIT): { items: T[]; totalPages: number; pagina: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / limit))
  const p = Math.min(Math.max(1, pagina), totalPages)
  return { items: items.slice((p - 1) * limit, p * limit), totalPages, pagina: p }
}
