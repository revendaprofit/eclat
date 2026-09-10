import "server-only"

import type { HttpTypes } from "@medusajs/types"
import { getSiteContent } from "./site-content"
import { listCategories } from "./categories"
import { isMeasureTable, pickMeasurements, type MeasureMap, type MeasureTable } from "@lib/util/measurements"
import { categoryPath, type CatLike } from "@lib/util/category-path"

// Guia de medidas editado no Cockpit (Vitrine → Medidas). Descarta entradas malformadas.
export async function getMeasureMap(): Promise<MeasureMap> {
  const raw = await getSiteContent<Record<string, unknown>>("medidas")
  if (!raw || typeof raw !== "object") return {}
  const out: MeasureMap = {}
  for (const [k, v] of Object.entries(raw)) if (isMeasureTable(v)) out[k] = v
  return out
}

// Tabela de medidas de um produto: pela categoria mais específica que tiver tabela
// (subcategoria herda da mãe via pickMeasurements). null = sem tabela (ex.: acessórios).
export async function getMeasureTableForProduct(
  product: HttpTypes.StoreProduct
): Promise<MeasureTable | null> {
  try {
    const cats = (product.categories ?? []) as CatLike[]
    if (cats.length === 0) return null
    const [map, all] = await Promise.all([getMeasureMap(), listCategories().catch(() => [])])
    const byId = new Map<string, CatLike>((all ?? []).map((c) => [c.id, c as CatLike]))
    const paths = cats
      .map((c) => categoryPath(byId.get(c.id) ?? c, byId))
      .sort((a, b) => b.split("/").length - a.split("/").length)
    for (const p of paths) {
      const t = pickMeasurements(map, p)
      if (t) return t
    }
    return null
  } catch (err) {
    console.error("[medidas] getMeasureTableForProduct falhou", err)
    return null
  }
}
