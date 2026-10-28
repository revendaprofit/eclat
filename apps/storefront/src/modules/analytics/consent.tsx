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

  // Faixa compacta no TOPO (diagnóstico do funil, 2026-10-27): embaixo ela cobria o preço e o botão de compra
  // da barra fixa do celular na primeira visita.
  return (
    <div className="fixed inset-x-0 top-0 z-[60] p-2" data-testid="cookie-banner">
      <div className="mx-auto max-w-3xl bg-eclat-grafite text-eclat-luz rounded-md shadow-lg px-3 py-2 flex items-center gap-3">
        <p className="text-xs leading-snug text-eclat-luz/85 flex-1">
          Usamos cookies para melhorar sua experiência e medir nossas campanhas. Veja a Política de Privacidade.
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => choose(false)}
            className="text-[11px] uppercase tracking-widest px-3 py-2 border border-eclat-luz/40 hover:border-eclat-luz transition-colors"
          >
            Recusar
          </button>
          <button
            onClick={() => choose(true)}
            className="text-[11px] uppercase tracking-widest px-3 py-2 bg-eclat-terracota text-eclat-luz hover:bg-eclat-terracota-claro transition-colors"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
