import "server-only"

import { getSiteContent } from "./site-content"
import type { ColorMap } from "@lib/util/colors"

// Lê o mapa de cores editado no Cockpit (Vitrine → Cores). Revalida em ~30s
// (herdado de getSiteContent). Sem mapa → objeto vazio; resolveColor cai no fallback.
export async function getColorMap(): Promise<ColorMap> {
  const raw = await getSiteContent<ColorMap>("cores")
  if (!raw || typeof raw !== "object") return {}
  return raw
}
