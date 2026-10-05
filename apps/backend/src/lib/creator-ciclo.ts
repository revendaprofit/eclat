// Ciclo dos creators (desenho 2026-09-29-programa-creators-design.md §9; decisões do dono em 2026-10-04/05).
//
// 1) Rotina diária: lê o perfil público de cada creator aprovada (Business Discovery da Meta), grava a leitura
//    (seguidores, engajamento) e cadastra sozinha os posts que citam a marca. A Camila só aceita o Collab no
//    Instagram; o vídeo aparece no Cockpit no dia seguinte.
// 2) A venda sem número de vídeo (cupom digitado, link da bio) vai para o último vídeo publicado até 14 dias antes.
// 3) Vídeo com 3 vendas em qualquer período de 14 dias vira vencedor (marca gravada uma vez).
//
// Só leitura na Meta. Limites: só perfil profissional (creator/comercial); Stories não aparecem nessa leitura.
// Variáveis: META_IG_TOKEN e META_IG_USER_ID (Railway). Sem elas a rotina não lê perfis, mas (2) e (3) seguem.
// Nenhum log leva token, telefone ou nome de cliente.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  creatorsDoCiclo, criarVideo, gravarLeitura, ligarVendaAoVideo, marcarVencedor, parceriaDbConfigured, temLeituraDesde,
  vendasDoVideo, vendasSemVideo, videosDaParceria, videosDoCreator, type CreatorDoCiclo,
} from "./parceria-db"
import {
  citaAMarca, ehVencedor, engajamento, formatoDoPost, proximoNumeroAutomatico, tituloDoPost, videoDaVenda, type PostDoPerfil,
} from "./creator-regras"

type Log = { info: (m: string) => void; warn: (m: string) => void }

const GRAPH = "https://graph.facebook.com/v21.0"
// 30 posts: a Paty publica mais de um por dia (12 posts cobriam só 10 dias em 2026-10-05). Com 30, a rotina pode
// falhar alguns dias sem perder vídeo.
const POSTS_POR_LEITURA = 30

export function instagramConfigured(): boolean {
  return Boolean(process.env.META_IG_TOKEN && process.env.META_IG_USER_ID)
}

type Perfil = { seguidores: number | null; posts: number | null; midias: PostDoPerfil[] }

/** Perfil público de outra conta profissional. Lança com o código do erro da Meta (nunca com o token). */
export async function lerPerfil(handle: string): Promise<Perfil> {
  const usuario = handle.replace(/[^A-Za-z0-9._]/g, "")
  const campos = `business_discovery.username(${usuario}){followers_count,media_count,media.limit(${POSTS_POR_LEITURA}){caption,permalink,timestamp,media_type,media_product_type,like_count,comments_count}}`
  const url = `${GRAPH}/${process.env.META_IG_USER_ID}?fields=${encodeURIComponent(campos)}&access_token=${encodeURIComponent(process.env.META_IG_TOKEN as string)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(30_000) })
  const corpo = (await res.json().catch(() => ({}))) as {
    business_discovery?: { followers_count?: number; media_count?: number; media?: { data?: PostDoPerfil[] } }
    error?: { code?: number; error_subcode?: number }
  }
  if (!res.ok || !corpo.business_discovery) {
    throw new Error(`Meta HTTP ${res.status}, código ${corpo.error?.code ?? "?"}${corpo.error?.error_subcode ? `/${corpo.error.error_subcode}` : ""}`)
  }
  const b = corpo.business_discovery
  return { seguidores: b.followers_count ?? null, posts: b.media_count ?? null, midias: b.media?.data ?? [] }
}

/** Vendas da creator ainda sem vídeo → último vídeo publicado até 14 dias antes de cada uma. */
export async function atribuirVendasSemVideo(codigo: string): Promise<string[]> {
  const semVideo = await vendasSemVideo(codigo)
  if (!semVideo.length) return []
  const videos = await videosDaParceria(codigo)
  const tocados = new Set<string>()
  for (const venda of semVideo) {
    const id = videoDaVenda(venda.pedido_em, videos)
    if (!id) continue
    await ligarVendaAoVideo(venda.order_id, id)
    tocados.add(id)
  }
  return [...tocados]
}

/** Confere se o vídeo bateu 3 vendas (pagas e não canceladas) em 14 dias; marca uma vez. */
export async function conferirVencedor(container: MedusaContainer, entregaId: string, log: Log): Promise<void> {
  const vendas = await vendasDoVideo(entregaId)
  if (vendas.length < 3) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "order", fields: ["id", "status"], filters: { id: vendas.map((v) => v.order_id) } })
  const cancelados = new Set((data as { id: string; status?: string }[]).filter((p) => p.status === "canceled").map((p) => p.id))
  const datas = vendas.filter((v) => !cancelados.has(v.order_id)).map((v) => v.pedido_em)
  if (ehVencedor(datas) && (await marcarVencedor(entregaId, new Date().toISOString()))) {
    log.info(`[creators] vídeo vencedor: ${entregaId} (${datas.length} vendas)`)
  }
}

/** Depois de registrar uma venda: liga ao vídeo (se veio sem número) e confere o vencedor. Nunca lança. */
export async function aposVendaDaParceria(container: MedusaContainer, codigo: string, entregaId: string | null, log: Log): Promise<void> {
  try {
    const tocados = entregaId ? [entregaId] : await atribuirVendasSemVideo(codigo)
    for (const id of tocados) await conferirVencedor(container, id, log)
  } catch (e) {
    log.warn(`[creators] pós-venda de ${codigo}: ${(e as Error).message}`)
  }
}

async function lerUmaCreator(c: CreatorDoCiclo, agora: Date, log: Log): Promise<void> {
  const perfil = await lerPerfil(c.instagram)
  const inicioDoDia = new Date(agora.getTime() - 20 * 60 * 60 * 1000).toISOString() // uma leitura gravada por dia
  if (!(await temLeituraDesde(c.id, inicioDoDia))) {
    await gravarLeitura({ creator_id: c.id, seguidores: perfil.seguidores, posts: perfil.posts, ...engajamento(perfil.midias, perfil.seguidores) })
  }
  const existentes = await videosDoCreator(c.id)
  const links = new Set(existentes.map((v) => v.link_post).filter(Boolean))
  const numeros = existentes.map((v) => v.numero)
  // do mais antigo para o mais novo: a numeração segue a ordem de publicação
  const novos = perfil.midias
    .filter((p) => p.permalink && !links.has(p.permalink) && citaAMarca(p.caption, c.parceria_codigo ?? ""))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
  for (const p of novos) {
    const numero = proximoNumeroAutomatico(numeros)
    const criado = await criarVideo({
      creator_id: c.id,
      numero,
      formato: formatoDoPost(p),
      titulo: tituloDoPost(p.caption),
      link_post: p.permalink,
      publicado_em: new Date(p.timestamp).toISOString(),
    })
    numeros.push(numero)
    if (criado) log.info(`[creators] vídeo novo de @${c.instagram}: nº ${numero} (${p.permalink})`)
  }
}

/** Rotina diária. Nunca lança; um perfil que falha não impede os outros. */
export async function rodarCicloDosCreators(container: MedusaContainer, agora: Date, log: Log): Promise<void> {
  if (!parceriaDbConfigured()) return
  let creators: CreatorDoCiclo[] = []
  try {
    creators = await creatorsDoCiclo() // tabela ausente (migration 0014) = rotina inexistente
  } catch {
    return
  }
  for (const c of creators) {
    if (instagramConfigured()) {
      try {
        await lerUmaCreator(c, agora, log)
      } catch (e) {
        log.warn(`[creators] leitura de @${c.instagram} falhou: ${(e as Error).message}`)
      }
    }
    if (c.parceria_codigo) {
      try {
        // vídeo cadastrado hoje pode ser o de uma venda de ontem que estava sem vídeo
        const tocados = await atribuirVendasSemVideo(c.parceria_codigo)
        for (const id of tocados) await conferirVencedor(container, id, log)
      } catch (e) {
        log.warn(`[creators] atribuição de ${c.parceria_codigo} falhou: ${(e as Error).message}`)
      }
    }
  }
}
