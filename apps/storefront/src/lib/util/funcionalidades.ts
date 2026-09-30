// "Funcionalidades" da PDP (referência beatco.com.br, 2026-09-30): lista curta "nome do benefício:
// explicação" logo abaixo da descrição. Conteúdo em product.metadata.funcionalidades (JSON, gravado por
// scripts/funcionalidades-lumiere.py). Sem o campo, a PDP segue só com a descrição.
export type Funcionalidade = { titulo: string; texto: string }

export function lerFuncionalidades(valor: unknown): Funcionalidade[] {
  let lista: unknown = valor
  if (typeof valor === "string") {
    try {
      lista = JSON.parse(valor)
    } catch {
      return []
    }
  }
  if (!Array.isArray(lista)) return []
  return lista
    .map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
      const titulo = typeof o.titulo === "string" ? o.titulo.trim() : ""
      const texto = typeof o.texto === "string" ? o.texto.trim() : ""
      return { titulo, texto }
    })
    .filter((f) => f.titulo && f.texto)
    .slice(0, 8)
}
