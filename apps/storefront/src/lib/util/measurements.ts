// Tabela de medidas por tipo de peça (site_content.medidas). Chave = caminho de handle
// da categoria ("leggings", "masculino/bermudas"). Subcategoria sem tabela herda da mãe.

export type MeasureTable = { columns: string[]; rows: string[][] }
export type MeasureMap = Record<string, MeasureTable>

export function isMeasureTable(x: unknown): x is MeasureTable {
  if (!x || typeof x !== "object") return false
  const t = x as Partial<MeasureTable>
  return (
    Array.isArray(t.columns) &&
    t.columns.every((c) => typeof c === "string") &&
    Array.isArray(t.rows) &&
    t.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))
  )
}

export function pickMeasurements(map: MeasureMap | null | undefined, handlePath: string): MeasureTable | null {
  if (!map) return null
  const parts = handlePath.split("/").filter(Boolean)
  for (let n = parts.length; n > 0; n--) {
    const key = parts.slice(0, n).join("/")
    const t = map[key]
    if (isMeasureTable(t)) return t
  }
  return null
}

// Acessório (raiz `acessorios`) sem tabela própria não mostra bloco de medidas na PDP (spec §4.4):
// a tabela fixa de Busto/Cintura/Quadril do SizeGuide não faz sentido para óculos ou meias.
// As demais peças sem tabela continuam caindo na tabela fixa.
export function hidesMeasures(handlePath: string | null | undefined, table: MeasureTable | null): boolean {
  if (table || !handlePath) return false
  return handlePath.split("/").filter(Boolean)[0] === "acessorios"
}
