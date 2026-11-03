"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { guardarSacola, sacolaPrecisaDeContato } from "@lib/data/cart"
import { mascararCelular } from "@lib/util/boas-vindas"
import {
  CHAVE_SACOLA,
  EVENTO_SACOLA,
  TEXTO_ACEITE_SACOLA,
  ehPaginaDaSacola,
  lerEstadoSacola,
  podeOferecer,
  rotaProibida,
} from "@lib/util/sacola-guardada"
import { pushEcommerceEvent } from "@modules/analytics/push"

const ESPERA_MS = 1200 // deixa o "adicionado" aparecer antes de pedir qualquer coisa
const ESPERA_NA_SACOLA_MS = 8000 // na sacola o cartão ocupa o espaço do CEP e do cupom: dá tempo de ela usar

const lerEstado = () => {
  try {
    return lerEstadoSacola(localStorage.getItem(CHAVE_SACOLA))
  } catch {
    return null
  }
}
const gravarEstado = (valor: string) => {
  try {
    localStorage.setItem(CHAVE_SACOLA, valor)
  } catch {
    /* navegador sem storage: só volta a oferecer */
  }
}

// Cartão no pé da tela, acima da barra de compra do celular: não cobre a peça e fecha com um toque.
export default function GuardarSacola() {
  const pathname = usePathname()
  const [aberto, setAberto] = useState(false)
  const [whatsapp, setWhatsapp] = useState("")
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [guardou, setGuardou] = useState(false)

  useEffect(() => {
    let timer = 0
    const oferecer = async () => {
      if (rotaProibida(window.location.pathname) || !podeOferecer(lerEstado(), Date.now())) return
      // Sacola vazia não tem o que guardar, e quem já deixou contato (aviso de boas-vindas, checkout) não responde de novo.
      if (!(await sacolaPrecisaDeContato().catch(() => false))) return
      window.clearTimeout(timer)
      const abrir = () => {
        // Nunca abre em cima de quem está digitando (CEP, cupom).
        if (document.activeElement instanceof HTMLInputElement) {
          timer = window.setTimeout(abrir, 3000)
          return
        }
        if (!document.querySelector('[data-testid="envelopes"]')) setAberto(true)
      }
      timer = window.setTimeout(abrir, ehPaginaDaSacola(window.location.pathname) ? ESPERA_NA_SACOLA_MS : ESPERA_MS)
    }
    window.addEventListener(EVENTO_SACOLA, oferecer)
    if (ehPaginaDaSacola(pathname)) oferecer()
    return () => {
      window.removeEventListener(EVENTO_SACOLA, oferecer)
      window.clearTimeout(timer)
    }
  }, [pathname])

  useEffect(() => {
    if (rotaProibida(pathname)) setAberto(false)
  }, [pathname])

  if (!aberto) return null

  const fechar = () => {
    setAberto(false)
    if (!guardou) gravarEstado(String(Date.now()))
  }

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault()
    if (enviando) return
    setEnviando(true)
    setErro(null)
    const r = await guardarSacola(whatsapp).catch(() => ({ erro: "Não deu certo agora. Tente de novo." }))
    setEnviando(false)
    if ("erro" in r) {
      setErro(r.erro)
      return
    }
    gravarEstado("guardou")
    setGuardou(true)
    pushEcommerceEvent("generate_lead", undefined, { lead_source: "guardar_sacola" })
    window.setTimeout(() => setAberto(false), 2500)
  }

  return (
    <div
      role="dialog"
      aria-labelledby="guardar-sacola-titulo"
      className="fixed inset-x-4 bottom-24 z-[60] mx-auto max-w-md rounded-rounded border border-eclat-terracota/40 bg-eclat-luz p-4 shadow-lg small:bottom-6"
      data-testid="guardar-sacola"
    >
      <button type="button" onClick={fechar} aria-label="Fechar" className="absolute right-3 top-3 rounded-full p-1 text-eclat-grafite/60 hover:text-eclat-grafite">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {guardou ? (
        <p id="guardar-sacola-titulo" className="pr-8 text-sm font-semibold text-eclat-grafite" data-testid="guardar-sacola-ok">
          Pronto, sua sacola está guardada.
        </p>
      ) : (
        <form onSubmit={enviar} className="flex flex-col gap-2">
          <p id="guardar-sacola-titulo" className="pr-8 text-sm font-semibold text-eclat-grafite">
            Quer que a gente guarde sua sacola?
          </p>
          <p className="text-sm text-eclat-grafite/75">Deixe seu WhatsApp e, se precisar sair agora, a gente te ajuda a continuar de onde parou.</p>
          <div className="flex gap-2">
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              aria-label="WhatsApp com DDD"
              value={whatsapp}
              onChange={(e) => setWhatsapp(mascararCelular(e.target.value))}
              placeholder="(31) 99999-0000"
              className="h-11 min-w-0 flex-1 rounded-md border border-eclat-pedra bg-white px-3 text-base text-eclat-grafite"
              data-testid="guardar-sacola-whatsapp"
            />
            <button type="submit" disabled={enviando} className="h-11 shrink-0 rounded-md bg-eclat-terracota px-4 text-sm font-medium text-white disabled:opacity-60" data-testid="guardar-sacola-enviar">
              {enviando ? "Guardando..." : "Guardar"}
            </button>
          </div>
          {erro && (
            <p role="alert" className="text-xs text-red-600" data-testid="guardar-sacola-erro">
              {erro}
            </p>
          )}
          <p className="text-[11px] leading-snug text-eclat-grafite/60">{TEXTO_ACEITE_SACOLA}</p>
        </form>
      )}
    </div>
  )
}
