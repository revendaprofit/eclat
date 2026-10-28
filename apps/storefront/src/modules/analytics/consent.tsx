"use client"

import { useEffect, useState } from "react"
import { SCRIPT_MARCADOR_TESTE } from "@lib/util/teste-interno"

// Google Consent Mode v2 + banner de cookies (LGPD).
// Default = negado (cookieless pings). O usuário concede/recusa no banner.

const COOKIE = "eclat_consent"

function setConsent(granted: boolean) {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  // gtag pode não existir se o GTM não injetou o gtag; usamos dataLayer.push direto
  const push = (obj: unknown) => (w.dataLayer as unknown[]).push(obj)
  const value = granted ? "granted" : "denied"
  const consent = {
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  }
  // Consent Mode v2: o comando precisa chegar ao dataLayer como um objeto `arguments`
  // (formato gtag). Usa o gtag global do ConsentDefault; se não existir, replica o formato.
  // (Antes, empurrava-se uma função que fazia push(arguments) vazio → GTM logava
  // "Command name not specified" e o consentimento não era atualizado por esse caminho.)
  const gtagLike = function (..._args: unknown[]) {
    // eslint-disable-next-line prefer-rest-params
    ;(w.dataLayer as unknown[]).push(arguments)
  }
  ;(w.gtag ?? gtagLike)("consent", "update", consent)
  // Evento próprio para acionadores do GTM (ex.: carregar o Pixel após o aceite).
  push({ event: "consent_update", ...consent })
  // Clarity (modules/analytics/clarity.tsx) só carrega depois do aceite.
  if (granted) (w as unknown as { __eclatClarity?: () => void }).__eclatClarity?.()
}

// Consent default: PRECISA rodar antes do snippet do GTM. Script inline puro
// no topo do <body> (síncrono no parse) — o GTM carrega afterInteractive, então
// a ordem é garantida. NÃO usar next/script fora do <body>: <script> como filho
// direto de <html> é HTML inválido e QUEBRA a hidratação do React (bug que
// deixava o botão de compra travado em "Out of stock").
// O marcador de teste interno (`?eclat_teste=1`) roda aqui também, antes do GTM.
export function ConsentDefault() {
  return (
    <script
      id="consent-default"
      dangerouslySetInnerHTML={{
        __html: SCRIPT_MARCADOR_TESTE + `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`,
      }}
    />
  )
}

export function CookieBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const saved = document.cookie
      .split("; ")
      .find((c) => c.startsWith(COOKIE + "="))
      ?.split("=")[1]
    if (saved === "granted") {
      setConsent(true)
    } else if (saved === "denied") {
      // mantém negado
    } else {
      setShow(true)
    }
  }, [])

  function choose(granted: boolean) {
    document.cookie = `${COOKIE}=${granted ? "granted" : "denied"};path=/;max-age=${60 * 60 * 24 * 180}`
    setConsent(granted)
    setShow(false)
  }

  if (!show) return null

  // UMA linha no fluxo da página, ACIMA do menu (28/10, pedido da sessão de anúncios): não é fixa, então não cobre
  // logo, menu, sacola nem a barra de compra, e some ao rolar. Antes: fixa embaixo (cobria a barra de compra) e
  // depois fixa no topo (cobria o logo e a sacola). Consent Mode igual: nada carrega antes da escolha.
  return (
    <div className="bg-eclat-grafite text-eclat-luz" data-testid="cookie-banner">
      <div className="content-container flex items-center gap-2 py-1.5">
        <p className="flex-1 min-w-0 truncate text-[11px] text-eclat-luz/80">Usamos cookies para medir nossas campanhas.</p>
        <button
          onClick={() => choose(false)}
          className="shrink-0 text-[10px] uppercase tracking-widest px-2 py-1 text-eclat-luz/80 hover:text-eclat-luz"
        >
          Recusar
        </button>
        <button
          onClick={() => choose(true)}
          className="shrink-0 text-[10px] uppercase tracking-widest px-2.5 py-1 bg-eclat-terracota text-eclat-luz hover:bg-eclat-terracota-claro"
        >
          Aceitar
        </button>
      </div>
    </div>
  )
}
