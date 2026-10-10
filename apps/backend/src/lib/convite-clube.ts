// Convite para o Clube Éclat depois do despacho (pedido da sócia, 2026-10-08).
//
// Logo depois da mensagem de despacho (com o rastreio), quem comprou recebe UMA mensagem convidando
// para o grupo fechado do WhatsApp — só se ainda não estiver nele. Sai pelo job a cada 5 minutos
// (jobs/convite-clube.ts), e não de dentro do remetente do despacho, de propósito: o despacho tem dois
// caminhos (backend e Cockpit, conforme o interruptor SUPERFRETE_AVISO_PELO_BACKEND) e o convite
// precisa de um só. O atraso de alguns minutos é o ritmo natural: a cliente lê o rastreio, depois o convite.
//
// Marca em `metadata.clube_convite` do pedido: { status, em } com status
//   enviado | no_grupo | sem_whatsapp | incerto | enviando (reserva; transitório)
// A reserva é um UPDATE condicional (só grava se ainda não há marca): duas rodadas nunca mandam duas vezes.
// DUPLICAR É PIOR QUE FALTAR — toda ambiguidade pende para "não mandar".
// DADO PESSOAL: log só com número do pedido e status; nunca telefone ou nome.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { dataDeDespacho, type PedidoBruto } from "./avaliacao-regras"
import { CLUBE_GRUPO_URL, CLUBE_INTERESSE } from "./clube"
import { connectionState, evolutionConfigured, EvolutionHttpError, groupParticipants, sendWhatsappText } from "./evolution"
import { chaveContato, normalizarContato, primeiroNome } from "./recuperacao-regras"
import { getLeadByWhatsapp, supabaseConfigured, updateLead } from "./supabase"

export const CLUBE_GRUPO_JID = process.env.CLUBE_ECLAT_GRUPO_JID || "120363159357034423@g.us"

const MIN = 60_000
const HORA = 60 * MIN
/** Espera depois do despacho antes de convidar: a mensagem do rastreio chega primeiro. */
export const ATRASO_APOS_DESPACHO_MS = 10 * MIN
/** Despacho mais velho que isto não recebe mais convite (evita mandar para pedidos antigos). */
export const JANELA_APOS_DESPACHO_MS = 24 * HORA
const TIMEOUT_WHATSAPP_MS = 15_000
const DELAY_DIGITANDO_MS = 3_000
const MAX_POR_RODADA = 5

type Log = { info: (m: string) => void; warn: (m: string) => void }

export function textoConviteClube(nome: string | null | undefined, link: string = CLUBE_GRUPO_URL): string {
  return [
    `Oi, ${nome || "tudo bem"}! 💛`,
    "Enquanto o seu pedido não chega, um convite: a ÉCLAT tem um grupo fechado no WhatsApp, o *Clube Éclat*.",
    "",
    "É lá que quem veste a marca participa das decisões: opina nas próximas coleções, vê as peças antes de todo mundo e recebe benefícios, condições exclusivas e as novidades em primeira mão.",
    "",
    `Se quiser entrar, é só tocar aqui: ${link}`,
    "",
    "Entra e sai quando quiser, sem compromisso. ✨",
  ].join("\n")
}

/** Está no grupo? Compara pela chave 55+DDD+8 dígitos (o JID de muitos celulares BR vem sem o 9). */
export function estaNoGrupo(participantes: string[], telefone: string | null | undefined): boolean {
  const alvo = chaveContato(telefone)
  if (!alvo) return false
  return participantes.some((p) => chaveContato(p.replace(/@.*/, "")) === alvo)
}

export type CandidatoConvite = { order_id: string; display_id: number; telefone: string; nome: string | null }

/** Pedido → candidato ao convite, ou o motivo de ficar de fora. Puro. */
export function candidatoAoConvite(p: PedidoBruto, agora: number = Date.now()): CandidatoConvite | { fora: string } {
  if (p.status === "canceled") return { fora: "cancelado" }
  if ((p.email ?? "").toLowerCase().endsWith("@eclat.local")) return { fora: "teste" }
  if (p.metadata?.clube_convite) return { fora: "ja_tratado" }
  const despacho = dataDeDespacho(p)
  if (!despacho) return { fora: "nao_despachado" }
  if (agora - despacho < ATRASO_APOS_DESPACHO_MS) return { fora: "cedo" }
  if (agora - despacho > JANELA_APOS_DESPACHO_MS) return { fora: "antigo" }
  const telefone = normalizarContato(p.shipping_address?.phone ?? (p.metadata?.whatsapp as string | undefined))
  if (!telefone) return { fora: "sem_telefone" }
  return { order_id: p.id, display_id: Number(p.display_id), telefone, nome: primeiroNome(p.shipping_address?.first_name) }
}

// O mínimo do knex que usamos (igual a aviso-despacho.ts).
type Pg = { raw: (sql: string, bindings?: readonly unknown[]) => PromiseLike<{ rows: Record<string, unknown>[] }> }

const SQL_MARCAR = `UPDATE "order" SET metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('clube_convite', ?::jsonb) WHERE id = ?`

/** Grava a marca SÓ se ainda não existe (reserva atômica). Devolve true se gravou. */
export async function reservarConvite(pg: Pg, orderId: string, marca: Record<string, unknown>): Promise<boolean> {
  const { rows } = await pg.raw(`${SQL_MARCAR} AND (metadata->'clube_convite') IS NULL RETURNING id`, [JSON.stringify(marca), orderId])
  return rows.length > 0
}

async function marcar(pg: Pg, orderId: string, marca: Record<string, unknown>): Promise<void> {
  await pg.raw(SQL_MARCAR, [JSON.stringify(marca), orderId])
}

const CAMPOS = [
  "id", "display_id", "created_at", "status", "email", "metadata",
  "shipping_address.first_name", "shipping_address.phone",
  "fulfillments.shipped_at", "fulfillments.canceled_at",
]

export async function enviarConvitesClube(container: MedusaContainer, log: Log): Promise<void> {
  if (!evolutionConfigured()) return
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as unknown as Pg
  const { data } = await query.graph({
    entity: "order",
    fields: CAMPOS,
    filters: { created_at: { $gte: new Date(Date.now() - 30 * 24 * HORA) } },
    pagination: { take: 300, skip: 0, order: { created_at: "DESC" } },
  })
  const agora = Date.now()
  const candidatos: CandidatoConvite[] = []
  for (const p of (data ?? []) as unknown as PedidoBruto[]) {
    const c = candidatoAoConvite(p, agora)
    if (!("fora" in c)) candidatos.push(c)
  }
  if (!candidatos.length) return
  if ((await connectionState()) !== "open") {
    log.warn(`[clube-convite] ${candidatos.length} convite(s) esperando: WhatsApp da marca não está conectado`)
    return
  }
  let participantes: string[]
  try {
    participantes = await groupParticipants(CLUBE_GRUPO_JID, { timeoutMs: TIMEOUT_WHATSAPP_MS })
  } catch (e) {
    // Sem a lista não dá para saber quem já está no grupo: espera a próxima rodada (nada é enviado).
    log.warn(`[clube-convite] lista do grupo indisponível (${(e as Error)?.name ?? "erro"}) — ${candidatos.length} convite(s) ficam para a próxima rodada`)
    return
  }
  for (const c of candidatos.slice(0, MAX_POR_RODADA)) {
    const n = c.display_id
    if (estaNoGrupo(participantes, c.telefone)) {
      await marcar(pg, c.order_id, { status: "no_grupo", em: new Date().toISOString() })
      log.info(`[clube-convite] pedido #${n}: cliente já está no grupo — sem convite`)
      continue
    }
    if (!(await reservarConvite(pg, c.order_id, { status: "enviando", em: new Date().toISOString() }))) continue
    try {
      await sendWhatsappText(c.telefone, textoConviteClube(c.nome), DELAY_DIGITANDO_MS, { timeoutMs: TIMEOUT_WHATSAPP_MS })
    } catch (e) {
      if (e instanceof EvolutionHttpError && e.numeroInexistente) {
        await marcar(pg, c.order_id, { status: "sem_whatsapp", em: new Date().toISOString() })
        log.warn(`[clube-convite] pedido #${n}: número sem WhatsApp — sem convite`)
      } else {
        // Pode ter saído (timeout) ou não (5xx). Nunca reenviar: fica "incerto" para o operador conferir.
        await marcar(pg, c.order_id, { status: "incerto", em: new Date().toISOString(), erro: (e as Error)?.name ?? "erro" })
        log.warn(`[clube-convite] pedido #${n}: envio incerto (${(e as Error)?.name ?? "erro"}) — não será reenviado`)
      }
      continue
    }
    await marcar(pg, c.order_id, { status: "enviado", em: new Date().toISOString() })
    log.info(`[clube-convite] pedido #${n}: convite para o Clube enviado`)
    // Marca o lead como já convidado: o robô do Clube (lib/clube.ts) não repete o link se ela escrever "clube".
    if (supabaseConfigured()) {
      try {
        const lead = await getLeadByWhatsapp(c.telefone)
        if (lead && !(lead.interesse ?? "").includes(CLUBE_INTERESSE)) await updateLead(lead.id, { interesse: CLUBE_INTERESSE })
      } catch {
        /* best-effort */
      }
    }
  }
}

// --------------------------------------------------------------------------------------------
// Quem já comprou NÃO recebe a resposta automática de lead do Clube (foi o que aconteceu com o
// pedido #28: a cliente respondeu "Amei!!" ao rastreio e levou a saudação de lead com cupom de
// primeira compra). Cache de 5 min das chaves de contato dos pedidos recentes.
let cacheClientes: { em: number; chaves: Set<string> } | null = null
export async function ehClienteComPedido(container: MedusaContainer, numero: string): Promise<boolean> {
  const chave = chaveContato(numero)
  if (!chave) return false
  if (!cacheClientes || Date.now() - cacheClientes.em > 5 * MIN) {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "shipping_address.phone", "metadata"],
      filters: { created_at: { $gte: new Date(Date.now() - 180 * 24 * HORA) } },
      pagination: { take: 500, skip: 0 },
    })
    const chaves = new Set<string>()
    for (const p of (data ?? []) as unknown as PedidoBruto[]) {
      const k = chaveContato(p.shipping_address?.phone ?? (p.metadata?.whatsapp as string | undefined))
      if (k) chaves.add(k)
    }
    cacheClientes = { em: Date.now(), chaves }
  }
  return cacheClientes.chaves.has(chave)
}
