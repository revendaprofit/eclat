// Acesso às tabelas de parceria e creators no Supabase (service_role, REST/PostgREST).
// Migrations 0013 e 0014. Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md.
import type { ParceriaDoAviso } from "./parceria-regras"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function parceriaDbConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

async function sb<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY as string,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  // O corpo de erro do PostgREST pode ecoar telefone: só o status sobe no erro.
  if (!res.ok) throw new Error(`Supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status}`)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const q = encodeURIComponent
const CAMPOS_PARCERIA = "codigo,nome,whatsapp,comissao_percentual,ativa,aceite_avisos,apelido_link"

export type StatusAviso = "pendente" | "enviando" | "enviado" | "sem_whatsapp" | "dispensado" | "incerto"

export type Aviso = {
  order_id: string
  codigo: string
  display_id: number
  base_centavos: number
  comissao_centavos: number
  entrega_id: string | null
  veio_pelo_link: boolean
  status: StatusAviso
  texto: string | null
  pedido_em: string
  desde: string
  enviado_em: string | null
}

export async function listarParcerias(): Promise<ParceriaDoAviso[]> {
  return (await sb<ParceriaDoAviso[]>(`parceria?select=${CAMPOS_PARCERIA}`)) ?? []
}

export async function parceriaPorCodigo(codigo: string): Promise<ParceriaDoAviso | null> {
  const rows = await sb<ParceriaDoAviso[]>(`parceria?codigo=eq.${q(codigo)}&select=${CAMPOS_PARCERIA}&limit=1`)
  return rows?.[0] ?? null
}

/** Parceria ATIVA dona do apelido do link (C6). */
export async function parceriaPorApelido(apelido: string): Promise<ParceriaDoAviso | null> {
  const rows = await sb<ParceriaDoAviso[]>(`parceria?apelido_link=eq.${q(apelido)}&ativa=eq.true&select=${CAMPOS_PARCERIA}&limit=1`)
  return rows?.[0] ?? null
}

/** Uma linha por pedido: se já existe, não cria de novo e devolve null. */
export async function criarAviso(a: Omit<Aviso, "status" | "texto" | "desde" | "enviado_em">): Promise<Aviso | null> {
  const rows = await sb<Aviso[]>("parceria_aviso?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ ...a, status: "pendente" }),
  })
  return rows?.[0] ?? null
}

/**
 * Transição CONDICIONAL: só muda se o status atual é `de`. É a reserva atômica (uma instrução no Postgres):
 * quem muda a linha envia; quem chega depois recebe null e não envia. Duplicar é pior que faltar.
 */
export async function mudarAviso(orderId: string, de: StatusAviso, campos: Partial<Aviso>): Promise<Aviso | null> {
  const rows = await sb<Aviso[]>(`parceria_aviso?order_id=eq.${q(orderId)}&status=eq.${de}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(campos),
  })
  return rows?.[0] ?? null
}

export async function listarAvisos(filtro: string): Promise<Aviso[]> {
  return (await sb<Aviso[]>(`parceria_aviso?${filtro}`)) ?? []
}

export async function avisoDoPedido(orderId: string): Promise<Aviso | null> {
  return (await listarAvisos(`order_id=eq.${q(orderId)}&select=*&limit=1`))[0] ?? null
}

/** Avisos enviados desde `desdeIso` na loja toda (teto por hora, C5). */
export async function avisosEnviadosDesde(desdeIso: string): Promise<number> {
  return (await listarAvisos(`status=eq.enviado&enviado_em=gte.${q(desdeIso)}&select=order_id`)).length
}

/** Todas as vendas registradas da parceria (para os totais da mensagem e a meta da 2ª peça). */
export async function vendasDaParceria(codigo: string): Promise<Aviso[]> {
  return listarAvisos(`codigo=eq.${q(codigo)}&select=order_id,base_centavos,comissao_centavos,pedido_em&order=pedido_em.asc&limit=1000`)
}

// ---- Vídeo do link /p/<apelido>/<n> (C11) ----

type Creator = { id: string }
type Entrega = { id: string; numero: number }

async function creatorDaParceria(codigo: string): Promise<Creator | null> {
  const rows = await sb<Creator[]>(`creator?parceria_codigo=eq.${q(codigo)}&select=id&limit=1`)
  return rows?.[0] ?? null
}

/**
 * O vídeo número `n` da creator. Se ainda não existe, é criado na hora (a creator põe o número no link sem
 * ninguém cadastrar antes); a Camila dá o nome e o link do post depois, no Cockpit. Sem ficha de creator, null.
 */
export async function entregaDoNumero(codigo: string, numero: number): Promise<string | null> {
  const creator = await creatorDaParceria(codigo)
  if (!creator) return null
  const achar = () => sb<Entrega[]>(`creator_entrega?creator_id=eq.${q(creator.id)}&numero=eq.${numero}&select=id,numero&limit=1`)
  const existente = (await achar())?.[0]
  if (existente) return existente.id
  const criadas = await sb<Entrega[]>("creator_entrega?on_conflict=creator_id,numero", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ creator_id: creator.id, numero, status: "publicada", formato: "stories" }),
  })
  return criadas?.[0]?.id ?? (await achar())?.[0]?.id ?? null
}
