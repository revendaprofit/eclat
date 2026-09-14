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

// Banner INTERATIVO do celular (2026-09-14): céu do amanhecer com os textos + palco com a modelo
// girando 360° (arrastar gira, botões trocam a peça). Liga por chave no Cockpit; vence vídeo/imagem
// só no mobile e só se houver pelo menos uma peça completa — senão o celular segue como estava.
export type HeroPecaInput = {
  nome?: string | null
  cor?: string | null
  cor_hex?: string | null
  video_url?: string | null
  poster_url?: string | null
}

export type HeroPeca = { id: string; nome: string; cor: string | null; corHex: string | null; video: string; poster: string }

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")

export function heroInterativo(c: {
  interativo_mobile?: boolean | null
  interativo_ceu_url?: string | null
  interativo_pecas?: HeroPecaInput[] | null
}): { ceu: string | null; pecas: HeroPeca[] } | null {
  if (c.interativo_mobile !== true || !Array.isArray(c.interativo_pecas)) return null
  const vistos = new Set<string>()
  const pecas: HeroPeca[] = []
  for (const p of c.interativo_pecas) {
    const nome = str(p?.nome)
    const video = str(p?.video_url)
    const poster = str(p?.poster_url)
    if (!nome || !video || !poster) continue
    const cor = str(p.cor)
    let id = slug(cor ? `${nome} ${cor}` : nome) || "peca"
    for (let n = 2; vistos.has(id); n++) id = `${slug(cor ? `${nome} ${cor}` : nome)}-${n}`
    vistos.add(id)
    pecas.push({ id, nome, cor, corHex: str(p.cor_hex), video, poster })
  }
  return pecas.length ? { ceu: str(c.interativo_ceu_url), pecas } : null
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
