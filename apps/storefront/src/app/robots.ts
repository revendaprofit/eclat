import { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"

// robots.txt — permite indexação e crawlers de IA (GEO), bloqueia áreas privadas/transacionais.
const PRIVATE = ["/*/account", "/*/cart", "/*/checkout", "/*/order", "/*/busca"]

// Bots de busca por IA — liberados para poderem RASTREAR e CITAR a marca.
const AI_BOTS = [
  "GPTBot", // OpenAI (treino/índice)
  "OAI-SearchBot", // ChatGPT Search
  "ChatGPT-User", // navegação sob demanda do ChatGPT
  "PerplexityBot", // Perplexity
  "Perplexity-User",
  "ClaudeBot", // Anthropic
  "Claude-User",
  "Google-Extended", // Gemini / AI Overviews (treino)
  "Applebot-Extended", // Apple Intelligence
  "Bytespider", // TikTok/Doubao
  "Amazonbot",
  "cohere-ai",
]

export default function robots(): MetadataRoute.Robots {
  const base = getBaseURL()
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE,
      },
      // Libera explicitamente os crawlers de IA (mesmas áreas públicas).
      ...AI_BOTS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: PRIVATE,
      })),
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  }
}
