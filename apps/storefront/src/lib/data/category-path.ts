import "server-only"

import { listCategories } from "./categories"

// Cadeia de categorias (raiz → categoria) e caminho de handles planos "mae/filha".
// Regra da fase 1: handles são planos no Medusa; o caminho é derivado por parent_category_id.
export type CategoryCrumb = { id: string; name: string; handle: string }

export async function getCategoryChain(categoryId: string): Promise<CategoryCrumb[]> {
  const all = await listCategories().catch(() => [])
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain: CategoryCrumb[] = []
  let cur = byId.get(categoryId)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift({ id: cur.id, name: cur.name, handle: cur.handle })
    cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined
  }
  return chain
}

export async function getCategoryPath(categoryId: string): Promise<string | null> {
  const chain = await getCategoryChain(categoryId)
  return chain.length ? chain.map((c) => c.handle).join("/") : null
}
