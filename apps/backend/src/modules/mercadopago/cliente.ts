// Cliente HTTP da Orders API do Mercado Pago (`/v1/orders`).
//
// Por que fetch cru e não o SDK oficial `mercadopago` (a spec original previa o SDK): a Orders
// API é recente e, até a F0 (17/09/2026), não confirmamos que a versão do SDK disponível cobre
// `/v1/orders` (a doc oficial trata Payments como "legacy" e Orders como o caminho atual, mas o
// pacote npm pode não ter acompanhado). Chamadas diretas, já validadas no sandbox real na F0
// (findings.md), evitam depender de uma cobertura de SDK que não checamos. Reavaliar quando o
// SDK anunciar suporte explícito a Orders.
const API = "https://api.mercadopago.com"

export type PaymentMethodOrder = {
  id: string
  type: "credit_card" | "bank_transfer"
  token?: string
  installments?: number
  installment_amount?: string
  qr_code?: string
  qr_code_base64?: string
  ticket_url?: string
}

export type PagamentoDaOrder = {
  id: string
  amount: string
  paid_amount?: string
  status: string
  status_detail?: string
  /** Só no Pix: quando o código expira (ISO). Vem de `expiration_time` mandado na criação. */
  date_of_expiration?: string
  payment_method: PaymentMethodOrder
}

export type Order = {
  id: string
  type: "online"
  processing_mode: "automatic" | "manual"
  external_reference?: string
  total_amount: string
  total_paid_amount?: string
  status: string
  status_detail?: string
  transactions: { payments: PagamentoDaOrder[] }
}

export type PagamentoClassico = {
  id: number
  external_reference?: string
  status: string
  status_detail?: string
  fee_details?: { amount: number; fee_payer: string; type: string }[]
  transaction_details?: { net_received_amount?: number }
}

/** Corpo de erro que a API devolve (confirmado na F0, HTTP 402/400/422). */
export type CorpoDeErroMp = {
  errors?: { code?: string; message?: string; details?: string[] }[]
  message?: string
}

export class ErroMercadoPago extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly corpo: CorpoDeErroMp
  ) {
    super(message)
    this.name = "ErroMercadoPago"
  }
}

/**
 * Extrai o motivo de uma recusa a partir do corpo de erro (HTTP 402). O formato observado na F0
 * é `errors[0].details: ["PAY_ID: motivo"]` — o motivo vem depois de ": ".
 */
export function extrairMotivoDeRecusa(corpo: CorpoDeErroMp): string | undefined {
  const detalhe = corpo.errors?.[0]?.details?.[0]
  if (!detalhe) return undefined
  const partes = detalhe.split(":")
  return partes.length > 1 ? partes.slice(1).join(":").trim() : detalhe.trim()
}

export class ClienteMercadoPago {
  constructor(private readonly accessToken: string) {}

  private async chamar<T>(
    metodo: "GET" | "POST",
    caminho: string,
    corpo?: unknown,
    chaveIdempotencia?: string,
    headersExtras?: Record<string, string>
  ): Promise<T> {
    const resposta = await fetch(`${API}${caminho}`, {
      method: metodo,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.accessToken}`,
        ...(chaveIdempotencia ? { "x-idempotency-key": chaveIdempotencia } : {}),
        ...(headersExtras ?? {}),
      },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    })
    const dados = await resposta.json().catch(() => ({}))
    if (!resposta.ok) {
      throw new ErroMercadoPago(
        `Mercado Pago respondeu ${resposta.status} em ${metodo} ${caminho}`,
        resposta.status,
        dados
      )
    }
    return dados as T
  }

  /**
   * Cria e processa uma order na mesma chamada (`processing_mode: "automatic"`, decisão da
   * spec §4). `chaveIdempotencia` deve ser o id da sessão de pagamento do Medusa — repetir a
   * mesma chave devolve a mesma order (confirmado na F0), o que protege a reautorização que o
   * Medusa faz quando o webhook chega (spec §13, risco 1).
   *
   * Uma recusa de cartão (HTTP 402) TAMBÉM tem uma order completa no corpo do erro
   * (`corpo.data`) — por isso o chamador deve capturar `ErroMercadoPago` e olhar
   * `erro.corpo.data` antes de desistir, em vez de tratar todo erro como "nada foi criado".
   */
  async criarOrder(
    payload: Record<string, unknown>,
    chaveIdempotencia: string,
    /**
     * Identificador do aparelho de quem está comprando (`X-Meli-Session-Id`). O Mercado Pago usa
     * no antifraude: sem ele a cobrança chega marcada como `security:none` e cai muito mais em
     * `cc_rejected_high_risk` (achado de 2026-09-19 em produção, três cartões seguidos).
     */
    deviceId?: string
  ): Promise<Order> {
    return this.chamar<Order>(
      "POST",
      "/v1/orders",
      payload,
      chaveIdempotencia,
      deviceId ? { "x-meli-session-id": deviceId } : undefined
    )
  }

  async buscarOrder(orderId: string): Promise<Order> {
    return this.chamar<Order>("GET", `/v1/orders/${orderId}`)
  }

  /**
   * Melhor esforço: achado da F0 é que `/cancel` devolve 422 pra uma order automática com
   * transação Pix embutida (ela já nasce "em andamento" do lado do banco). Nunca lança —
   * devolve `null` quando o Mercado Pago recusa, pra o chamador decidir o que fazer (spec §6.6:
   * não dependemos disso, deixamos a order antiga expirar sozinha).
   */
  async cancelarOrder(orderId: string, chaveIdempotencia: string): Promise<Order | null> {
    try {
      return await this.chamar<Order>("POST", `/v1/orders/${orderId}/cancel`, {}, chaveIdempotencia)
    } catch (erro) {
      if (erro instanceof ErroMercadoPago) return null
      throw erro
    }
  }

  /** Total (sem `amount`) ou parcial (`amount` + `transactionId`). Prazo: 180 dias da aprovação. */
  async estornarOrder(
    orderId: string,
    opcoes: { amount?: string; transactionId?: string } = {},
    chaveIdempotencia?: string
  ): Promise<Order> {
    const corpo = opcoes.amount ? { amount: opcoes.amount, transaction_id: opcoes.transactionId } : {}
    return this.chamar<Order>("POST", `/v1/orders/${orderId}/refund`, corpo, chaveIdempotencia)
  }

  /**
   * A tarifa real (`fee_details`) NÃO existe em nenhum campo da Orders API (achado da F0,
   * findings.md) — só aparece consultando a API clássica de Payments por `external_reference`.
   * Usamos o mesmo valor que mandamos como `external_reference` ao criar a order (o id da
   * sessão de pagamento do Medusa).
   */
  async buscarPagamentoPorReferencia(externalReference: string): Promise<PagamentoClassico | undefined> {
    const resultado = await this.chamar<{ results: PagamentoClassico[] }>(
      "GET",
      `/v1/payments/search?external_reference=${encodeURIComponent(externalReference)}`
    )
    return resultado.results?.[0]
  }
}
