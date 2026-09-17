// Provider de pagamento Mercado Pago (Checkout Transparente via Orders API).
// Spec: docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md
//
// Contrato com a vitrine (F2, ainda não construída): `initiatePaymentSession` só é chamado para
// este provider DEPOIS que a cliente já escolheu Pix ou já tokenizou o cartão no Brick — nunca
// no simples clique do rádio "Cartão"/"Pix" sem dado nenhum. Isso é diferente do padrão do
// Stripe (que cria uma PaymentIntent vazia e confirma depois no navegador): a Orders API cria E
// processa a order na mesma chamada, então `initiatePayment` já precisa ter tudo. Se `data.metodo`
// vier vazio, é erro de integração da vitrine — nunca adivinhamos (Invariante 6 do CLAUDE.md).
import { AbstractPaymentProvider, MedusaError } from "@medusajs/framework/utils"
import type { Logger } from "@medusajs/framework/types"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  PaymentProviderContext,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import { assinaturaValida } from "./assinatura.js"
import { ClienteMercadoPago, ErroMercadoPago, extrairMotivoDeRecusa, type Order } from "./cliente.js"
import { paraCentavos, paraValorMp } from "./dinheiro.js"
import { mensagemDeRecusa } from "./recusas.js"
import { estaAprovada, paraAcaoDoWebhook, paraStatusDaSessao } from "./status.js"

export type OpcoesMercadoPago = {
  accessToken: string
  webhookSecret?: string
  maxParcelas?: number
  /** Validade do código Pix em minutos (spec §6: 30). Vira `expiration_time: "PT{n}M"`. */
  pixExpiraMin?: number
  descricaoFatura?: string
}

type InjectedDependencies = {
  logger: Logger
}

type MetodoEscolhido = "pix" | "cartao"

export default class MercadoPagoProviderService extends AbstractPaymentProvider<OpcoesMercadoPago> {
  static identifier = "mercadopago"

  protected readonly logger_: Logger
  protected readonly opcoes_: OpcoesMercadoPago
  protected readonly cliente_: ClienteMercadoPago

  static validateOptions(options: Record<string, unknown>) {
    if (!options.accessToken) {
      throw new Error("A opção `accessToken` é obrigatória no provider mercadopago (medusa-config.ts)")
    }
  }

  constructor(cradle: InjectedDependencies, options: OpcoesMercadoPago) {
    super(cradle, options)
    this.logger_ = cradle.logger
    this.opcoes_ = options
    this.cliente_ = new ClienteMercadoPago(options.accessToken)
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id as string | undefined
    const metodo = input.data?.metodo as MetodoEscolhido | undefined
    if (!sessionId || !metodo) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "mercadopago: initiatePayment precisa de data.session_id e data.metodo (\"pix\" ou \"cartao\") — a vitrine só deve chamar isso depois de a cliente escolher o método."
      )
    }

    const payload = this.montarPayload({ metodo, amount: input.amount, sessionId, context: input.context, data: input.data })

    try {
      const order = await this.cliente_.criarOrder(payload, sessionId)
      return { id: order.id, status: paraStatusDaSessao(order), data: await this.montarDadosDaSessao(order) }
    } catch (erro) {
      return this.tratarFalhaDeCriacao(erro, sessionId)
    }
  }

  /**
   * Uma recusa de cartão chega como HTTP 402 — mas a doc confirma (e a F0 provou) que o corpo
   * do erro TEM a order completa em `erro.corpo.data`. Sem isso, o checkout perderia o
   * `mp_order_id` de uma tentativa recusada e não teria como mostrar a mensagem certa.
   */
  private async tratarFalhaDeCriacao(erro: unknown, sessionId: string): Promise<InitiatePaymentOutput> {
    if (erro instanceof ErroMercadoPago && erro.corpo && (erro.corpo as { data?: Order }).data) {
      const order = (erro.corpo as { data: Order }).data
      const motivo = extrairMotivoDeRecusa(erro.corpo)
      this.logger_.info(`mercadopago: order ${order.id} recusada (${motivo ?? "motivo desconhecido"})`)
      return {
        id: order.id,
        status: "error",
        data: { ...(await this.montarDadosDaSessao(order)), mensagem_recusa: mensagemDeRecusa(motivo) },
      }
    }
    // Erro sem order associada (ex.: payload inválido, MP fora do ar) — não é uma recusa de
    // negócio, é falha técnica. Propaga pro Medusa tratar como erro genérico.
    this.logger_.error(`mercadopago: falha ao criar order pra sessão ${sessionId}`, erro as Error)
    throw erro
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return this.getPaymentStatus(input)
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const orderId = input.data?.mp_order_id as string | undefined
    if (!orderId) return { status: "pending", data: input.data }
    const order = await this.cliente_.buscarOrder(orderId)
    return { status: paraStatusDaSessao(order), data: await this.montarDadosDaSessao(order) }
  }

  /**
   * A Orders API captura sozinha quando `processing_mode: "automatic"` (confirmado na F0:
   * `capture_mode: "automatic_async"` na resposta) — não existe uma chamada de captura pra
   * fazer. Este método só existe pra satisfazer o contrato do Medusa.
   */
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    const orderId = input.data?.mp_order_id as string | undefined
    if (!orderId) return { data: input.data }
    // Melhor esforço: achado da F0 é que isso costuma dar 422 numa order automática com
    // transação já embutida (spec §6.6). `cancelarOrder` nunca lança — só devolve null.
    const cancelada = await this.cliente_.cancelarOrder(orderId, `cancel-${orderId}`)
    return { data: cancelada ? await this.montarDadosDaSessao(cancelada) : input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return this.cancelPayment(input)
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const orderId = input.data?.mp_order_id as string | undefined
    if (!orderId) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "mercadopago: refundPayment sem mp_order_id em data")
    }
    const valorTotalOriginal = input.data?.valor_total as string | undefined
    const valorPedido = paraValorMp(input.amount)
    const chave = `refund-${orderId}-${valorPedido}`

    const ehTotal = valorTotalOriginal === valorPedido
    const order = await this.cliente_.estornarOrder(
      orderId,
      ehTotal ? {} : { amount: valorPedido, transactionId: input.data?.mp_payment_id as string | undefined },
      chave
    )
    return { data: await this.montarDadosDaSessao(order) }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const orderId = input.data?.mp_order_id as string | undefined
    if (!orderId) return { data: input.data }
    const order = await this.cliente_.buscarOrder(orderId)
    return { data: await this.montarDadosDaSessao(order) }
  }

  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const sessionId = input.data?.session_id as string | undefined
    const metodo = input.data?.metodo as MetodoEscolhido | undefined
    const valorTotalAtual = input.data?.valor_total as string | undefined
    const valorNovo = paraValorMp(input.amount)

    if (!sessionId || !metodo || valorTotalAtual === valorNovo) {
      // Nada de order criada ainda, ou o valor não mudou de verdade — não faz sentido recriar.
      return { status: "pending", data: input.data }
    }

    if (metodo === "cartao") {
      // Uma order de cartão já processada não pode ter o valor trocado por baixo do pano —
      // seria recobrar sem o consentimento explícito da cliente. A vitrine precisa pedir um
      // token novo do Brick e chamar initiatePayment de novo, não updatePayment.
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "mercadopago: o valor do carrinho mudou depois do cartão já processado — gere uma nova sessão de pagamento em vez de atualizar esta."
      )
    }

    // Pix: spec §6.6 — não cancelamos a order antiga (não funciona em automatic mode), só
    // geramos uma nova pro valor certo. A antiga fica órfã e expira sozinha (D1: nunca reservou
    // estoque nem virou pedido).
    const payload = this.montarPayload({ metodo, amount: input.amount, sessionId, context: input.context, data: input.data })
    try {
      const order = await this.cliente_.criarOrder(payload, `${sessionId}-v${Date.now()}`)
      return { status: paraStatusDaSessao(order), data: await this.montarDadosDaSessao(order) }
    } catch (erro) {
      const resultado = await this.tratarFalhaDeCriacao(erro, sessionId)
      return { status: resultado.status, data: resultado.data }
    }
  }

  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const corpo = payload.data as { data?: { id?: string } } | undefined
    const orderIdDoWebhook = corpo?.data?.id
    if (!orderIdDoWebhook) return { action: "not_supported" }

    const cabecalhos = payload.headers as Record<string, string | string[] | undefined>
    const assinaturaOk = assinaturaValida({
      xSignature: pegarHeader(cabecalhos, "x-signature"),
      xRequestId: pegarHeader(cabecalhos, "x-request-id"),
      dataId: orderIdDoWebhook,
      segredo: this.opcoes_.webhookSecret,
    })
    if (!assinaturaOk) {
      this.logger_.warn(`mercadopago: webhook com assinatura inválida (order ${orderIdDoWebhook}), ignorado`)
      return { action: "not_supported" }
    }

    // O corpo do webhook nunca é fonte da verdade (spec §7) — sempre confirma direto na API.
    const order = await this.cliente_.buscarOrder(orderIdDoWebhook)
    const sessionId = order.external_reference
    if (!sessionId) {
      this.logger_.warn(`mercadopago: order ${order.id} sem external_reference, não dá pra achar a sessão`)
      return { action: "not_supported" }
    }

    const acao = paraAcaoDoWebhook(order)
    if (acao === "not_supported") {
      // Achado da F0 (ver status.ts): o Medusa não reage sozinho a estorno/chargeback. Este log
      // é o único rastro até a Fase F3 (alerta no Cockpit) existir de verdade.
      this.logger_.warn(
        `mercadopago: order ${order.id} (sessão ${sessionId}) em ${order.status}/${order.status_detail} — precisa de atenção manual (estorno ou contestação)`
      )
    }

    return { action: acao, data: { session_id: sessionId, amount: Number(order.total_amount) } }
  }

  // ── Montagem de payload/dados ──

  private montarPayload(args: {
    metodo: MetodoEscolhido
    amount: InitiatePaymentInput["amount"]
    sessionId: string
    context?: PaymentProviderContext
    data?: Record<string, unknown>
  }): Record<string, unknown> {
    const valor = paraValorMp(args.amount)
    const paymentMethod =
      args.metodo === "pix"
        ? { id: "pix", type: "bank_transfer" }
        : {
            id: args.data?.bandeira as string,
            type: "credit_card",
            token: args.data?.token as string,
            installments: Math.min(Number(args.data?.parcelas ?? 1), this.opcoes_.maxParcelas ?? 4),
          }

    return {
      type: "online",
      processing_mode: "automatic",
      external_reference: args.sessionId,
      total_amount: valor,
      description: this.opcoes_.descricaoFatura ?? "USEECLAT",
      payer: this.montarPayer(args.context, args.data),
      transactions: {
        payments: [
          {
            amount: valor,
            // Confirmado no sandbox (2026-09-17): a Orders API aceita a validade por pagamento e
            // devolve `date_of_expiration`. Sem isso o Pix fica com o prazo padrão da conta.
            ...(args.metodo === "pix" ? { expiration_time: `PT${this.opcoes_.pixExpiraMin ?? 30}M` } : {}),
            payment_method: paymentMethod,
          },
        ],
      },
    }
  }

  private montarPayer(context: PaymentProviderContext | undefined, data: Record<string, unknown> | undefined) {
    const cliente = context?.customer
    const cpf = data?.cpf as string | undefined
    if (!cpf) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "mercadopago: falta o CPF do pagador (data.cpf)")
    }
    return {
      email: cliente?.email ?? (data?.email as string | undefined) ?? "",
      first_name: (data?.nomeTitular as string | undefined) ?? cliente?.first_name ?? "Comprador",
      identification: { type: "CPF", number: cpf },
    }
  }

  private async montarDadosDaSessao(order: Order): Promise<Record<string, unknown>> {
    const pagamento = order.transactions?.payments?.[0]
    const dados: Record<string, unknown> = {
      mp_order_id: order.id,
      mp_payment_id: pagamento?.id,
      metodo: pagamento?.payment_method?.type === "bank_transfer" ? "pix" : "cartao",
      valor_total: order.total_amount,
      status_mp: order.status,
      status_detail_mp: order.status_detail,
    }
    if (pagamento?.payment_method?.type === "credit_card") {
      dados.bandeira = pagamento.payment_method.id
      dados.parcelas = pagamento.payment_method.installments
    }
    if (pagamento?.payment_method?.type === "bank_transfer") {
      dados.qr_code = pagamento.payment_method.qr_code
      dados.qr_code_base64 = pagamento.payment_method.qr_code_base64
      dados.ticket_url = pagamento.payment_method.ticket_url
      dados.expira_em = pagamento.date_of_expiration
    }
    if (estaAprovada(order)) {
      dados.aprovado_em = new Date().toISOString()
      await this.anexarTarifa(dados, order)
    }
    return dados
  }

  /**
   * A tarifa real não existe em nenhum campo da Orders API (achado da F0, findings.md) — só
   * consultando a API clássica de Payments por `external_reference` (o id da sessão). Uma
   * falha aqui NUNCA pode derrubar o pagamento em si: fica sem tarifa por enquanto, e a rotina
   * de reconciliação (spec §13, risco 2) ou uma nova chamada a `retrievePayment` completa depois.
   */
  private async anexarTarifa(dados: Record<string, unknown>, order: Order): Promise<void> {
    if (!order.external_reference) return
    try {
      const pagamentoClassico = await this.cliente_.buscarPagamentoPorReferencia(order.external_reference)
      if (!pagamentoClassico?.fee_details?.length) return
      dados.tarifa_centavos = pagamentoClassico.fee_details.reduce((total, f) => total + paraCentavos(f.amount), 0)
      if (pagamentoClassico.transaction_details?.net_received_amount != null) {
        dados.liquido_centavos = paraCentavos(pagamentoClassico.transaction_details.net_received_amount)
      }
    } catch (erro) {
      this.logger_.warn(`mercadopago: não deu pra buscar a tarifa da order ${order.id} agora: ${(erro as Error).message}`)
    }
  }
}

function pegarHeader(cabecalhos: Record<string, string | string[] | undefined>, nome: string): string | undefined {
  const valor = cabecalhos[nome] ?? cabecalhos[nome.toLowerCase()]
  return Array.isArray(valor) ? valor[0] : valor
}
