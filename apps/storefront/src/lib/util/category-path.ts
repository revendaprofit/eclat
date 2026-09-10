// Caminho de handle "mae/filha" de uma categoria — é a chave de site_content.medidas
// (mesma convenção do Cockpit em components/medidas-editor.tsx). Aceita parent_category
// expandido (Store API com *parent_category) ou resolve parent_category_id por um mapa.

export type CatLike = {
  id: string
  handle: string
  parent_category?: CatLike | null
  parent_category_id?: string | null
}

export function categoryPath(cat: CatLike, byId?: Map<string, CatLike>): string {
  const parts: string[] = []
  const seen = new Set<string>()
  let cur: CatLike | null | undefined = cat
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id)
    parts.unshift(cur.handle)
    cur =
      cur.parent_category ??
      (cur.parent_category_id && byId ? byId.get(cur.parent_category_id) : null)
  }
  return parts.join("/")
}
