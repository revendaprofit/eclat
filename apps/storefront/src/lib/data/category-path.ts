import "server-only"

import { listCategories } from "./categories"
import { buildChain, deepestCategoryId, type CategoryCrumb } from "@lib/util/category-chain"

// Cadeia de categorias (raiz → categoria) e caminho de handles planos "mae/filha".
// Regra da fase 1: handles são planos no Medusa; o caminho é derivado por parent_category_id.
// Lógica pura (subir a árvore, achar a mais profunda) em lib/util/category-chain.ts — testada lá.
export type { CategoryCrumb }

export async function getCategoryChain(categoryId: string): Promise<CategoryCrumb[]> {
  const all = await listCategories().catch(() => [])
  return buildChain(all, categoryId)
}

// Entre várias categorias de um produto (spec §5.3), a cadeia da mais profunda na árvore —
// não `categories[0]`, que pode ser a raiz mesmo quando o produto também está numa subcategoria.
export async function getDeepestCategoryChain(categoryIds: string[]): Promise<CategoryCrumb[]> {
  const all = await listCategories().catch(() => [])
  const id = deepestCategoryId(all, categoryIds)
  return id ? buildChain(all, id) : []
}

export async function getCategoryPath(categoryId: string): Promise<string | null> {
  const chain = await getCategoryChain(categoryId)
  return chain.length ? chain.map((c) => c.handle).join("/") : null
}
