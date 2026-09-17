// HTTP da Brasil NFe. Autenticação por dois headers (painel → Credenciais de API):
//   UserToken  → token pessoal do usuário
//   Token      → token da empresa, usado para transmitir documentos
// Os valores vivem só no .env. Nunca são logados nem incluídos em mensagem de erro.

import { ErroFiscal } from "./tipos"

const BASE = process.env.BRASILNFE_BASE_URL || "https://api.brasilnfe.com.br"
const USER_TOKEN = process.env.BRASILNFE_USER_TOKEN
const COMPANY_TOKEN = process.env.BRASILNFE_COMPANY_TOKEN

export function brasilNfeConfigured(): boolean {
  return Boolean(USER_TOKEN && COMPANY_TOKEN)
}

export type RespostaTransmissao = {
  autorizado: boolean
  chave_acesso: string | null
  numero: number | null
  serie: number | null
  status_sefaz: string | null
  motivo: string | null
  xml_url: string | null
  danfe_url: string | null
  bruto: Record<string, unknown>
}

async function chamar<T = unknown>(
  caminho: string,
  init: RequestInit = {}
): Promise<T> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal(
      "Credenciais da Brasil NFe ausentes. Defina BRASILNFE_USER_TOKEN e BRASILNFE_COMPANY_TOKEN no .env."
    )
  }
  const res = await fetch(`${BASE}${caminho}`, {
    ...init,
    headers: {
      UserToken: USER_TOKEN as string,
      Token: COMPANY_TOKEN as string,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  })
  const texto = await res.text()
  if (!res.ok) {
    // Redaciona tokens caso vazem no corpo da resposta do servidor.
    // Usa split/join para substituição literal, evitando regex e metacaracteres.
    let textoRedacionado = texto
    if (USER_TOKEN) textoRedacionado = textoRedacionado.split(USER_TOKEN).join("***")
    if (COMPANY_TOKEN) textoRedacionado = textoRedacionado.split(COMPANY_TOKEN).join("***")
    const mensagem = `Brasil NFe ${init.method || "GET"} ${caminho}: ${res.status} ${textoRedacionado}`
    // 4xx é recusa do fornecedor a uma requisição NOSSA (malformada) ou rejeição de negócio —
    // ErroFiscal, que as rotas mapeiam para 422. 5xx/502/503 é QUEDA do fornecedor, infra, não
    // erro do operador — Error comum, que vira 500 e pode disparar alerta (achado I2/5.1: antes
    // disto, uma queda da Brasil NFe aparecia como erro do operador e nenhum alerta de 5xx disparava).
    if (res.status >= 400 && res.status < 500) {
      throw new ErroFiscal(mensagem)
    }
    throw new Error(mensagem)
  }
  return (texto ? JSON.parse(texto) : {}) as T
}

function normalizar(bruto: Record<string, any>): RespostaTransmissao {
  const status = String(bruto.status ?? "").toLowerCase()
  const chave = bruto.chave ?? bruto.chave_acesso ?? null
  // Aceita "autorizado" ou "autorizada" (gênero pode variar conforme API).
  const autorizado = status.startsWith("autorizad")
  return {
    autorizado,
    chave_acesso: chave ? String(chave) : null,
    numero: bruto.numero != null ? Number(bruto.numero) : null,
    serie: bruto.serie != null ? Number(bruto.serie) : null,
    status_sefaz: bruto.codigo_status != null ? String(bruto.codigo_status) : null,
    motivo: bruto.motivo ?? bruto.mensagem ?? null,
    xml_url: bruto.xml_url ?? null,
    danfe_url: bruto.danfe_url ?? null,
    bruto,
  }
}

// Gera XML/PDF sem transmitir à SEFAZ e sem consumir numeração (seção Consultas da doc).
export async function previsualizar(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
  return chamar<Record<string, unknown>>("/v1/nfe/previa", {
    method: "POST",
    body: JSON.stringify(payload),
  })
}

export async function transmitir(payload: Record<string, unknown>): Promise<RespostaTransmissao> {
  const bruto = await chamar<Record<string, any>>("/v1/nfe", {
    method: "POST",
    body: JSON.stringify(payload),
  })
  return normalizar(bruto)
}

export async function consultarPorChave(chave: string): Promise<RespostaTransmissao> {
  const bruto = await chamar<Record<string, any>>(`/v1/nfe/${encodeURIComponent(chave)}`)
  return normalizar(bruto)
}

// Baixa o XML autorizado. É deste XML que sai o nItem real (spec §7.3).
export async function baixarXml(chave: string): Promise<string> {
  if (!brasilNfeConfigured()) {
    throw new ErroFiscal("Credenciais da Brasil NFe ausentes.")
  }
  const res = await fetch(`${BASE}/v1/nfe/${encodeURIComponent(chave)}/xml`, {
    headers: { UserToken: USER_TOKEN as string, Token: COMPANY_TOKEN as string },
  })
  if (!res.ok) {
    throw new ErroFiscal(`Brasil NFe GET /v1/nfe/${chave}/xml: ${res.status}`)
  }
  return res.text()
}
