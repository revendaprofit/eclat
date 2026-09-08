// Lógica pura da cadeia de categorias (spec §5.3): raiz → categoria, e qual categoria é a mais
// profunda entre várias (produto com mais de uma categoria não deve prender breadcrumb/relacionados
// na raiz quando também está numa subcategoria). Sem I/O — a leitura fica em lib/data/category-path.ts.
export type CategoryCrumb = { id: string; name: string; handle: string }
export type CategoryLike = { id: string; name: string; handle: string; parent_category_id?: string | null }

// Raiz → `id`, subindo por `parent_category_id`. `[]` se `id` não existe em `all`.
// Cycle-safe: para de subir assim que reencontra um id já visto na cadeia.
export function buildChain(all: CategoryLike[], id: string): CategoryCrumb[] {
  const byId = new Map(all.map((c) => [c.id, c]))
  const chain: CategoryCrumb[] = []
  let cur = byId.get(id)
  const seen = new Set<string>()
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    chain.unshift({ id: cur.id, name: cur.name, handle: cur.handle })
    cur = cur.parent_category_id ? byId.get(cur.parent_category_id) : undefined
  }
  return chain
}

// Entre `ids`, a categoria cuja cadeia até a raiz é mais longa (mais profunda na árvore).
// Empate -> a primeira de `ids`. `null` se `ids` estiver vazio.
export function deepestCategoryId(all: CategoryLike[], ids: string[]): string | null {
  let best: string | null = null
  let bestLen = -1
  for (const id of ids) {
    const len = buildChain(all, id).length
    if (len > bestLen) {
      bestLen = len
      best = id
    }
  }
  return best
}
