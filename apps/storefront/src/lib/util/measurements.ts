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
