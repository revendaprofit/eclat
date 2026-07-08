import { MetadataRoute } from "next"

// PWA — app instalável ("Adicionar à tela inicial").
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "use.ÉCLAT",
    short_name: "ÉCLAT",
    description: "Athleisure premium da mulher inteira.",
    start_url: "/br",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF8F3",
    theme_color: "#7A3B2C",
    lang: "pt-BR",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
