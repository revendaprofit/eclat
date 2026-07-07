import Script from "next/script"

// Injeção do Google Tag Manager (hub GTM-first). Só renderiza se houver gtm_id.
// O gestor configura GA4/Meta/Google Ads DENTRO do GTM; o site apenas fornece o
// container + o dataLayer com os eventos de e-commerce.

export function GtmHead({ gtmId, gsc }: { gtmId?: string; gsc?: string }) {
  return (
    <>
      {gsc ? <meta name="google-site-verification" content={gsc} /> : null}
      {gtmId ? (
        <Script id="gtm-base" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`}
        </Script>
      ) : null}
    </>
  )
}

export function GtmBody({ gtmId }: { gtmId?: string }) {
  if (!gtmId) return null
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${gtmId}`}
        height="0"
        width="0"
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  )
}
