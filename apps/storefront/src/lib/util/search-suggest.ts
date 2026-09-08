// Sugestões da barra de busca (spec §9): categorias cujo nome bate, cores do menu que batem
// (com link já filtrado por cor em cada categoria) e até 5 produtos vindos da Store API.
// Puro: recebe a NavData (mesma da barra/menu) e a lista de produtos já buscada.
import type { NavCategory, NavData } from "./navigation"
import { normalizeTerm, synonymCategoryHandle } from "./search-synonyms"

export const MIN_QUERY = 2
export const MAX_PRODUCTS = 5
const MAX_CATEGORIES = 4
const MAX_COLORS = 3

export type ProductHit = { id: string; title: string; handle: string; thumbnail: string | null }
export type CategorySuggestion = { type: "categoria"; name: string; handle: string; href: string }
export type ColorSuggestion = { type: "cor"; color: string; hex: string; categories: { name: string; handle: string; href: string }[] }
export type ProductSuggestion = { type: "produto"; id: string; title: string; handle: string; thumbnail: string | null; href: string }
export type Suggestions = { categories: CategorySuggestion[]; colors: ColorSuggestion[]; products: ProductSuggestion[] }

const EMPTY: Suggestions = { categories: [], colors: [], products: [] }

const flatten = (roots: NavCategory[]): NavCategory[] => roots.flatMap((r) => [r, ...r.children])

export function buildSuggestions(q: string, nav: NavData, products: ProductHit[] = []): Suggestions {
  const t = normalizeTerm(q)
  if (t.length < MIN_QUERY) return EMPTY
  const syn = synonymCategoryHandle(t)

  const categories: CategorySuggestion[] = flatten(nav.roots)
    .filter((c) => normalizeTerm(c.name).includes(t) || c.handle === syn)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({ type: "categoria", name: c.name, handle: c.handle, href: `/categories/${c.handle}` }))

  // cores: as raízes já agregam as cores das filhas (buildNavData), então basta percorrer roots
  const byColor = new Map<string, ColorSuggestion>()
  for (const r of nav.roots) {
    for (const col of r.colors) {
      const key = normalizeTerm(col.name)
      if (!key.includes(t)) continue
      let entry = byColor.get(key)
      if (!entry) {
        entry = { type: "cor", color: col.name, hex: col.hex, categories: [] }
        byColor.set(key, entry)
      }
      entry.categories.push({ name: r.name, handle: r.handle, href: `/categories/${r.handle}?cor=${encodeURIComponent(col.name)}` })
    }
  }
  const colors = Array.from(byColor.values()).slice(0, MAX_COLORS)

  const prods: ProductSuggestion[] = products
    .slice(0, MAX_PRODUCTS)
    .map((p) => ({ type: "produto", id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail, href: `/products/${p.handle}` }))

  return { categories, colors, products: prods }
}
