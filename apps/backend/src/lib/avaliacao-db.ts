// Acesso às tabelas do pedido de avaliação no Supabase (service_role, REST/PostgREST).
// Só o backend (job e webhook) e o Cockpit escrevem aqui. Ver architecture/avaliacao.md.
import type { EtapaAvaliacao } from "./avaliacao-regras"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function avaliacaoDbConfigured(): boolean {
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

export type AvaliacaoConfig = {
  id: number
  ativo: boolean
  dias_apos_entrega: number
  dias_apos_despacho: number
  marco_zero: string
  texto_pedido: string | null
  texto_autorizacao: string | null
}

export type Avaliacao = {
  id: string
  order_id: string | null
  display_id: number | null
  origem: "pedido" | "manual"
  contato: string | null
  contato_chave: string | null
  nome: string | null
  pecas: string | null
  conversation_id: string | null
  etapa: EtapaAvaliacao
  motivo_fim: string | null
  elegivel_em: string
  pedido_texto: string | null
  pedido_em: string | null
  resposta_texto: string | null
  resposta_em: string | null
  tem_foto: boolean
  autorizacao_apos: string | null
  autorizacao_texto: string | null
  autorizacao_em: string | null
  autorizou_texto: string | null
  autorizou_em: string | null
  criado_em: string
}

export async function getConfigAvaliacao(): Promise<AvaliacaoConfig | null> {
  // Tabela ausente (migration 0015 ainda não aplicada) = automação inexistente, sem erro no log a cada 5 min.
  try {
    const rows = await sb<AvaliacaoConfig[]>("avaliacao_config?id=eq.1&select=*")
    return rows?.[0] ?? null
  } catch {
    return null
  }
}

export async function listarAvaliacoes(filtro: string): Promise<Avaliacao[]> {
  return (await sb<Avaliacao[]>(`avaliacao?${filtro}`)) ?? []
}

/** Pedidos que já têm linha (qualquer etapa): o detector não cria de novo. */
export async function pedidosJaRegistrados(orderIds: string[]): Promise<Set<string>> {
  if (!orderIds.length) return new Set()
  const rows = await sb<Array<{ order_id: string }>>(`avaliacao?order_id=in.(${orderIds.map((i) => `"${i.replace(/"/g, "")}"`).join(",")})&select=order_id`)
  return new Set((rows ?? []).map((r) => r.order_id))
}

/** Pedido de avaliação para a mesma pessoa desde `desdeIso` (uma por pessoa a cada 60 dias). */
export async function recentePorContato(contatoChave: string, desdeIso: string): Promise<Avaliacao | null> {
  const rows = await listarAvaliacoes(`contato_chave=eq.${q(contatoChave)}&criado_em=gte.${q(desdeIso)}&order=criado_em.desc&limit=1`)
  return rows[0] ?? null
}

/** Linha em andamento para quem mandou mensagem (webhook). */
export async function ativaAvaliacaoPorContato(contatoChave: string): Promise<Avaliacao | null> {
  const rows = await listarAvaliacoes(
    `contato_chave=eq.${q(contatoChave)}&etapa=in.(pedida,respondeu,autorizacao_pedida)&order=pedido_em.desc&limit=1`
  )
  return rows[0] ?? null
}

export async function inserirAvaliacao(fields: Record<string, unknown>): Promise<void> {
  // on_conflict pelo pedido: o mesmo pedido nunca entra duas vezes.
  await sb("avaliacao?on_conflict=order_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify(fields),
  })
}

export async function atualizarAvaliacao(id: string, fields: Record<string, unknown>): Promise<void> {
  await sb(`avaliacao?id=eq.${q(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ ...fields, atualizado_em: new Date().toISOString() }),
  })
}

/** Reserva antes de enviar: só passa se a linha ainda estiver na etapa esperada (sem envio duplo). */
export async function reservarAvaliacao(id: string, etapaAtual: EtapaAvaliacao, fields: Record<string, unknown>): Promise<boolean> {
  const rows = await sb<Array<{ id: string }>>(`avaliacao?id=eq.${q(id)}&etapa=eq.${etapaAtual}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...fields, atualizado_em: new Date().toISOString() }),
  })
  return (rows ?? []).length > 0
}

/** Pedidos de avaliação enviados desde `desdeIso` — entra no teto diário COMPARTILHADO com a recuperação. */
export async function contarPedidosDeAvaliacaoDesde(desdeIso: string): Promise<number> {
  try {
    const rows = await sb<Array<{ id: string }>>(`avaliacao?pedido_em=gte.${q(desdeIso)}&select=id`)
    return (rows ?? []).length
  } catch {
    return 0 // tabela ainda não existe (migration 0015 não aplicada)
  }
}
