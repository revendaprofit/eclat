// Helper de acesso ao Supabase (camada de relacionamento) usando a service_role.
// Sem dependências extras: fala direto com a REST API (PostgREST) via fetch.
// Invariante 2: o backend é o orquestrador que escreve relacionamento no Supabase.

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function rest(path: string) {
  return `${SUPABASE_URL}/rest/v1/${path}`
}

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: SERVICE_KEY as string,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  }
}

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SERVICE_KEY)
}

export async function findLeadIdByWhatsapp(
  whatsapp: string
): Promise<string | null> {
  const res = await fetch(
    rest(`lead?whatsapp=eq.${encodeURIComponent(whatsapp)}&select=id&limit=1`),
    { headers: headers() }
  )
  if (!res.ok) throw new Error(`findLead falhou: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as Array<{ id: string }>
  return data?.[0]?.id ?? null
}

export async function createLead(fields: Record<string, unknown>): Promise<{ id: string }> {
  const res = await fetch(rest("lead"), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(`createLead falhou: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as Array<{ id: string }>
  return data[0]
}

// Acha o lead pelo WhatsApp ou cria um novo (captação automática).
export async function getOrCreateLeadByWhatsapp(
  whatsapp: string,
  defaults: Record<string, unknown>
): Promise<string> {
  const existing = await findLeadIdByWhatsapp(whatsapp)
  if (existing) return existing
  const lead = await createLead({ whatsapp, ...defaults })
  return lead.id
}

export async function insertConversa(fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(rest("conversa"), {
    method: "POST",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(`insertConversa falhou: ${res.status} ${await res.text()}`)
}

// ---------- LEITURA (para o Cockpit — somente leitura) ----------

// Contagem exata de uma tabela (usa Content-Range do PostgREST).
export async function sbCount(table: string): Promise<number> {
  const res = await fetch(rest(`${table}?select=id`), {
    method: "HEAD",
    headers: headers({ Prefer: "count=exact", Range: "0-0" }),
  })
  const cr = res.headers.get("content-range") || ""
  const total = cr.split("/")[1]
  return total && total !== "*" ? parseInt(total, 10) : 0
}

export async function sbSelect<T = Record<string, unknown>>(
  table: string,
  qs = ""
): Promise<T[]> {
  const res = await fetch(rest(`${table}${qs ? "?" + qs : ""}`), { headers: headers() })
  if (!res.ok) throw new Error(`sbSelect ${table} falhou: ${res.status} ${await res.text()}`)
  return (await res.json()) as T[]
}

// ---------- CHAT (conversation + message) ----------

// Acha a conversa pelo contato+instância ou cria. Retorna o id.
export async function getOrCreateConversation(
  contatoE164: string,
  instancia: string,
  defaults: Record<string, unknown>
): Promise<string> {
  const found = await sbSelect<{ id: string }>(
    "conversation",
    `contato_e164=eq.${encodeURIComponent(contatoE164)}&instancia_evolution=eq.${encodeURIComponent(
      instancia
    )}&select=id&limit=1`
  )
  if (found[0]?.id) return found[0].id

  const res = await fetch(rest("conversation"), {
    method: "POST",
    headers: headers({ Prefer: "return=representation" }),
    body: JSON.stringify({
      contato_e164: contatoE164,
      instancia_evolution: instancia,
      ...defaults,
    }),
  })
  if (res.status === 409) {
    // corrida: já existe — busca de novo
    const again = await sbSelect<{ id: string }>(
      "conversation",
      `contato_e164=eq.${encodeURIComponent(contatoE164)}&instancia_evolution=eq.${encodeURIComponent(
        instancia
      )}&select=id&limit=1`
    )
    if (again[0]?.id) return again[0].id
  }
  if (!res.ok) throw new Error(`getOrCreateConversation falhou: ${res.status} ${await res.text()}`)
  const data = (await res.json()) as Array<{ id: string }>
  return data[0].id
}

// Insere mensagem de forma idempotente (ignora duplicata por evolution_msg_id).
export async function insertMessageIdempotent(fields: Record<string, unknown>): Promise<void> {
  const res = await fetch(rest("message?on_conflict=evolution_msg_id"), {
    method: "POST",
    headers: headers({ Prefer: "resolution=ignore-duplicates,return=minimal" }),
    body: JSON.stringify(fields),
  })
  if (!res.ok) throw new Error(`insertMessage falhou: ${res.status} ${await res.text()}`)
}

// Faz upload de bytes para o Supabase Storage (bucket privado). Retorna o path salvo.
export async function uploadToStorage(
  bucket: string,
  path: string,
  bytes: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  const res = await fetch(
    `${SUPABASE_URL}/storage/v1/object/${bucket}/${path}`,
    {
      method: "POST",
      headers: {
        apikey: SERVICE_KEY as string,
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": contentType,
        "x-upsert": "true",
      },
      body: bytes as unknown as BodyInit,
    }
  )
  if (!res.ok) throw new Error(`upload storage falhou: ${res.status} ${await res.text()}`)
  return path
}

// Atualiza a mídia de uma mensagem (após upload no Storage).
export async function setMessageMedia(
  evolutionMsgId: string,
  mediaPath: string,
  mediaMime: string | null
): Promise<void> {
  await fetch(rest(`message?evolution_msg_id=eq.${encodeURIComponent(evolutionMsgId)}`), {
    method: "PATCH",
    headers: headers({ Prefer: "return=minimal" }),
    body: JSON.stringify({ media_url: mediaPath, media_mime: mediaMime }),
  })
}
