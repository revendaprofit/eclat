// Imagem padrão dos links da loja (WhatsApp, Instagram, Facebook): a mesma de `app/opengraph-image.jpg`.
//
// Por que existe: no Next, quando a página define `openGraph` próprio (título, descrição), a imagem do arquivo
// `app/opengraph-image.jpg` NÃO é herdada — o link sai sem foto (achado de 2026-10-01: categorias, coleções, loja,
// editorial e páginas institucionais). Toda página que escreve `openGraph` sem foto própria usa esta.
export const IMAGEM_OG_PADRAO = { url: "/opengraph-image.jpg", width: 1200, height: 630, alt: "use.ÉCLAT — Coleção Lumière" }

/** Foto própria da página (produto, conjunto, capa do editorial) ou, sem ela, a padrão. */
export function imagensOg(url?: string | null) {
  return url ? [url] : [IMAGEM_OG_PADRAO]
}
