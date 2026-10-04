// Link da creator: /p/<apelido> (geral) e /p/<apelido>/<n> (vídeo número n). Parte pura.
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md (C6 e C11).
// O link grava um cookie de 30 dias (o último link clicado vence) e o cupom dela entra sozinho na sacola, se a
// cliente não tiver outro. A comissão continua valendo SÓ pelo cupom no pedido; o link diz de onde ela veio.

export const COOKIE_PARCEIRA = "eclat_parceira"
export const COOKIE_PARCEIRA_MAX_AGE = 60 * 60 * 24 * 30

export type Parceira = { apelido: string; codigo: string; conteudo: number | null }

export function limparApelido(v: unknown): string {
  const a = typeof v === "string" ? v.trim().toLowerCase() : ""
  return /^[a-z0-9][a-z0-9-]{1,30}$/.test(a) ? a : ""
}

/** Número do vídeo: inteiro de 1 a 999. Qualquer outra coisa = link geral. */
export function limparNumeroDoVideo(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,3}$/.test(v.trim()) ? Number(v.trim()) : NaN
  return Number.isInteger(n) && n >= 1 && n <= 999 ? n : null
}

const CODIGO = /^[A-Z0-9][A-Z0-9_-]{1,39}$/

export function serializarParceira(p: Parceira): string {
  return [p.apelido, p.codigo.toUpperCase(), p.conteudo ?? ""].join("|")
}

/** Cookie → dados; qualquer coisa fora do formato = sem parceira. */
export function lerParceira(valor: string | null | undefined): Parceira | null {
  if (!valor) return null
  const [apelido, codigo, conteudo] = decodeURIComponent(valor).split("|")
  const a = limparApelido(apelido)
  const c = (codigo ?? "").trim().toUpperCase()
  if (!a || !CODIGO.test(c)) return null
  return { apelido: a, codigo: c, conteudo: limparNumeroDoVideo(conteudo ?? "") }
}

/**
 * O que fazer com a sacola de quem chegou pelo link:
 *  - "nada": já foi marcada com este link (não reaplica — se ela tirou o cupom, respeita), ou tem OUTRO cupom.
 *  - "aplicar": põe o cupom da creator e grava de qual link/vídeo ela veio.
 */
export function decidirCupomDaParceira(args: {
  parceira: Parceira
  metadata?: Record<string, unknown> | null
  cuponsVisiveis: string[]
}): "nada" | "aplicar" {
  const { parceira, metadata, cuponsVisiveis } = args
  const marcado = typeof metadata?.parceria_link === "string" ? metadata.parceria_link.toUpperCase() : null
  const conteudoMarcado = metadata?.parceria_conteudo == null ? null : Number(metadata.parceria_conteudo)
  if (marcado === parceira.codigo && conteudoMarcado === parceira.conteudo) return "nada"
  const outros = cuponsVisiveis.map((c) => c.toUpperCase()).filter((c) => c !== parceira.codigo)
  if (outros.length > 0) return "nada"
  return "aplicar"
}
