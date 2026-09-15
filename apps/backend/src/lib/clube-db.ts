// Acesso às tabelas do Clube Éclat no Supabase (service_role, REST/PostgREST).
// Só o backend (jobs e rotas admin) e o Cockpit escrevem aqui. Ver architecture/clube.md.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function clubeDbConfigured(): boolean {
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
  if (!res.ok) throw new Error(`Supabase ${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export type ClubeConfig = {
  id: number
  ativo: boolean
  grupo_jid: string
  aviso_jid: string | null
  janela_inicio: string // "09:00:00"
  janela_fim: string
  max_por_dia: number
  atraso_max_min: number
  falhas_seguidas: number
}

export type ClubeRegra = {
  tipo: "ultima_unidade" | "reposicao" | "novidade" | "esgotado" | "marco_reservas"
  ativa: boolean
  modo: "automatico" | "aprovar"
  template: string
  limiar: number | null
  cooldown_horas: number
  agrupar: boolean
  anexar_foto: boolean
}

export type ClubeMensagem = {
  id: string
  origem: "agenda" | "gatilho" | "manual"
  tipo: string | null
  status: "rascunho" | "aprovada" | "enviada" | "falhou" | "descartada"
  enviar_em: string | null
  titulo: string | null
  texto: string
  texto_final: string | null
  midia: string | null
  midia_url_final: string | null
  dados: Record<string, unknown> | null
  chave_dedup: string | null
  evolution_msg_id: string | null
  erro: string | null
  criado_em: string
  aprovado_em: string | null
  enviado_em: string | null
}

export type SnapshotRow = {
  variant_id: string
  product_id: string | null
  product_handle: string | null
  product_title: string | null
  cor: string | null
  tamanho: string | null
  qty: number
  publicado: boolean
  visto_em?: string
}

export async function getConfig(): Promise<ClubeConfig | null> {
  const rows = await sb<ClubeConfig[]>("clube_config?id=eq.1&select=*")
  return rows?.[0] ?? null
}

export async function updateConfig(fields: Partial<ClubeConfig>): Promise<void> {
  await sb("clube_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(fields),
  })
}

export async function listRegras(): Promise<ClubeRegra[]> {
  return sb<ClubeRegra[]>("clube_regras?select=*&order=tipo")
}

export async function listMensagens(filtro: string): Promise<ClubeMensagem[]> {
  return sb<ClubeMensagem[]>(`clube_mensagens?select=*&${filtro}`)
}

export async function insertMensagem(m: Partial<ClubeMensagem>): Promise<ClubeMensagem> {
  const rows = await sb<ClubeMensagem[]>("clube_mensagens", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(m),
  })
  return rows[0]
}

export async function updateMensagem(id: string, fields: Partial<ClubeMensagem>): Promise<void> {
  await sb(`clube_mensagens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(fields),
  })
}

// Última mensagem (qualquer status exceto descartada) com essa chave nas últimas N horas → cooldown ativo.
export async function existeRecente(chave: string, horas: number): Promise<boolean> {
  const desde = new Date(Date.now() - horas * 3600_000).toISOString()
  const rows = await sb<{ id: string }[]>(
    `clube_mensagens?select=id&chave_dedup=eq.${encodeURIComponent(chave)}&status=neq.descartada&criado_em=gte.${encodeURIComponent(desde)}&limit=1`
  )
  return rows.length > 0
}

export async function contarEnviadasHoje(origem?: string): Promise<number> {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const q = `clube_mensagens?select=id&status=eq.enviada&enviado_em=gte.${encodeURIComponent(hoje.toISOString())}${origem ? `&origem=eq.${origem}` : ""}`
  const rows = await sb<{ id: string }[]>(q)
  return rows.length
}

export async function getSnapshot(): Promise<SnapshotRow[]> {
  return sb<SnapshotRow[]>("clube_estoque_snapshot?select=*")
}

export async function upsertSnapshot(rows: SnapshotRow[]): Promise<void> {
  if (!rows.length) return
  await sb("clube_estoque_snapshot?on_conflict=variant_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows.map((r) => ({ ...r, visto_em: new Date().toISOString() }))),
  })
}

export async function logEvento(tipo: string, chave: string | null, dados: unknown, resultado: string): Promise<void> {
  try {
    await sb("clube_eventos_log", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tipo, chave, dados, resultado }),
    })
  } catch {
    /* log nunca derruba o job */
  }
}
