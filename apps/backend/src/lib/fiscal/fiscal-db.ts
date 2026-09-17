// Acesso às tabelas fiscais no Supabase (service_role, REST/PostgREST).
// Mesmo padrão de src/lib/clube-db.ts. Só o backend escreve aqui.

import type {
  FiscalConfig,
  FiscalDocumento,
  FiscalDocumentoItem,
  FiscalPerfil,
  StatusDocumento,
} from "./tipos"

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export function fiscalDbConfigured(): boolean {
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
  if (!res.ok) {
    // Só status e caminho — nunca o header de autenticação.
    throw new Error(`Supabase ${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`)
  }
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export async function getConfig(): Promise<FiscalConfig> {
  const rows = await sb<FiscalConfig[]>("fiscal_config?id=eq.1&select=*&limit=1")
  if (!rows?.[0]) throw new Error("fiscal_config não encontrada — rode a migration 0011_fiscal.sql.")
  return rows[0]
}

export async function upsertConfig(patch: Partial<FiscalConfig>): Promise<FiscalConfig> {
  const rows = await sb<FiscalConfig[]>("fiscal_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}

export async function listPerfis(): Promise<FiscalPerfil[]> {
  return sb<FiscalPerfil[]>("fiscal_perfil?select=*&order=escopo.asc")
}

export async function acharPorIdempotencia(key: string): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?idempotency_key=eq.${encodeURIComponent(key)}&select=*&limit=1`
  )
  return rows?.[0] ?? null
}

export async function criarDocumento(
  doc: Omit<FiscalDocumento, "id" | "verificado_em"> & { verificado_em?: string | null }
): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>("fiscal_documento", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(doc),
  })
  return rows[0]
}

export async function atualizarDocumento(
  id: string,
  patch: Partial<FiscalDocumento>
): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...patch, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}

export async function criarItens(
  itens: Array<Omit<FiscalDocumentoItem, "id">>
): Promise<FiscalDocumentoItem[]> {
  return sb<FiscalDocumentoItem[]>("fiscal_documento_item", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(itens),
  })
}

export async function listarItens(documentoId: string): Promise<FiscalDocumentoItem[]> {
  return sb<FiscalDocumentoItem[]>(
    `fiscal_documento_item?fiscal_documento_id=eq.${documentoId}&select=*&order=ordem_enviada.asc`
  )
}

export async function atualizarNItem(itemId: string, nItem: number): Promise<void> {
  await sb(`fiscal_documento_item?id=eq.${itemId}`, {
    method: "PATCH",
    body: JSON.stringify({ n_item_verificado: nItem }),
  })
}

export async function documentoDeVendaDoPedido(
  orderId: string
): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?medusa_order_id=eq.${orderId}&tipo=eq.venda&select=*&order=created_at.desc&limit=1`
  )
  return rows?.[0] ?? null
}

export async function lerDocumento(id: string): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${id}&select=*&limit=1`)
  if (!rows?.[0]) throw new Error(`Documento fiscal ${id} não encontrado.`)
  return rows[0]
}

export async function listarPorStatus(
  status: StatusDocumento[],
  limite = 50
): Promise<FiscalDocumento[]> {
  const lista = status.map((s) => `"${s}"`).join(",")
  return sb<FiscalDocumento[]>(
    `fiscal_documento?status=in.(${lista})&select=*&order=created_at.asc&limit=${limite}`
  )
}
