// Ciclo dos creators — a parte pura (sem rede, sem banco).
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md §9 (C11, C12, C15) e decisões de 2026-10-04/05:
//  - a rotina diária lê o perfil público de cada creator e cadastra sozinha os posts que citam a marca;
//  - venda sem número de vídeo vai para o último vídeo publicado até 14 dias antes;
//  - vídeo vencedor = 3 vendas em qualquer período de 14 dias; parada = 21 dias sem publicar.

export const JANELA_DIAS = 14
export const VENDAS_DO_VENCEDOR = 3
export const DIAS_PARA_PARADA = 21
/** Vídeos cadastrados pela rotina começam em 1001: os números de 1 a 999 são os que a creator põe no link. */
export const PRIMEIRO_NUMERO_AUTOMATICO = 1001

const DIA_MS = 24 * 60 * 60 * 1000

export type PostDoPerfil = {
  permalink: string
  caption?: string | null
  timestamp: string
  media_type?: string | null
  media_product_type?: string | null
  like_count?: number | null
  comments_count?: number | null
}

const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

/**
 * O post fala da ÉCLAT? Vale "éclat"/"eclat" como palavra (não pega "eclática"), o @ da marca ou o cupom dela.
 * Sem legenda = não dá para saber = não cadastra (a Camila cadastra à mão no Cockpit).
 */
export function citaAMarca(caption: string | null | undefined, codigoDoCupom: string, arrobaDaMarca = "eclat.use"): boolean {
  const t = semAcento(caption ?? "")
  if (!t.trim()) return false
  if (t.includes("@" + semAcento(arrobaDaMarca))) return true
  const cupom = semAcento(codigoDoCupom).trim()
  if (cupom && t.includes(cupom)) return true
  return /(^|[^a-z0-9])(use\.?)?eclat([^a-z0-9]|$)/.test(t)
}

export function formatoDoPost(p: PostDoPerfil): "reels" | "post" {
  return (p.media_product_type ?? "").toUpperCase() === "REELS" || (p.media_type ?? "").toUpperCase() === "VIDEO" ? "reels" : "post"
}

/** Nome do vídeo na tela e no resumo semanal: o começo da legenda, numa linha. */
export function tituloDoPost(caption: string | null | undefined): string {
  const t = (caption ?? "").replace(/\s+/g, " ").trim()
  if (!t) return "Sem legenda"
  return t.length > 70 ? t.slice(0, 67).trimEnd() + "…" : t
}

/** Próximo número para um vídeo cadastrado pela rotina. */
export function proximoNumeroAutomatico(numerosExistentes: number[]): number {
  return Math.max(PRIMEIRO_NUMERO_AUTOMATICO - 1, ...numerosExistentes.filter((n) => n >= PRIMEIRO_NUMERO_AUTOMATICO)) + 1
}

/**
 * Venda sem número de vídeo (cupom digitado, link da bio): vai para o vídeo mais recente publicado ANTES da venda,
 * se ele tiver até 14 dias. Sem vídeo nessa janela, fica só com a creator (null).
 */
export function videoDaVenda(pedidoEmIso: string, videos: { id: string; publicado_em: string | null }[]): string | null {
  const pedido = new Date(pedidoEmIso).getTime()
  let melhor: { id: string; t: number } | null = null
  for (const v of videos) {
    if (!v.publicado_em) continue
    const t = new Date(v.publicado_em).getTime()
    if (Number.isNaN(t) || t > pedido || pedido - t > JANELA_DIAS * DIA_MS) continue
    if (!melhor || t > melhor.t) melhor = { id: v.id, t }
  }
  return melhor?.id ?? null
}

/** Vídeo vencedor: 3 vendas (que contam) dentro de QUALQUER período de 14 dias. */
export function ehVencedor(datasDasVendasIso: string[]): boolean {
  const ts = datasDasVendasIso.map((d) => new Date(d).getTime()).filter((t) => !Number.isNaN(t)).sort((a, b) => a - b)
  for (let i = 0; i + VENDAS_DO_VENCEDOR - 1 < ts.length; i++) {
    if (ts[i + VENDAS_DO_VENCEDOR - 1] - ts[i] <= JANELA_DIAS * DIA_MS) return true
  }
  return false
}

/** Ativa = publicou sobre a marca nos últimos 21 dias. Sem nenhum vídeo = parada. */
export function situacaoDaCreator(ultimoVideoIso: string | null, agora: Date): "ativa" | "parada" {
  if (!ultimoVideoIso) return "parada"
  return agora.getTime() - new Date(ultimoVideoIso).getTime() <= DIAS_PARA_PARADA * DIA_MS ? "ativa" : "parada"
}

/** (média de curtidas + comentários dos posts lidos) ÷ seguidores, em %, com 2 casas. */
export function engajamento(posts: PostDoPerfil[], seguidores: number | null | undefined) {
  const n = posts.length
  const media = (campo: "like_count" | "comments_count") => (n ? posts.reduce((s, p) => s + (Number(p[campo]) || 0), 0) / n : 0)
  const curtidas = media("like_count")
  const comentarios = media("comments_count")
  const pct = seguidores && seguidores > 0 ? Math.round(((curtidas + comentarios) / seguidores) * 10000) / 100 : null
  return { media_curtidas: Math.round(curtidas * 10) / 10, media_comentarios: Math.round(comentarios * 10) / 10, engajamento_pct: pct }
}
