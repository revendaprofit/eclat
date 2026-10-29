// Depoimentos (home e PDP) — SÓ de clientes reais, com autorização, gravados no Cockpit
// (site_content "home.testimonials"). Sem registro não aparece nada: não existe depoimento
// padrão no código (até 2026-09-30 havia 3 inventados, escondidos por uma trava de data que os
// soltaria em 13/10 — removidos). Cada depoimento precisa de fala e autora; uma FOTO de cliente
// com o look (tipo "foto", sócia 2026-10-23) precisa de imagem e autora, a fala é opcional.
// `produtos` = handles das peças a que o item se refere: a PDP dessas peças mostra a faixa "Quem já veste".
import type { Testimonial } from "@modules/home/content"

const URL_STORAGE = /^https:\/\/[a-z0-9-]+\.supabase\.co\//

export function depoimentosReais(items: unknown): Testimonial[] {
  if (!Array.isArray(items)) return []
  return items
    .map((x) => {
      const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>
      const image_url = typeof o.image_url === "string" && URL_STORAGE.test(o.image_url) ? o.image_url : undefined
      const produtos = Array.isArray(o.produtos) ? o.produtos.filter((p): p is string => typeof p === "string" && !!p.trim()).map((p) => p.trim()) : []
      return {
        quote: typeof o.quote === "string" ? o.quote.trim() : "",
        author: typeof o.author === "string" ? o.author.trim() : "",
        tipo: o.tipo === "foto" ? ("foto" as const) : ("print" as const),
        ...(typeof o.cidade === "string" && o.cidade.trim() ? { cidade: o.cidade.trim() } : {}),
        ...(typeof o.origem === "string" && o.origem.trim() ? { origem: o.origem.trim() } : {}),
        // print real da mensagem ou foto da cliente (só do Storage do site)
        ...(image_url
          ? {
              image_url,
              ...(Number.isInteger(o.image_width) && Number.isInteger(o.image_height) ? { image_width: o.image_width as number, image_height: o.image_height as number } : {}),
            }
          : {}),
        ...(produtos.length ? { produtos } : {}),
      }
    })
    .filter((t) => t.author && (t.tipo === "foto" ? !!t.image_url : !!t.quote))
}

/** Só os prints/falas (o bloco da home não mostra fotos de cliente). */
export function somentePrints(items: Testimonial[]): Testimonial[] {
  return items.filter((t) => t.tipo !== "foto")
}

/** O que foi marcado para uma peça (pelo handle), prints e fotos juntos. */
export function depoimentosDaPeca(items: Testimonial[], handle: string | null | undefined): Testimonial[] {
  if (!handle) return []
  return items.filter((t) => (t.produtos ?? []).includes(handle))
}
