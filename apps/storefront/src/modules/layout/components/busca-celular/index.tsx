"use client"

import { useEffect, useRef, useState } from "react"
import SearchBar from "@modules/layout/components/search-bar"
import type { NavData } from "@lib/util/navigation"

// Busca no celular como lupa no cabeçalho (referência beatco.com.br, 2026-09-30). A barra cheia
// ficava fixa abaixo do logo e ocupava ~70 px acima do banner em toda página; agora só abre quando a
// cliente toca na lupa. Mesma SearchBar "full" de antes (sugestões, Enter vai para /busca).
// A lupa (dentro do <header>) e o painel (abaixo dele) são irmãos num componente de servidor, então
// conversam por um evento de janela em vez de estado compartilhado.
const EVENTO = "eclat:busca-celular"

export function LupaCelular() {
  const [aberta, setAberta] = useState(false)
  useEffect(() => {
    const ouvir = (e: Event) => setAberta((e as CustomEvent<boolean>).detail)
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new CustomEvent(EVENTO, { detail: !aberta }))}
      aria-label={aberta ? "Fechar busca" : "Buscar"}
      aria-expanded={aberta}
      aria-controls="busca-celular"
      className="small:hidden text-eclat-terracota p-1 -m-1"
      data-testid="busca-celular-lupa"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        {aberta ? (
          <path d="M6 6l12 12M18 6 6 18" />
        ) : (
          <>
            <circle cx="11" cy="11" r="6.5" />
            <path d="m16 16 4 4" />
          </>
        )}
      </svg>
    </button>
  )
}

export function PainelBusca({ nav }: { nav: NavData }) {
  const [aberta, setAberta] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const ouvir = (e: Event) => setAberta((e as CustomEvent<boolean>).detail)
    window.addEventListener(EVENTO, ouvir)
    return () => window.removeEventListener(EVENTO, ouvir)
  }, [])
  useEffect(() => {
    if (!aberta) return
    ref.current?.querySelector("input")?.focus()
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") window.dispatchEvent(new CustomEvent(EVENTO, { detail: false }))
    }
    window.addEventListener("keydown", esc)
    return () => window.removeEventListener("keydown", esc)
  }, [aberta])
  if (!aberta) return null
  return (
    <div id="busca-celular" ref={ref} className="small:hidden bg-eclat-luz border-b border-ui-border-base px-4 py-3" data-testid="busca-celular-painel">
      <SearchBar variant="full" nav={nav} />
    </div>
  )
}
