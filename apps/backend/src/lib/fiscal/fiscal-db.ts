// Acesso às tabelas fiscais no Supabase (service_role, REST/PostgREST).
// Mesmo padrão de src/lib/clube-db.ts. Só o backend escreve aqui.

import type {
  Ambiente,
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
    // Redaciona o corpo para remover a chave de serviço caso ela vaze do servidor.
    // Usa split/join para substituição literal, evitando regex e metacaracteres.
    const corpo = await res.text()
    const corpoCensurado = SERVICE_KEY ? corpo.split(SERVICE_KEY).join("***") : corpo
    throw new Error(`Supabase ${init.method || "GET"} ${path}: ${res.status} ${corpoCensurado}`)
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
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${encodeURIComponent(id)}`, {
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
    `fiscal_documento_item?fiscal_documento_id=eq.${encodeURIComponent(documentoId)}&select=*&order=ordem_enviada.asc`
  )
}

export async function atualizarNItem(itemId: string, nItem: number): Promise<void> {
  await sb(`fiscal_documento_item?id=eq.${encodeURIComponent(itemId)}`, {
    method: "PATCH",
    body: JSON.stringify({ n_item_verificado: nItem }),
  })
}

// Escopado por ambiente (achado I6/5.2 da revisão final): a idempotência toda é por ambiente, e
// sem esse filtro o card fiscal e a NFD podiam pegar o documento de HOMOLOGAÇÃO do mesmo pedido
// depois da virada para produção — chave de homologação referenciada numa nota de produção é
// rejeição certa na SEFAZ.
export async function documentoDeVendaDoPedido(
  orderId: string,
  ambiente: Ambiente
): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?medusa_order_id=eq.${encodeURIComponent(orderId)}&tipo=eq.venda&ambiente=eq.${encodeURIComponent(ambiente)}&select=*&order=created_at.desc&limit=1`
  )
  return rows?.[0] ?? null
}

// Todos os documentos fiscais de um pedido, tipo e ambiente, do mais novo pro mais velho (Bloco 2
// / achado crítico C3): permite decidir se um documento REJEITADO (ou MONTADO órfão) pode ser
// reemitido em vez de bater para sempre no índice único da chave de idempotência da tentativa
// anterior — ver emitirVenda em fiscal-emissao.ts.
export async function documentosDoPedido(
  orderId: string,
  tipo: "venda" | "devolucao",
  ambiente: Ambiente
): Promise<FiscalDocumento[]> {
  return sb<FiscalDocumento[]>(
    `fiscal_documento?medusa_order_id=eq.${encodeURIComponent(orderId)}&tipo=eq.${encodeURIComponent(tipo)}&ambiente=eq.${encodeURIComponent(ambiente)}&select=*&order=created_at.desc`
  )
}

// Todas as NFDs já emitidas contra uma nota de venda (medusa_line_item da venda ==
// documento_origem_id da devolução). Usado para somar quanto de cada item já foi devolvido antes
// de aceitar uma nova devolução (achado crítico da revisão de 2026-09-17 — ver
// emitir-devolucao/route.ts).
export async function listarDevolucoesDoDocumento(
  documentoOrigemId: string
): Promise<FiscalDocumento[]> {
  return sb<FiscalDocumento[]>(
    `fiscal_documento?documento_origem_id=eq.${encodeURIComponent(documentoOrigemId)}&tipo=eq.devolucao&select=*`
  )
}

export async function lerDocumento(id: string): Promise<FiscalDocumento> {
  const rows = await sb<FiscalDocumento[]>(`fiscal_documento?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
  if (!rows?.[0]) throw new Error(`Documento fiscal ${id} não encontrado.`)
  return rows[0]
}

// fiscal_documento.id é uuid no Postgres. Um id malformado (achado da revisão de 2026-09-17) faz
// o PostgREST recusar com "invalid input syntax for type uuid" — sb() transforma isso num Error
// genérico, que sem esta checagem vazava como 500 em qualquer rota que aceite um documento_id do
// cliente. Requisição malformada é 400, não 500 e não 422 (422 é reservado para "uuid válido que
// não existe" — erro de negócio de verdade). Rotas que recebem documento_id do corpo/query devem
// chamar isto ANTES de repassar o valor a lerDocumento/reconciliarDocumento.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function ehUuidValido(valor: string): boolean {
  return UUID_RE.test(valor)
}

export async function listarPorStatus(
  status: StatusDocumento[],
  limite = 50
): Promise<FiscalDocumento[]> {
  // Valores válidos de StatusDocumento.
  const validos: StatusDocumento[] = [
    "montado",
    "transmitido_sem_confirmacao",
    "autorizado_nao_verificado",
    "verificado",
    "rejeitado",
    "denegado",
    "em_contingencia",
  ]
  // Filtra e valida cada status antes de montar a query.
  const statusValidos = status.filter((s) => validos.includes(s))
  if (statusValidos.length === 0) {
    throw new Error("Nenhum status válido fornecido.")
  }
  const lista = statusValidos.map((s) => `"${s}"`).join(",")
  return sb<FiscalDocumento[]>(
    `fiscal_documento?status=in.(${lista})&select=*&order=created_at.asc&limit=${limite}`
  )
}

export async function documentoPorChave(chave: string): Promise<FiscalDocumento | null> {
  const rows = await sb<FiscalDocumento[]>(
    `fiscal_documento?chave_acesso=eq.${encodeURIComponent(chave)}&select=*&limit=1`
  )
  return rows?.[0] ?? null
}

export async function upsertPerfil(perfil: Record<string, unknown>): Promise<FiscalPerfil> {
  const rows = await sb<FiscalPerfil[]>("fiscal_perfil", {
    method: "POST",
    headers: { Prefer: "return=representation,resolution=merge-duplicates" },
    body: JSON.stringify({ ...perfil, updated_at: new Date().toISOString() }),
  })
  return rows[0]
}
