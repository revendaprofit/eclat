// Depoimentos (home e PDP) — SÓ de clientes reais, com autorização, gravados no Cockpit
// (site_content "home.testimonials"). Sem registro não aparece nada: não existe depoimento
// padrão no código (até 2026-09-30 havia 3 inventados, escondidos por uma trava de data que os
// soltaria em 13/10 — removidos). Cada depoimento precisa de fala e autora.
import type { Testimonial } from "@modules/home/content"

export function depoimentosReais(items: unknown): Testimonial[] {
  if (!Array.isArray(items)) return []
  return items
    .map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
      return {
        quote: typeof o.quote === "string" ? o.quote.trim() : "",
        author: typeof o.author === "string" ? o.author.trim() : "",
        ...(typeof o.origem === "string" && o.origem.trim() ? { origem: o.origem.trim() } : {}),
      }
    })
    .filter((t) => t.quote && t.author)
}
