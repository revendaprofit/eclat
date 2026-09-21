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

// Handle da categoria cuja página é a vitrine do Benefício Conjunto (ver categories/[...category]/page.tsx).
export const CONJUNTOS_HANDLE = "conjuntos"

// `conjuntoProductIds`: peças que formam os conjuntos da vitrine (curados + pares, `/store/conjuntos`).
// A categoria Conjuntos não tem produto cadastrado — a página dela é montada pelas regras do
// Benefício Conjunto —, então sem isso ela sumiria do menu, do rodapé e do sitemap mesmo cheia.
// Só contam as peças que estão em `products` (publicadas e não ocultas), igual às outras raízes.
export function buildNavData(input: {
  categories: CategoryInput[]
  products: ProductInput[]
  collections: CollectionInput[]
  colorMap: ColorMap
  conjuntoProductIds?: string[]
}): NavData {
  const { categories, products, collections, colorMap } = input
  const idsConjunto = new Set(input.conjuntoProductIds ?? [])

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
    const cadastrados = productsByCat.get(c.id) ?? []
    const own =
      c.handle === CONJUNTOS_HANDLE && idsConjunto.size
        ? [...cadastrados, ...products.filter((p) => idsConjunto.has(p.id) && !cadastrados.includes(p))]
        : cadastrados
    const all = [...own, ...children.flatMap((ch) => productsByCat.get(ch.id) ?? [])]
    const meta = c.metadata ?? {}
    return {
      id: c.id,
      name: c.name,
      handle: c.handle,
      // capa do menu (quadradinho 3:4): `menu_image_url` quando existe; senão a capa da página da categoria.
      // A página usa `image_url` como faixa 3:1 — uma imagem só não serve nítida aos dois formatos.
      image_url: str(meta.menu_image_url) ?? str(meta.image_url),
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
  // spec §5.1: coleção só entra na navegação se tiver ao menos 1 produto publicado nela (I2) —
  // capa (metadata ou 1º produto) não basta para listar uma coleção vazia.
  const collectionsWithProduct = new Set(products.map((p) => p.collection_id).filter((id): id is string => !!id))
  const navCollections: NavCollection[] = collections
    .filter((c) => collectionsWithProduct.has(c.id))
    .map((c) => ({
      id: c.id,
      title: c.title,
      handle: c.handle,
      image_url: str(c.metadata?.image_url) ?? firstThumb(c.id),
    }))

  return { roots, feminine, collections: navCollections }
}

// Páginas de listagem que valem a pena para o Google: as mesmas que o menu mostra. Raiz visível
// entra; filha só entra se tiver produto (uma raiz aparece por causa de uma filha, e a irmã vazia
// não pode ir junto — ex.: Acessórios aparece por Meias, Óculos vazio fica fora). Coleções: só as
// que têm produto (buildNavData já filtra).
export function paginasDeNavegacao(nav: NavData): { categorias: string[]; colecoes: string[] } {
  const categorias: string[] = []
  for (const r of nav.roots) {
    categorias.push(r.handle)
    for (const f of r.children) if (f.hasProducts) categorias.push(f.handle)
  }
  return { categorias, colecoes: nav.collections.map((c) => c.handle) }
}
