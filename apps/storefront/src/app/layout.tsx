import { getBaseURL } from "@lib/util/env"
import { Metadata } from "next"
import { Playfair_Display, Inter } from "next/font/google"
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
}

export default function RootLayout(props: { children: React.ReactNode }) {
  return (
    <html
      lang="pt-BR"
      data-mode="light"
      className={`${inter.variable} ${playfair.variable}`}
    >
      <body className="bg-eclat-luz text-eclat-grafite antialiased font-sans">
        <main className="relative">{props.children}</main>
      </body>
    </html>
  )
}
