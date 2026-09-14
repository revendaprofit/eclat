// Banner da home: decide, por tela (mobile / desktop), se usa VÍDEO com texto do site por cima ou
// a IMAGEM com texto já desenhado nela (modo antigo). Puro, sem React. Pedido do dono (2026-09-14):
// vídeo gerado a partir da arte sem texto; logo, título, parágrafo e botão vêm do site.

export type HeroMediaInput = {
  banner_mobile_url?: string | null
  banner_desktop_url?: string | null
  image_url?: string | null
  video_mobile_url?: string | null
  video_poster_mobile_url?: string | null
  video_desktop_url?: string | null
  video_poster_desktop_url?: string | null
}

export type HeroTela =
  | { tipo: "video"; video: string; poster: string | null }
  | { tipo: "imagem"; src: string }
  | { tipo: "nenhum" }

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function heroTelas(c: HeroMediaInput): { mobile: HeroTela; desktop: HeroTela } {
  const imgMobile = str(c.banner_mobile_url) ?? str(c.image_url) ?? str(c.banner_desktop_url)
  const imgDesktop = str(c.banner_desktop_url) ?? str(c.banner_mobile_url) ?? str(c.image_url)
  const tela = (video: string | null, poster: string | null, img: string | null): HeroTela =>
    video ? { tipo: "video", video, poster } : img ? { tipo: "imagem", src: img } : { tipo: "nenhum" }
  return {
    mobile: tela(str(c.video_mobile_url), str(c.video_poster_mobile_url), imgMobile),
    desktop: tela(str(c.video_desktop_url), str(c.video_poster_desktop_url), imgDesktop),
  }
}

// Textos sobre o vídeo (os mesmos da arte da coleção Lumière, editáveis no Cockpit).
export type HeroTextos = { eyebrow: string; titulo1: string; titulo2: string; texto: string; cta: string }

export const HERO_TEXTOS_PADRAO: HeroTextos = {
  eyebrow: "Coleção Lumière",
  titulo1: "Feita para",
  titulo2: "brilhar.",
  texto: "O despertar de toda mulher, que não precisa de motivação externa para brilhar. No canelado premium grafitti e telha.",
  cta: "Comprar a coleção",
}

export function heroTextos(c: {
  video_eyebrow?: string | null
  video_titulo_1?: string | null
  video_titulo_2?: string | null
  video_texto?: string | null
  video_cta?: string | null
}): HeroTextos {
  return {
    eyebrow: str(c.video_eyebrow) ?? HERO_TEXTOS_PADRAO.eyebrow,
    titulo1: str(c.video_titulo_1) ?? HERO_TEXTOS_PADRAO.titulo1,
    titulo2: str(c.video_titulo_2) ?? HERO_TEXTOS_PADRAO.titulo2,
    texto: str(c.video_texto) ?? HERO_TEXTOS_PADRAO.texto,
    cta: str(c.video_cta) ?? HERO_TEXTOS_PADRAO.cta,
  }
}
