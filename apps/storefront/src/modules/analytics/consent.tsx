"use client"

import { useEffect, useState } from "react"

// Google Consent Mode v2 + banner de cookies (LGPD).
// Default = negado (cookieless pings). O usuário concede/recusa no banner.

const COOKIE = "eclat_consent"

function setConsent(granted: boolean) {
  const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void }
  w.dataLayer = w.dataLayer || []
  // gtag pode não existir se o GTM não injetou o gtag; usamos dataLayer.push direto
  const push = (obj: unknown) => (w.dataLayer as unknown[]).push(obj)
  const value = granted ? "granted" : "denied"
  // formato consent update via dataLayer
  push(function () {
    // eslint-disable-next-line prefer-rest-params
    ;(w.dataLayer as unknown[]).push(arguments)
  })
  push({
    event: "consent_update",
    ad_storage: value,
    ad_user_data: value,
    ad_personalization: value,
    analytics_storage: value,
  })
  if (w.gtag) {
    w.gtag("consent", "update", {
      ad_storage: value,
      ad_user_data: value,
      ad_personalization: value,
      analytics_storage: value,
    })
  }
}

// Consent default: PRECISA rodar antes do snippet do GTM. Script inline puro
// no topo do <body> (síncrono no parse) — o GTM carrega afterInteractive, então
// a ordem é garantida. NÃO usar next/script fora do <body>: <script> como filho
// direto de <html> é HTML inválido e QUEBRA a hidratação do React (bug que
// deixava o botão de compra travado em "Out of stock").
export function ConsentDefault() {
  return (
    <script
      id="consent-default"
      dangerouslySetInnerHTML={{
        __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',wait_for_update:500});`,
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

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] p-4">
      <div className="mx-auto max-w-3xl bg-eclat-grafite text-eclat-luz rounded-lg shadow-xl p-5 flex flex-col small:flex-row items-start small:items-center gap-4">
        <p className="text-sm text-eclat-luz/85 flex-1">
          Usamos cookies para melhorar sua experiência e medir nossas campanhas. Você pode
          aceitar ou recusar. Saiba mais na nossa Política de Privacidade.
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={() => choose(false)}
            className="text-xs uppercase tracking-widest px-4 py-2.5 border border-eclat-luz/40 hover:border-eclat-luz transition-colors"
          >
            Recusar
          </button>
          <button
            onClick={() => choose(true)}
            className="text-xs uppercase tracking-widest px-5 py-2.5 bg-eclat-terracota text-eclat-luz hover:bg-eclat-terracota-claro transition-colors"
          >
            Aceitar
          </button>
        </div>
      </div>
    </div>
  )
}
