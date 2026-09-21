// Cliente HTTP da SuperFrete — cotação e consulta de etiqueta (a etiqueta nasce no Cockpit, spec §4.7).
// Doc: https://superfrete.readme.io/reference/cotacao-de-frete
import { paraCentavos } from "./dinheiro"
import type { Pacote } from "./embalagem"
import { ID_SUPERFRETE, SERVICOS, type Servico } from "./preco"

/** O que usamos da consulta de uma etiqueta (`GET /api/v0/order/info/{id}`). */
export type InfoEtiqueta = { status: string; tracking: string | null; tags: string[] }
export type Cotacao = { servico: Servico; centavos: number; prazoMin: number; prazoMax: number }
export type OpcoesCliente = {
  token: string
  contato: string
  cepOrigem: string
  sandbox?: boolean
  /** Só para teste de integração (SuperFrete simulada). */
  baseUrl?: string
  timeoutMs?: number
}

export class ErroSuperfrete extends Error {
  constructor(mensagem: string) {
    super(mensagem)
    this.name = "ErroSuperfrete"
  }
}

type ItemDaResposta = {
  id?: number
  price?: number | string | null
  delivery_time?: number | null
  delivery_range?: { min?: number | null; max?: number | null } | null
  has_error?: boolean
}

const soDigitos = (s: string) => s.replace(/\D/g, "")

export class ClienteSuperfrete {
  private readonly base: string

  constructor(private readonly o: OpcoesCliente) {
    this.base = o.baseUrl ?? (o.sandbox ? "https://sandbox.superfrete.com" : "https://api.superfrete.com")
  }

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.o.token}`,
      "User-Agent": `use.ECLAT (${this.o.contato})`,
      "Content-Type": "application/json",
      Accept: "application/json",
    }
  }

  // Estado de uma etiqueta já comprada (spec §9.2: o aviso de despacho espera o código de rastreio,
  // que nasce segundos DEPOIS do pagamento). Não gasta saldo. Devolve só o que usamos.
  //
  // O corpo da resposta de erro NÃO entra na mensagem: a SuperFrete devolve dados do destinatário
  // (nome, endereço) nesta rota, e a mensagem do erro pode acabar num log.
  async consultarEtiqueta(id: string): Promise<InfoEtiqueta> {
    const controle = new AbortController()
    // O relógio cobre a chamada E a leitura do corpo: um corpo que para de chegar no meio também é
    // cortado. Só é desligado depois do `json()`.
    const relogio = setTimeout(() => controle.abort(), this.o.timeoutMs ?? 8000)
    let corpo: { status?: unknown; tracking?: unknown; tags?: unknown } | null
    try {
      let resposta: Response
      try {
        resposta = await fetch(`${this.base}/api/v0/order/info/${encodeURIComponent(id)}`, {
          method: "GET",
          signal: controle.signal,
          headers: this.headers(),
        })
      } catch (e) {
        throw new ErroSuperfrete(`SuperFrete order/info fora do ar ou sem resposta (${(e as Error)?.name ?? "erro"})`)
      }
      if (!resposta.ok) {
        throw new ErroSuperfrete(`SuperFrete order/info → HTTP ${resposta.status}`)
      }
      try {
        corpo = (await resposta.json()) as typeof corpo
      } catch {
        throw new ErroSuperfrete(
          controle.signal.aborted
            ? "SuperFrete order/info: tempo esgotado lendo a resposta."
            : "SuperFrete order/info devolveu uma resposta que não é JSON."
        )
      }
    } finally {
      clearTimeout(relogio)
    }
    const tracking = typeof corpo?.tracking === "string" && corpo.tracking.trim() ? corpo.tracking.trim() : null
    const tags = Array.isArray(corpo?.tags)
      ? corpo.tags
          .map((t) => (t && typeof t === "object" ? (t as { tag?: unknown }).tag : undefined))
          .filter((t) => typeof t === "string" || typeof t === "number")
          .map(String)
      : []
    return { status: typeof corpo?.status === "string" ? corpo.status : "", tracking, tags }
  }

  async cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> {
    const controle = new AbortController()
    const relogio = setTimeout(() => controle.abort(), this.o.timeoutMs ?? 5000)
    let resposta: Response
    try {
      resposta = await fetch(`${this.base}/api/v0/calculator`, {
        method: "POST",
        signal: controle.signal,
        headers: this.headers(),
        body: JSON.stringify({
          from: { postal_code: soDigitos(this.o.cepOrigem) },
          to: { postal_code: soDigitos(cepDestino) },
          services: "1,2,17",
          options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
          package: { width: pacote.largura, height: pacote.altura, length: pacote.comprimento, weight: pacote.peso_kg },
        }),
      })
    } catch (e) {
      throw new ErroSuperfrete(`SuperFrete fora do ar ou sem resposta: ${(e as Error).message}`)
    } finally {
      clearTimeout(relogio)
    }
    if (!resposta.ok) {
      throw new ErroSuperfrete(`SuperFrete calculator → HTTP ${resposta.status}: ${(await resposta.text()).slice(0, 200)}`)
    }
    const corpo = (await resposta.json()) as unknown
    if (!Array.isArray(corpo)) throw new ErroSuperfrete("SuperFrete calculator devolveu um formato inesperado.")

    const cotacoes: Cotacao[] = []
    for (const item of corpo as ItemDaResposta[]) {
      const servico = SERVICOS.find((s) => ID_SUPERFRETE[s] === item.id)
      if (!servico || item.has_error || item.price === null || item.price === undefined) continue
      const prazo = item.delivery_time ?? 0
      cotacoes.push({
        servico,
        centavos: paraCentavos(item.price),
        prazoMin: item.delivery_range?.min ?? prazo,
        prazoMax: item.delivery_range?.max ?? prazo,
      })
    }
    // Ordem estável (mini → pac → sedex), independente da ordem da resposta.
    return SERVICOS.flatMap((s) => cotacoes.filter((c) => c.servico === s))
  }
}
