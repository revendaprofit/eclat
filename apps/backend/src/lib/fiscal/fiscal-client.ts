// HTTP da Brasil NFe — contrato real (spec §7.0). Fonte: documentação pública + tipos do SDK
// oficial brasilnfe@3.1.3. O SDK NÃO é dependência: precisamos de controle sobre timeout,
// redação de segredo e classificação de erro.
//
// Autenticação por dois headers:  UserToken (usuário) · Token (empresa).
// Os valores vivem só no .env. Nunca são logados nem incluídos em mensagem de erro.

import { ErroFiscal } from "./tipos"

const BASE = process.env.BRASILNFE_BASE_URL || "https://api.brasilnfe.com.br"
const USER_TOKEN = process.env.BRASILNFE_USER_TOKEN
const COMPANY_TOKEN = process.env.BRASILNFE_COMPANY_TOKEN

// O SDK oficial usa 5 minutos: a rota é síncrona e espera a SEFAZ.
const TIMEOUT_TRANSMISSAO_MS = 300000
const TIMEOUT_CONSULTA_MS = 60000

const AUTORIZADO = new Set([100, 150])
const DENEGADO = new Set([110, 301, 302, 303])

export function brasilNfeConfigured(): boolean {
  return Boolean(USER_TOKEN && COMPANY_TOKEN)
}

export type Desfecho = "autorizado" | "rejeitado" | "denegado" | "indefinido"

export type ResultadoTransmissao = {
  desfecho: Desfecho
  chave_acesso: string | null
  numero: number | null
  serie: number | null
  codigo_sefaz: string | null
  motivo: string | null
  xml: string | null
  ambiente_divergente: boolean
  bruto: Record<string, unknown>
}

export type NotaLocalizada = {
  chave_acesso: string
  status: 1 | 2 | 3
  numero: number | null
  serie: number | null
}

function redacionar(texto: string): string {
  // split/join: substituição literal, sem regex (um segredo com metacaractere quebraria a regex).
  let t = texto
  if (USER_TOKEN) t = t.split(USER_TOKEN).join("***")
  if (COMPANY_TOKEN) t = t.split(COMPANY_TOKEN).join("***")
  return t
}

function numeroOuNull(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

// Interpreta a resposta de EnviarNotaFiscal (spec §7.2 item 9). PURA.
// Regra de ouro: nenhuma combinação é adivinhada. O que não fecha vira "indefinido", e quem
// chama mantém o documento em transmitido_sem_confirmacao.
export function interpretarResposta(
  bruto: Record<string, any>,
  ambienteEsperado: 1 | 2
): ResultadoTransmissao {
  const { Base64Xml, Base64File, ...resto } = bruto ?? {}
  const ret = bruto?.ReturnNF as Record<string, any> | undefined

  const base: ResultadoTransmissao = {
    desfecho: "indefinido",
    chave_acesso: null,
    numero: numeroOuNull(ret?.Numero),
    serie: numeroOuNull(ret?.Serie),
    codigo_sefaz: ret?.CodStatusRespostaSefaz != null ? String(ret.CodStatusRespostaSefaz) : null,
    motivo: ret?.DsStatusRespostaSefaz ?? bruto?.Error ?? null,
    xml: null,
    ambiente_divergente:
      ret?.CodTipoAmbiente != null && Number(ret.CodTipoAmbiente) !== ambienteEsperado,
    bruto: resto,
  }

  if (!ret) {
    // Sem ReturnNF: só é conclusivo se o fornecedor disse por quê (validação, não chegou à SEFAZ).
    return typeof bruto?.Error === "string" && bruto.Error.trim()
      ? { ...base, desfecho: "rejeitado" }
      : base
  }

  const cod = Number(ret.CodStatusRespostaSefaz)
  const ok = ret.Ok === true

  if (ok && AUTORIZADO.has(cod)) {
    const chave = String(ret.ChaveNF ?? "")
    if (!/^\d{44}$/.test(chave)) return base
    return {
      ...base,
      desfecho: "autorizado",
      chave_acesso: chave,
      motivo: null,
      xml: typeof Base64Xml === "string" && Base64Xml ? Buffer.from(Base64Xml, "base64").toString("utf8") : null,
    }
  }
  if (!ok && DENEGADO.has(cod)) return { ...base, desfecho: "denegado" }
  // Ok e código precisam concordar: Ok true com código de rejeição, ou Ok false com 100/150,
  // são incoerentes — não se adivinha qual dos dois está certo.
  if (!ok && Number.isFinite(cod) && !AUTORIZADO.has(cod)) return { ...base, desfecho: "rejeitado" }
  return base
}

async function post(
  metodo: string,
  corpo: unknown,
  timeoutMs: number
): Promise<{ status: number; texto: string }> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal(
      "Credenciais da Brasil NFe ausentes. Defina BRASILNFE_USER_TOKEN e BRASILNFE_COMPANY_TOKEN no .env."
    )
  }
  const res = await fetch(`${BASE}/services/fiscal/${metodo}`, {
    method: "POST",
    headers: {
      UserToken: USER_TOKEN as string,
      Token: COMPANY_TOKEN as string,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { status: res.status, texto: await res.text() }
}

function parseJson(texto: string): unknown {
  try {
    return texto ? JSON.parse(texto) : {}
  } catch {
    return undefined
  }
}

// Para chamadas que NÃO transmitem nota: 4xx é recusa (ErroFiscal), 5xx é infra (Error).
async function consultar<T>(metodo: string, corpo: unknown): Promise<T> {
  const { status, texto } = await post(metodo, corpo, TIMEOUT_CONSULTA_MS)
  if (status >= 200 && status < 300) {
    const dados = parseJson(texto)
    if (dados === undefined) throw new Error(`Brasil NFe ${metodo}: resposta não é JSON.`)
    return dados as T
  }
  const mensagem = `Brasil NFe ${metodo}: ${status} ${redacionar(texto)}`
  if (status >= 400 && status < 500 && status !== 408) throw new ErroFiscal(mensagem)
  throw new Error(mensagem)
}

export async function transmitir(payload: Record<string, unknown>): Promise<ResultadoTransmissao> {
  const esperado: 1 | 2 = payload.TipoAmbiente === 1 ? 1 : 2
  const { status, texto } = await post("EnviarNotaFiscal", payload, TIMEOUT_TRANSMISSAO_MS)

  if (status >= 200 && status < 300) {
    const dados = parseJson(texto)
    return interpretarResposta((dados ?? {}) as Record<string, any>, esperado)
  }

  // 4xx (menos 408): o fornecedor recusou ANTES de transmitir — desfecho conclusivo.
  if (status >= 400 && status < 500 && status !== 408) {
    const dados = parseJson(texto)
    if (dados && typeof dados === "object" && ("ReturnNF" in dados || "Error" in dados)) {
      return interpretarResposta(dados as Record<string, any>, esperado)
    }
    return {
      desfecho: "rejeitado", chave_acesso: null, numero: null, serie: null,
      codigo_sefaz: `HTTP_${status}`, motivo: redacionar(texto).slice(0, 500),
      xml: null, ambiente_divergente: false, bruto: { http_status: status },
    }
  }

  // 5xx / 408: não sabemos se a nota saiu. Error comum — quem chama mantém o documento pendente.
  throw new Error(`Brasil NFe EnviarNotaFiscal: ${status} ${redacionar(texto)}`)
}

// Gera o XML sem transmitir à SEFAZ e sem consumir numeração. O endpoint espera a nota dentro
// de um envelope de lote (NotaFiscalLoteEnvio), mesmo sendo uma só.
export async function previsualizar(payload: Record<string, unknown>): Promise<{ xml: string }> {
  const r = await consultar<{ Status?: boolean; Base64File?: string; Error?: string }>(
    "PreVisualizarNotaFiscal",
    {
      notaFiscal: {
        TipoAmbiente: payload.TipoAmbiente,
        ModeloDocumento: payload.ModeloDocumento,
        nFInfos: [payload],
      },
      TipoArquivo: 0,
      TipoEnvio: 1,
    }
  )
  if (!r.Status || !r.Base64File) {
    throw new ErroFiscal(`A Brasil NFe recusou a pré-visualização: ${r.Error || "sem motivo informado"}`)
  }
  return { xml: Buffer.from(r.Base64File, "base64").toString("utf8") }
}

// Localiza uma nota pelo IdentificadorInterno (a nossa idempotency_key) — é assim que uma
// transmissão sem resposta se resolve sem reemitir (spec §7.3).
export async function localizarPorIdentificador(args: {
  identificador: string
  ambiente: 1 | 2
  desde: string
}): Promise<NotaLocalizada | null> {
  const inicio = new Date(new Date(args.desde).getTime() - 24 * 60 * 60 * 1000)
  const fim = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const r = await consultar<{ Notas?: Array<Record<string, any>> }>("ObterNotasFiscais", {
    TipoAmbiente: args.ambiente,
    TipoDocumentoFiscal: 1,
    DtInicio: inicio.toISOString(),
    DtFim: fim.toISOString(),
    IdentificadorInterno: args.identificador,
  })
  // Casamento EXATO: "pedido:venda:hom" não pode casar com "pedido:venda:hom:r1".
  const nota = (r.Notas ?? []).find(
    (n) => n.IdentificadorInterno === args.identificador && /^\d{44}$/.test(String(n.Chave ?? ""))
  )
  if (!nota) return null
  const status = Number(nota.Status)
  if (status !== 1 && status !== 2 && status !== 3) return null
  return {
    chave_acesso: String(nota.Chave),
    status,
    numero: numeroOuNull(nota.Numero),
    serie: numeroOuNull(nota.Serie),
  }
}

// O corpo da resposta é uma STRING JSON com o arquivo em base64 (é assim que o SDK oficial lê).
export async function baixarArquivo(chave: string, tipo: "xml" | "danfe"): Promise<Buffer> {
  const b64 = await consultar<unknown>("ObterArquivoNotaFiscal", {
    ChaveNF: chave,
    FileType: tipo === "xml" ? 1 : 2,
    TipoDocumentoFiscal: 1,
  })
  if (typeof b64 !== "string" || !b64) {
    throw new ErroFiscal(
      `A Brasil NFe não devolveu o arquivo da nota ${chave}. Confira se a chave pertence à empresa do token.`
    )
  }
  return Buffer.from(b64, "base64")
}
