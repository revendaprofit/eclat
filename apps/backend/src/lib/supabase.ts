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
