import Script from "next/script"

// Microsoft Clarity (mapa de calor e gravação de sessão, grátis) — diagnóstico do funil, 2026-10-27: sem ele não dá
// para ver onde a visitante do anúncio para. Só liga com NEXT_PUBLIC_CLARITY_ID (Vercel), só carrega para quem
// ACEITOU os cookies (LGPD; o banner chama window.__eclatClarity no aceite) e nunca no navegador de teste interno.
export function ClarityScript() {
  const id = process.env.NEXT_PUBLIC_CLARITY_ID
  if (!id || !/^[a-z0-9]{6,20}$/i.test(id)) return null
  return (
    <Script id="clarity" strategy="afterInteractive">
      {`window.__eclatClarity=function(){if(window.__eclatTeste||window.clarity)return;(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");};if(document.cookie.indexOf("eclat_consent=granted")!==-1)window.__eclatClarity();`}
    </Script>
  )
}
