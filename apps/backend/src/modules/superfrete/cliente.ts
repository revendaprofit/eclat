// Cliente HTTP da SuperFrete — só a cotação (a etiqueta nasce no Cockpit, spec §4.7).
// Doc: https://superfrete.readme.io/reference/cotacao-de-frete
import { paraCentavos } from "./dinheiro"
import type { Pacote } from "./embalagem"
import { ID_SUPERFRETE, SERVICOS, type Servico } from "./preco"

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

  async cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> {
    const controle = new AbortController()
    const relogio = setTimeout(() => controle.abort(), this.o.timeoutMs ?? 5000)
    let resposta: Response
    try {
      resposta = await fetch(`${this.base}/api/v0/calculator`, {
        method: "POST",
        signal: controle.signal,
        headers: {
          Authorization: `Bearer ${this.o.token}`,
          "User-Agent": `use.ECLAT (${this.o.contato})`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
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
