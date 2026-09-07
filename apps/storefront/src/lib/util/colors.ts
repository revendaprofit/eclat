// Mapa de cores da marca (site_content.cores) → swatch do card, filtro, seletor da PDP.
// Puro: sem I/O. A leitura fica em lib/data/colors.ts.

export type ColorEntry = { hex: string | null; swatch_url?: string | null }
export type ColorMap = Record<string, ColorEntry>
export type ResolvedColor = { name: string; hex: string; swatch_url: string | null; known: boolean }

// "pedra" da paleta ÉCLAT — neutro para cor sem hex cadastrado.
export const FALLBACK_HEX = "#C9C4BC"

export function normalizeColorName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

export function isValidHex(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)
}

export function resolveColor(map: ColorMap | null | undefined, name: string): ResolvedColor {
  const wanted = normalizeColorName(name)
  const canonical = Object.keys(map ?? {}).find((k) => normalizeColorName(k) === wanted)
  if (!canonical) return { name, hex: FALLBACK_HEX, swatch_url: null, known: false }
  const entry = (map as ColorMap)[canonical]
  const hex = entry.hex && isValidHex(entry.hex) ? entry.hex.toUpperCase() : FALLBACK_HEX
  return { name: canonical, hex, swatch_url: entry.swatch_url ?? null, known: true }
}
