"use client"

// Preferências "Minha ÉCLAT" — vivem SÓ no navegador (localStorage + cookie
// espelho). Sem cadastro, sem dado pessoal no servidor (LGPD-friendly).

export type EclatPrefs = {
  persona_id?: string
  persona_slug?: string
  tamanho?: string // P | M | G | GG
  estilos?: string[] // ex.: ["legging", "conjunto", "macacao"]
  wizard_done?: boolean
}

const KEY = "eclat_prefs"

export function getPrefs(): EclatPrefs {
  if (typeof window === "undefined") return {}
  try {
    return JSON.parse(window.localStorage.getItem(KEY) || "{}") as EclatPrefs
  } catch {
    return {}
  }
}

export function setPrefs(patch: Partial<EclatPrefs>) {
  if (typeof window === "undefined") return
  const next = { ...getPrefs(), ...patch }
  window.localStorage.setItem(KEY, JSON.stringify(next))
  // cookie espelho (1 ano) — permite personalização server-side futura
  document.cookie = `eclat_prefs=${encodeURIComponent(JSON.stringify(next))}; path=/; max-age=31536000; SameSite=Lax`
  window.dispatchEvent(new CustomEvent("eclat:prefs", { detail: next }))
}

export function onPrefsChange(cb: (p: EclatPrefs) => void): () => void {
  const handler = (e: Event) => cb((e as CustomEvent).detail as EclatPrefs)
  window.addEventListener("eclat:prefs", handler)
  return () => window.removeEventListener("eclat:prefs", handler)
}

export function openWizard() {
  window.dispatchEvent(new CustomEvent("eclat:wizard-open"))
}
