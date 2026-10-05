// Ciclo dos creators — parte pura da tela Crescimento → Creators.
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md §9.
// As mesmas regras do backend (apps/backend/src/lib/creator-regras.ts e parceria-regras.ts): se mudar lá, mude aqui.
//  - vídeo vencedor = 3 vendas em qualquer período de 14 dias (a marca `vencedor_em` é gravada pelo backend);
//  - 2ª peça com 5 vendas que contam (pagas e não canceladas);
//  - parada = 21 dias sem publicar sobre a marca.

export const META_SEGUNDA_PECA = 5
export const DIAS_PARA_PARADA = 21
export const PRIMEIRO_NUMERO_AUTOMATICO = 1001
const DIA_MS = 24 * 60 * 60 * 1000

export type CreatorLinha = {
  id: string
  instagram: string
  nome: string | null
  status: string
  parceria_codigo: string | null
  aprovada_em: string | null
}
export type ParceriaLinha = { codigo: string; nome: string; apelido_link: string | null; comissao_percentual: number; ativa: boolean }
export type VideoLinha = {
  id: string
  creator_id: string
  numero: number
  formato: string
  titulo: string | null
  link_post: string | null
  publicado_em: string | null
  vencedor_em: string | null
  em_anuncio: boolean
  criado_em?: string | null
}
export type AvisoLinha = {
  order_id: string
  codigo: string
  entrega_id: string | null
  pedido_em: string
  base_centavos: number
  comissao_centavos: number
  status: string
}
export type LeituraLinha = { creator_id: string; seguidores: number | null; engajamento_pct: number | null; lido_em: string }

export type VideoDoPainel = VideoLinha & {
  vendas: number
  origem: "perfil" | "link" // perfil = cadastrado pela leitura do Instagram; link = número que a creator pôs no link
  link_da_loja: string | null
}
export type CreatorDoPainel = {
  id: string
  nome: string
  instagram: string
  codigo: string | null
  link: string | null
  situacao: "ativa" | "parada"
  ultimo_video_em: string | null
  seguidores: number | null
  engajamento_pct: number | null
  lido_em: string | null
  vendas_que_contam: number
  comissao_centavos: number
  falta_para_segunda_peca: number // 0 = liberada
  videos: VideoDoPainel[]
}

export function situacaoDaCreator(ultimoVideoIso: string | null, agora: Date): "ativa" | "parada" {
  if (!ultimoVideoIso) return "parada"
  return agora.getTime() - new Date(ultimoVideoIso).getTime() <= DIAS_PARA_PARADA * DIA_MS ? "ativa" : "parada"
}

/** Monta o painel. `cancelados` = ids de pedidos cancelados no Medusa (não contam). */
export function montarPainel(args: {
  creators: CreatorLinha[]
  parcerias: ParceriaLinha[]
  videos: VideoLinha[]
  avisos: AvisoLinha[]
  leituras: LeituraLinha[]
  cancelados: Set<string>
  agora: Date
  lojaUrl: string
}): CreatorDoPainel[] {
  const { creators, parcerias, videos, avisos, leituras, cancelados, agora, lojaUrl } = args
  const contam = avisos.filter((a) => !cancelados.has(a.order_id))
  const base = lojaUrl.replace(/\/+$/, "")
  return creators
    .filter((c) => c.status === "aprovada")
    .map((c) => {
      const parceria = parcerias.find((p) => p.codigo === c.parceria_codigo) ?? null
      const link = parceria?.apelido_link ? `${base}/p/${parceria.apelido_link}` : null
      const meus = videos.filter((v) => v.creator_id === c.id)
      const vendasDela = contam.filter((a) => a.codigo === c.parceria_codigo)
      const leitura = leituras.filter((l) => l.creator_id === c.id).sort((a, b) => b.lido_em.localeCompare(a.lido_em))[0] ?? null
      const ultimo = meus.map((v) => v.publicado_em).filter((d): d is string => !!d).sort().pop() ?? null
      return {
        id: c.id,
        nome: c.nome || parceria?.nome || c.instagram,
        instagram: c.instagram,
        codigo: c.parceria_codigo,
        link,
        situacao: situacaoDaCreator(ultimo, agora),
        ultimo_video_em: ultimo,
        seguidores: leitura?.seguidores ?? null,
        engajamento_pct: leitura?.engajamento_pct ?? null,
        lido_em: leitura?.lido_em ?? null,
        vendas_que_contam: vendasDela.length,
        comissao_centavos: vendasDela.reduce((s, a) => s + a.comissao_centavos, 0),
        falta_para_segunda_peca: Math.max(0, META_SEGUNDA_PECA - vendasDela.length),
        videos: meus
          .map((v): VideoDoPainel => ({
            ...v,
            vendas: vendasDela.filter((a) => a.entrega_id === v.id).length,
            origem: v.numero >= PRIMEIRO_NUMERO_AUTOMATICO ? "perfil" : "link",
            link_da_loja: link && v.numero < PRIMEIRO_NUMERO_AUTOMATICO ? `${link}/${v.numero}` : null,
          }))
          .sort((a, b) => (b.publicado_em ?? b.criado_em ?? "").localeCompare(a.publicado_em ?? a.criado_em ?? "")),
      }
    })
    .sort((a, b) => b.vendas_que_contam - a.vendas_que_contam || a.nome.localeCompare(b.nome))
}

const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo" })
const primeiroNome = (n: string) => n.trim().split(/\s+/)[0]
const nomeDoVideo = (v: VideoDoPainel) => v.titulo?.trim() || (v.origem === "link" ? `Vídeo nº ${v.numero}` : "Vídeo sem título")

/**
 * Resumo da semana para a Camila colar no grupo das creators (o sistema NÃO envia: proteção do número).
 * Só fala de vídeo e de quantidade de vendas — nenhum dado de cliente, nenhum valor de comissão de outra creator.
 */
export function resumoSemanal(painel: CreatorDoPainel[], avisos: AvisoLinha[], cancelados: Set<string>, agora: Date, briefing = ""): string {
  const desde = new Date(agora.getTime() - 7 * DIA_MS).toISOString()
  const vendasDaSemana = avisos.filter((a) => !cancelados.has(a.order_id) && a.pedido_em >= desde)
  const todos = painel.flatMap((c) => c.videos.map((v) => ({ c, v })))

  const venderam = todos
    .map(({ c, v }) => ({ c, v, n: vendasDaSemana.filter((a) => a.entrega_id === v.id).length }))
    .filter((x) => x.n > 0)
    .sort((a, b) => b.n - a.n)
  const vencedores = todos.filter(({ v }) => v.vencedor_em && v.vencedor_em >= desde)
  const novos = todos.filter(({ v }) => v.publicado_em && v.publicado_em >= desde)

  const linhas: string[] = [`*Creators ÉCLAT · semana de ${dia(desde)} a ${dia(agora.toISOString())}* ✨`, ""]
  linhas.push("*Vídeos que venderam*")
  if (venderam.length) {
    for (const { c, v, n } of venderam) {
      linhas.push(`• ${primeiroNome(c.nome)} — ${nomeDoVideo(v)} — ${n} ${n === 1 ? "venda" : "vendas"}${v.link_post ? `\n  ${v.link_post}` : ""}`)
    }
  } else linhas.push("Nenhuma venda por vídeo nesta semana. Bora virar esse jogo 💪")

  if (vencedores.length) {
    linhas.push("", "*Vídeo vencedor (3 vendas em 14 dias)* 🏆")
    for (const { c, v } of vencedores) linhas.push(`• ${primeiroNome(c.nome)} — ${nomeDoVideo(v)}${v.link_post ? `\n  ${v.link_post}` : ""}`)
  }
  if (novos.length) {
    linhas.push("", "*Vídeos novos da semana*")
    for (const { c, v } of novos) linhas.push(`• ${primeiroNome(c.nome)} — ${nomeDoVideo(v)}${v.link_post ? `\n  ${v.link_post}` : ""}`)
  }
  const b = briefing.trim()
  if (b) linhas.push("", "*Ideias para a próxima semana*", b)
  return linhas.join("\n")
}

// ---- Edição e cadastro manual de vídeo ----

export type EdicaoVideo = Partial<Pick<VideoLinha, "titulo" | "link_post" | "em_anuncio" | "publicado_em">>

const linkDoInstagram = (v: unknown): string | null => {
  const s = typeof v === "string" ? v.trim() : ""
  return /^https:\/\/(www\.)?instagram\.com\/[^\s]+$/.test(s) ? s.split("?")[0] : null
}

export function validarEdicaoVideo(input: Record<string, unknown>): { ok: true; valor: EdicaoVideo } | { ok: false; erro: string } {
  const valor: EdicaoVideo = {}
  if ("titulo" in input) valor.titulo = String(input.titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null
  if ("em_anuncio" in input) valor.em_anuncio = input.em_anuncio === true
  if ("link_post" in input) {
    const vazio = input.link_post == null || input.link_post === ""
    const l = vazio ? null : linkDoInstagram(input.link_post)
    if (!vazio && !l) return { ok: false, erro: "O link do post precisa ser do instagram.com." }
    valor.link_post = l
  }
  if ("publicado_em" in input) {
    const d = new Date(String(input.publicado_em))
    if (Number.isNaN(d.getTime())) return { ok: false, erro: "Data de publicação inválida." }
    valor.publicado_em = d.toISOString()
  }
  if (!Object.keys(valor).length) return { ok: false, erro: "Nada para alterar." }
  return { ok: true, valor }
}

export type NovoVideo = { creator_id: string; link_post: string; titulo: string | null; publicado_em: string; formato: "reels" | "post" | "stories" }

/** Vídeo cadastrado à mão (post sem legenda, ou que a leitura não pegou). */
export function validarNovoVideo(input: Record<string, unknown>): { ok: true; valor: NovoVideo } | { ok: false; erro: string } {
  const creator_id = typeof input.creator_id === "string" ? input.creator_id : ""
  if (!/^[0-9a-f-]{36}$/i.test(creator_id)) return { ok: false, erro: "Escolha a creator." }
  const link = linkDoInstagram(input.link_post)
  if (!link) return { ok: false, erro: "Cole o link do post no instagram.com." }
  const d = new Date(String(input.publicado_em ?? ""))
  if (Number.isNaN(d.getTime())) return { ok: false, erro: "Informe a data de publicação." }
  const formato = input.formato === "post" || input.formato === "stories" ? input.formato : "reels"
  const titulo = String(input.titulo ?? "").replace(/\s+/g, " ").trim().slice(0, 120) || null
  return { ok: true, valor: { creator_id, link_post: link, titulo, publicado_em: d.toISOString(), formato } }
}

export function proximoNumeroAutomatico(numeros: number[]): number {
  return Math.max(PRIMEIRO_NUMERO_AUTOMATICO - 1, ...numeros.filter((n) => n >= PRIMEIRO_NUMERO_AUTOMATICO)) + 1
}
