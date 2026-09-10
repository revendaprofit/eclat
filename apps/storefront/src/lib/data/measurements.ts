import "server-only"

import { getSiteContent } from "./site-content"
import { isMeasureTable, type MeasureMap } from "@lib/util/measurements"

// Guia de medidas editado no Cockpit (Vitrine → Medidas). Descarta entradas malformadas.
// A PDP escolhe a tabela do produto em `products/templates/index.tsx`, combinando
// `getMeasureMap` + `getDeepestCategoryChain` (lib/data/category-path) + `pickMeasurements`.
export async function getMeasureMap(): Promise<MeasureMap> {
  const raw = await getSiteContent<Record<string, unknown>>("medidas")
  if (!raw || typeof raw !== "object") return {}
  const out: MeasureMap = {}
  for (const [k, v] of Object.entries(raw)) if (isMeasureTable(v)) out[k] = v
  return out
}
