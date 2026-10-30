"use client"

import { useEffect, useState } from "react"

// Aviso de frete na capa (sócia, 30/10/2026: "crie na capa do site um pop-up desse aviso"). Cartão discreto no pé da
// tela, não uma janela que cobre a página: o Google penaliza interstício que esconde o conteúdo no celular e a
// cliente que veio do anúncio não pode esbarrar num bloqueio. Aparece 2,5 s depois do carregamento, uma vez por
// sessão (sessionStorage), e some ao tocar em "Entendi" ou no X. Sem frete configurado, não existe.
const CHAVE = "eclat_aviso_frete_v1"

export default function AvisoFrete({ titulo, texto }: { titulo: string; texto: string | null }) {
  const [aberto, setAberto] = useState(false)
  useEffect(() => {
    if (!texto) return
    try {
      if (sessionStorage.getItem(CHAVE)) return
    } catch {
      /* navegador sem storage: mostra mesmo assim */
    }
    const t = window.setTimeout(() => setAberto(true), 2500)
    return () => window.clearTimeout(t)
  }, [texto])
  if (!texto || !aberto) return null
  const fechar = () => {
    setAberto(false)
    try {
      sessionStorage.setItem(CHAVE, "1")
    } catch {
      /* noop */
    }
  }
  return (
    <div
      role="dialog"
      aria-labelledby="aviso-frete-titulo"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-rounded border border-eclat-terracota/40 bg-eclat-luz p-4 shadow-xl small:inset-x-auto small:right-6 small:bottom-6"
      data-testid="aviso-frete"
    >
      <div className="flex items-start gap-3">
        <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 h-6 w-6 shrink-0 text-eclat-terracota" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" />
          <circle cx="7" cy="18" r="1.6" />
          <circle cx="17" cy="18" r="1.6" />
        </svg>
        <div className="flex flex-col gap-1">
          <p id="aviso-frete-titulo" className="text-sm font-semibold text-eclat-grafite">
            {titulo}
          </p>
          <p className="text-sm text-eclat-grafite/75">{texto}</p>
          <button
            type="button"
            onClick={fechar}
            className="mt-2 self-start rounded-full bg-eclat-grafite px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-eclat-luz hover:bg-eclat-terracota"
          >
            Entendi
          </button>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar aviso" className="ml-auto -mr-1 -mt-1 rounded-full p-1 text-eclat-grafite/60 hover:text-eclat-grafite">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  )
}
