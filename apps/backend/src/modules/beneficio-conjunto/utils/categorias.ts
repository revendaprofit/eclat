// Mapa id de categoria → handle da categoria RAIZ (filha conta como a mãe; spec §4.2).
export type CategoriaMin = { id: string; handle: string; parent_category_id: string | null }
export function raizPorCategoria(cats: CategoriaMin[]): Map<string, string> {
  const porId = new Map(cats.map((c) => [c.id, c]))
  const out = new Map<string, string>()
  for (const c of cats) {
    let atual = c, guarda = 0
    while (atual.parent_category_id && porId.has(atual.parent_category_id) && guarda++ < 20) atual = porId.get(atual.parent_category_id)!
    out.set(c.id, atual.handle)
  }
  return out
}
