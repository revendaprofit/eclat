// Estado dos filtros da listagem ↔ query string (spec §6.2). Puro, sem I/O.

export const PRODUCT_LIMIT = 24
export const SORT_KEYS = ["novidades", "menor-preco", "maior-preco", "destaques"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const SORT_LABELS: Record<SortKey, string> = {
  novidades: "Novidades",
  "menor-preco": "Menor preço",
  "maior-preco": "Maior preço",
  destaques: "Destaques",
}

export type PriceRange = { min: number | null; max: number | null }
export type FilterState = {
  tamanho: string[]
  cor: string[]
  preco: PriceRange | null
  disponivel: boolean
  ordenar: SortKey
  pagina: number
}
export type SearchParamsLike = Record<string, string | string[] | undefined>

export const DEFAULT_FILTERS: FilterState = {
  tamanho: [],
  cor: [],
  preco: null,
  disponivel: false,
  ordenar: "novidades",
  pagina: 1,
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const v = part.trim()
    if (!v) continue
    const k = v.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function parsePrice(raw: string | undefined): PriceRange | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d*)-(\d*)$/)
  if (!m) return null
  const min = m[1] ? Number(m[1]) : null
  const max = m[2] ? Number(m[2]) : null
  if (min === null && max === null) return null
  if (min !== null && max !== null && min > max) return { min: max, max: min }
  return { min, max }
}

export function parseFilters(sp: SearchParamsLike): FilterState {
  const ordenarRaw = first(sp.ordenar)
  const ordenar = (SORT_KEYS as readonly string[]).includes(ordenarRaw ?? "") ? (ordenarRaw as SortKey) : "novidades"
  const paginaNum = Number(first(sp.pagina))
  const pagina = Number.isInteger(paginaNum) && paginaNum >= 1 ? paginaNum : 1
  return {
    tamanho: parseList(first(sp.tamanho)),
    cor: parseList(first(sp.cor)),
    preco: parsePrice(first(sp.preco)),
    disponivel: first(sp.disponivel) === "1",
    ordenar,
    pagina,
  }
}

export function hasActiveFilters(f: FilterState): boolean {
  return f.tamanho.length > 0 || f.cor.length > 0 || f.preco !== null || f.disponivel
}

export function isIndexable(f: FilterState): boolean {
  return !hasActiveFilters(f) && f.pagina === 1
}

export function serializeFilters(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.tamanho.length) p.set("tamanho", f.tamanho.join(","))
  if (f.cor.length) p.set("cor", f.cor.join(","))
  if (f.preco && (f.preco.min !== null || f.preco.max !== null))
    p.set("preco", `${f.preco.min ?? ""}-${f.preco.max ?? ""}`)
  if (f.disponivel) p.set("disponivel", "1")
  if (f.ordenar !== "novidades") p.set("ordenar", f.ordenar)
  if (f.pagina > 1) p.set("pagina", String(f.pagina))
  return p.toString()
}

// Parâmetros do starter (sortBy/page) → novos. Devolve null quando não há legado.
const LEGACY_SORT: Record<string, SortKey> = {
  created_at: "novidades",
  price_asc: "menor-preco",
  price_desc: "maior-preco",
}
export function legacyRedirectQuery(sp: SearchParamsLike): string | null {
  const sortBy = first(sp.sortBy)
  const page = first(sp.page)
  if (sortBy === undefined && page === undefined) return null
  const rest: SearchParamsLike = { ...sp }
  delete rest.sortBy
  delete rest.page
  const f = parseFilters(rest)
  if (sortBy && LEGACY_SORT[sortBy]) f.ordenar = LEGACY_SORT[sortBy]
  const n = Number(page)
  if (Number.isInteger(n) && n >= 1) f.pagina = n
  return serializeFilters(f)
}
