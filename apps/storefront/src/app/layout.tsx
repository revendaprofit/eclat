import { getBaseURL } from "@lib/util/env"
import { Metadata, Viewport } from "next"
import { Playfair_Display, Inter } from "next/font/google"
import { getSiteContent } from "@lib/data/site-content"
import { GtmHead, GtmBody } from "@modules/analytics/gtm"
import { ConsentDefault, CookieBanner } from "@modules/analytics/consent"
import { Marketing } from "@modules/analytics/config"
import PwaRegister from "@modules/common/components/pwa-register"
import "styles/globals.css"

// Texto: sans limpa
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

// Títulos: Playfair Display (fonte da marca — espírito do logo)
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
})

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
  title: {
    default: "use.ÉCLAT — athleisure da mulher inteira",
    template: "%s · use.ÉCLAT",
  },
  description:
    "use.ÉCLAT — moda fitness premium e independente. A luz e o resplendor da mulher inteira.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ÉCLAT",
  },
}

export const viewport: Viewport = {
  themeColor: "#7A3B2C",
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const marketing = await getSiteContent<Marketing>("marketing")

  return (
    <html
      lang="pt-BR"
      data-mode="light"
      className={`${inter.variable} ${playfair.variable}`}
    >
      <ConsentDefault />
      <GtmHead gtmId={marketing?.gtm_id} gsc={marketing?.gsc_verification} />
      <body className="bg-eclat-luz text-eclat-grafite antialiased font-sans">
        <GtmBody gtmId={marketing?.gtm_id} />
        <main className="relative">{props.children}</main>
        <CookieBanner />
        <PwaRegister />
      </body>
    </html>
  )
}
