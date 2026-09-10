// Preferências "Minha ÉCLAT" lidas no SERVIDOR a partir do cookie espelho `eclat_prefs`
// (gravado por modules/personalization/prefs.ts). Puro: parse defensivo + regra do tamanho
// pré-aplicado (spec §10). Sem cookie, nada muda — o HTML fica igual ao de um crawler.
import { SIZE_ORDER } from "./catalog-facets"
import { hasActiveFilters, type FilterState, type SearchParamsLike } from "./catalog-filters"

export type EclatPrefs = {
  persona_id?: string
  persona_slug?: string
  tamanho?: string // um dos valores de SIZE_ORDER (PP…XG); o wizard oferece P/M/G/GG
  estilos?: string[] // ex.: ["legging", "top"] — chaves de STYLE_HANDLES (style-order.ts)
  wizard_done?: boolean
  // medidas informadas no "Qual é o meu tamanho?" (cm/kg) — fica só no navegador: excluído do
  // cookie espelho por `setPrefs` (modules/personalization/prefs.ts), então nunca chega aqui em
  // `raw`; o campo só existe neste tipo porque o localStorage (fonte completa) o inclui.
  medidas?: {
    altura_cm?: number
    peso_kg?: number
    busto?: number
    cintura?: number
    quadril?: number
  }
}

export const PREFS_COOKIE = "eclat_prefs"

export function parsePrefsCookie(raw: string | null | undefined): EclatPrefs {
  if (!raw) return {}
  try {
    const text = raw.trim().startsWith("{") ? raw : decodeURIComponent(raw)
    const obj = JSON.parse(text) as Record<string, unknown>
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
    const out: EclatPrefs = {}
    if (typeof obj.persona_id === "string") out.persona_id = obj.persona_id
    if (typeof obj.persona_slug === "string") out.persona_slug = obj.persona_slug
    if (typeof obj.tamanho === "string") {
      const t = obj.tamanho.trim().toUpperCase()
      if (SIZE_ORDER.includes(t)) out.tamanho = t
    }
    if (Array.isArray(obj.estilos)) out.estilos = obj.estilos.filter((e): e is string => typeof e === "string")
    if (typeof obj.wizard_done === "boolean") out.wizard_done = obj.wizard_done
    return out
  } catch {
    return {}
  }
}

// Tamanho salvo entra SÓ quando a URL não tem filtro nenhum e o param `tamanho` está AUSENTE.
// `?tamanho=` (presente, vazio) é o opt-out da chip "Seu tamanho" (ruling 3). A URL nunca é alterada.
export function applyPreferredSize(
  filters: FilterState,
  sp: SearchParamsLike,
  prefs: EclatPrefs
): { filters: FilterState; implicitSize: string | null } {
  if (!prefs.tamanho || hasActiveFilters(filters) || sp.tamanho !== undefined) return { filters, implicitSize: null }
  return { filters: { ...filters, tamanho: [prefs.tamanho] }, implicitSize: prefs.tamanho }
}
