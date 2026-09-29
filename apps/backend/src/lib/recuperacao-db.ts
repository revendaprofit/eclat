// Acesso às tabelas da recuperação automática no Supabase (service_role, REST/PostgREST).
// Só o backend (job e webhook) e o Cockpit escrevem aqui. Ver architecture/recuperacao.md.
import type { DadosRecuperacao, Etapa, Gatilho, LinhaRecuperacao } from "./recuperacao-regras"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function recuperacaoDbConfigured(): boolean {
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
  // O corpo de erro do PostgREST pode ecoar telefone/e-mail: só o status sobe no erro.
  if (!res.ok) throw new Error(`Supabase ${init.method || "GET"} ${path.split("?")[0]}: ${res.status}`)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

const q = encodeURIComponent

export type RecuperacaoConfig = {
  id: number
  whatsapp_ativo: boolean
  email_ativo: boolean
  persona: string
  cupom: string
  janela_inicio: string
  janela_fim: string
  max_abordagens_dia: number
  intervalo_min_min: number
  intervalo_max_min: number
  proximo_envio_em: string | null
  falhas_seguidas: number
}

export type Recuperacao = LinhaRecuperacao & {
  chave: string
  contato_chave: string | null
  nome: string | null
  cart_id: string | null
  lead_id: string | null
  conversation_id: string | null
  dados: DadosRecuperacao
  motivo_fim: string | null
  abordagem_texto: string | null
  oferta_apos: string | null
  oferta_texto: string | null
  oferta_em: string | null
  atualizado_em: string
}

export async function getConfig(): Promise<RecuperacaoConfig | null> {
  const rows = await sb<RecuperacaoConfig[]>("recuperacao_config?id=eq.1&select=*")
  return rows?.[0] ?? null
}

export async function updateConfig(fields: Partial<RecuperacaoConfig>): Promise<void> {
  await sb("recuperacao_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  })
}

export async function listar(filtro: string): Promise<Recuperacao[]> {
  return (await sb<Recuperacao[]>(`recuperacao?${filtro}`)) ?? []
}

export async function porChave(chave: string): Promise<Recuperacao | null> {
  return (await listar(`chave=eq.${q(chave)}&limit=1`))[0] ?? null
}

/** Ocasiões recentes da mesma pessoa (por WhatsApp ou e-mail), da mais nova para a mais velha. */
export async function recentesDaPessoa(contatoChave: string | null, email: string | null, desdeIso: string): Promise<Recuperacao[]> {
  const ou: string[] = []
  if (contatoChave) ou.push(`contato_chave.eq.${contatoChave}`)
  if (email) ou.push(`email.eq."${email.replace(/"/g, "")}"`) // aspas: e-mail pode ter "," ou "."
  if (!ou.length) return []
  return listar(`or=(${q(ou.join(","))})&criado_em=gte.${q(desdeIso)}&order=criado_em.desc`)
}

/** Linha em andamento para quem mandou mensagem (webhook). Casa pelo 55+DDD+8 dígitos. */
export async function ativaPorContatoChave(contatoChave: string): Promise<Recuperacao | null> {
  const rows = await listar(
    `contato_chave=eq.${q(contatoChave)}&etapa=in.(abordada,respondeu,oferta_enviada)&order=abordagem_em.desc&limit=1`
  )
  return rows[0] ?? null
}

export async function inserir(fields: {
  gatilho: Gatilho
  chave: string
  contato: string | null
  contato_chave: string | null
  email: string | null
  nome: string | null
  cart_id?: string | null
  lead_id?: string | null
  elegivel_em: string
  dados: DadosRecuperacao
  etapa?: Etapa
  motivo_fim?: string | null
}): Promise<void> {
  // on_conflict pela chave: a mesma ocasião nunca entra duas vezes.
  await sb("recuperacao?on_conflict=chave", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(fields),
  })
}

export async function atualizar(id: string, fields: Record<string, unknown>): Promise<void> {
  await sb(`recuperacao?id=eq.${q(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, atualizado_em: new Date().toISOString() }),
  })
}

/**
 * Reserva a linha antes de enviar: só passa se ela ainda estiver na etapa esperada. Evita envio
 * duplo se duas rodadas do job se cruzarem (deploy com dois processos por um instante).
 */
export async function reservar(id: string, etapaAtual: Etapa, fields: Record<string, unknown>): Promise<boolean> {
  const rows = await sb<Array<{ id: string }>>(`recuperacao?id=eq.${q(id)}&etapa=eq.${etapaAtual}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...fields, atualizado_em: new Date().toISOString() }),
  })
  return (rows ?? []).length > 0
}

export async function contarAbordagensDesde(desdeIso: string): Promise<number> {
  const rows = await sb<Array<{ id: string }>>(`recuperacao?abordagem_em=gte.${q(desdeIso)}&select=id`)
  return (rows ?? []).length
}
