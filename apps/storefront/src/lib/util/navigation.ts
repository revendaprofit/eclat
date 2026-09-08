// Árvore de navegação (spec §5): uma regra só para barra desktop, menu mobile e home.
// Puro: recebe categorias, produtos (com categories/variants) e coleções já buscados.
import { isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName, resolveColor, type ColorMap } from "./colors"

export const FEMININE_HANDLES = ["tops", "shorts", "leggings", "macaquinhos", "conjuntos"] as const

export type CategoryInput = { id: string; name: string; handle: string; parent_category_id?: string | null; rank?: number | null; metadata?: Record<string, unknown> | null }
export type ProductInput = {
  id: string
  thumbnail?: string | null
  collection_id?: string | null
  categories?: { id: string }[] | null
  options?: { id: string; title?: string | null }[] | null
  variants?: StockVariant[] | null
}
export type CollectionInput = { id: string; title: string; handle: string; metadata?: Record<string, unknown> | null }

export type NavColor = { name: string; hex: string; swatch_url: string | null }
export type NavCategory = {
  id: string
  name: string
  handle: string
  image_url: string | null
  descricao_curta: string | null
  rank: number
  feminine: boolean
  hasProducts: boolean
  colors: NavColor[]
  children: NavCategory[]
}
export type NavCollection = { id: string; title: string; handle: string; image_url: string | null }
export type NavData = { roots: NavCategory[]; feminine: NavCategory[]; collections: NavCollection[] }

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const byRank = (a: { rank: number; name: string }, b: { rank: number; name: string }) => a.rank - b.rank || a.name.localeCompare(b.name, "pt-BR")

export function buildNavData(input: { categories: CategoryInput[]; products: ProductInput[]; collections: CollectionInput[]; colorMap: ColorMap }): NavData {
  const { categories, products, collections, colorMap } = input

  // produtos por categoria (ids)
  const productsByCat = new Map<string, ProductInput[]>()
  for (const p of products) for (const c of p.categories ?? []) {
    if (!productsByCat.has(c.id)) productsByCat.set(c.id, [])
    productsByCat.get(c.id)!.push(p)
  }

  const colorsOf = (prods: ProductInput[]): NavColor[] => {
    const seen = new Map<string, NavColor>()
    for (const p of prods) for (const v of p.variants ?? []) {
      if (!isVariantAvailable(v)) continue
      const raw = optionValue(p.options, v, "Cor")
      if (!raw) continue
      const key = normalizeColorName(raw)
      if (seen.has(key)) continue
      const r = resolveColor(colorMap, raw)
      seen.set(key, { name: r.name, hex: r.hex, swatch_url: r.swatch_url })
    }
    return Array.from(seen.values())
  }

  const toNode = (c: CategoryInput, children: NavCategory[]): NavCategory => {
    const own = productsByCat.get(c.id) ?? []
    const all = [...own, ...children.flatMap((ch) => productsByCat.get(ch.id) ?? [])]
    const meta = c.metadata ?? {}
    return {
      id: c.id,
      name: c.name,
      handle: c.handle,
      image_url: str(meta.image_url),
      descricao_curta: str(meta.descricao_curta),
      rank: c.rank ?? 0,
      feminine: (FEMININE_HANDLES as readonly string[]).includes(c.handle),
      hasProducts: all.length > 0,
      colors: colorsOf(all),
      children,
    }
  }

  const rootsIn = categories.filter((c) => !c.parent_category_id)
  const roots: NavCategory[] = []
  for (const r of rootsIn) {
    const kids = categories.filter((c) => c.parent_category_id === r.id).map((k) => toNode(k, []))
    kids.sort(byRank)
    const node = toNode(r, kids)
    if (node.hasProducts) roots.push(node)
  }
  roots.sort(byRank)

  const feminine = roots.filter((r) => r.feminine)

  const firstThumb = (collectionId: string): string | null =>
    products.find((p) => p.collection_id === collectionId && str(p.thumbnail))?.thumbnail ?? null
  const navCollections: NavCollection[] = collections.map((c) => ({
    id: c.id,
    title: c.title,
    handle: c.handle,
    image_url: str(c.metadata?.image_url) ?? firstThumb(c.id),
  }))

  return { roots, feminine, collections: navCollections }
}
