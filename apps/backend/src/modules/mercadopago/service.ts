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
import { assinaturaValida } from "./assinatura"
import { ClienteMercadoPago, ErroMercadoPago, extrairMotivoDeRecusa, totalJaEstornado, type Order } from "./cliente"
import { paraCentavos, paraValorMp } from "./dinheiro"
import { mensagemDeRecusa } from "./recusas"
import { estaAprovada, paraAcaoDoWebhook, paraStatusDaSessao } from "./status"

export type OpcoesMercadoPago = {
  accessToken: string
  webhookSecret?: string
  maxParcelas?: number
  /** Validade do código Pix em minutos (spec §6: 30). Vira `expiration_time: "PT{n}M"`. */
  pixExpiraMin?: number
  descricaoFatura?: string
  /**
   * Endereço público do backend (`MEDUSA_BACKEND_URL`). Daqui sai o `config.online.callback_url`
   * de cada order: o Mercado Pago avisa essa URL quando o pagamento muda de status. Avisar por
   * order (e não só pelo painel) é item obrigatório da avaliação de qualidade da integração —
   * e é o que sustenta a confiança da loja para o antifraude. Sem a opção, o campo não vai.
   */
  urlDoBackend?: string
}

/** Rota que o Medusa publica sozinho para os avisos deste provider. */
const CAMINHO_DO_WEBHOOK = "/hooks/payment/mercadopago_mercadopago"

/** Limite do que o Mercado Pago imprime na fatura do cartão. */
const LIMITE_DESCRICAO_FATURA = 22

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
      const order = await this.cliente_.criarOrder(payload, sessionId, deviceId(input.data))
      return {
        id: order.id,
        status: paraStatusDaSessao(order),
        data: { ...(await this.montarDadosDaSessao(order)), ...dadosDoCartaoInformados(input.data) },
      }
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
    // O corpo do erro é o que diz o que está errado no payload (ex.: "additionalProperties
    // 'country' not allowed"). Sem ele, o log só mostra "respondeu 400" e a investigação vira
    // adivinhação — foi o que atrasou a correção de 2026-09-19.
    const detalhe = erro instanceof ErroMercadoPago ? ` — ${JSON.stringify(erro.corpo).slice(0, 500)}` : ""
    this.logger_.error(`mercadopago: falha ao criar order pra sessão ${sessionId}${detalhe}`, erro as Error)
    throw erro
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    return this.getPaymentStatus(input)
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const orderId = input.data?.mp_order_id as string | undefined
    if (!orderId) return { status: "pending", data: input.data }
    const order = await this.cliente_.buscarOrder(orderId)
    return {
      status: paraStatusDaSessao(order),
      data: { ...(await this.montarDadosDaSessao(order)), ...dadosDoCartaoInformados(input.data) },
    }
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

    // Antes de mandar qualquer coisa: o dinheiro já voltou? Um estorno feito no painel do
    // Mercado Pago (ou por uma tentativa anterior) não aparece sozinho aqui — e é assim que o
    // Medusa pede um estorno que a Orders API executaria DE NOVO, devolvendo em dobro. Quando
    // não sobra saldo para estornar, este método só registra: devolve os dados atuais da order
    // sem chamar a API. Achado de 2026-09-20 (pedido #10, estornado no painel do MP).
    const atual = await this.cliente_.buscarOrder(orderId)
    const jaEstornado = totalJaEstornado(atual)
    const falta = Number(atual.total_amount) - jaEstornado
    if (Number(valorPedido) > falta + 0.005) {
      this.logger_.info(
        `mercadopago: order ${orderId} já tinha R$ ${jaEstornado.toFixed(2)} estornado(s) no MP e o pedido aqui é de ` +
          `R$ ${valorPedido} — nada a estornar, só registrando no Medusa.`
      )
      return { data: await this.montarDadosDaSessao(atual) }
    }

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
      const order = await this.cliente_.criarOrder(payload, `${sessionId}-v${Date.now()}`, deviceId(input.data))
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

    const itens = itensDaOrder(args.data?.itens, valor)

    return {
      type: "online",
      processing_mode: "automatic",
      external_reference: args.sessionId,
      total_amount: valor,
      description: this.opcoes_.descricaoFatura ?? "USEECLAT",
      ...this.montarConfig(),
      payer: this.montarPayer(args.context, args.data),
      ...(itens ? { items: itens } : {}),
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

  /**
   * Pagador o mais completo que a vitrine conseguir mandar. O antifraude do Mercado Pago pontua
   * cada campo: em 2026-09-19, cobranças de cartão saíam daqui só com e-mail/nome/CPF e eram
   * recusadas em série com `cc_rejected_high_risk`. Campo ausente NUNCA vira string vazia — o
   * Mercado Pago trata "" como dado ruim; melhor omitir.
   */
  /**
   * O bloco `config` da order: nome na fatura do cartão e endereço de aviso do pagamento.
   *
   * O `statement_descriptor` é o que a cliente lê na fatura do cartão. Sem ele aparece o nome
   * genérico da conta Mercado Pago — uma cobrança que a pessoa não reconhece vira contestação,
   * e é exatamente esse tipo de sinal que faz o aviso de "possível golpe" aparecer. O
   * `callback_url` é o aviso por order, item obrigatório da avaliação de qualidade da
   * integração; confirmado contra a API de produção em 2026-09-20 (os dois aceitos, devolvidos
   * de volta na resposta). Campo sem valor nunca é inventado: `config` só vai se tiver conteúdo.
   */
  private montarConfig(): { config?: Record<string, unknown> } {
    const descricao = (this.opcoes_.descricaoFatura ?? "USEECLAT").trim().slice(0, LIMITE_DESCRICAO_FATURA)
    const base = (this.opcoes_.urlDoBackend ?? "").trim().replace(/\/+$/, "")
    const config: Record<string, unknown> = {}
    if (descricao) config.statement_descriptor = descricao
    if (base) config.online = { callback_url: `${base}${CAMINHO_DO_WEBHOOK}` }
    return Object.keys(config).length ? { config } : {}
  }

  private montarPayer(context: PaymentProviderContext | undefined, data: Record<string, unknown> | undefined) {
    const cliente = context?.customer
    const cpf = data?.cpf as string | undefined
    if (!cpf) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "mercadopago: falta o CPF do pagador (data.cpf)")
    }
    const texto = (v: unknown): string | undefined => {
      const s = typeof v === "string" ? v.trim() : ""
      return s ? s : undefined
    }
    const sobrenome = texto(data?.sobrenome) ?? texto(cliente?.last_name)
    const telefone = telefoneBrasileiro(texto(data?.telefone) ?? texto(cliente?.phone))
    const endereco = enderecoDoPagador(data?.endereco)
    // Sem e-mail o Mercado Pago recusa a order inteira (400 em `$.payer.email`) e a cliente vê
    // um erro genérico. Melhor falhar aqui, dizendo o que falta, do que mandar string vazia.
    const email = texto(cliente?.email) ?? texto(data?.email)
    if (!email) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "mercadopago: falta o e-mail do pagador")
    }
    return {
      email,
      first_name: texto(data?.nomeTitular) ?? texto(cliente?.first_name) ?? "Comprador",
      ...(sobrenome ? { last_name: sobrenome } : {}),
      identification: { type: "CPF", number: cpf },
      ...(telefone ? { phone: telefone } : {}),
      ...(endereco ? { address: endereco } : {}),
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
    if (pagamento?.payment_method?.type === "bank_transfer" && !estaAprovada(order)) {
      // O QR só interessa enquanto o Pix está em aberto. Depois de pago, esses dados viram o
      // `data` do Payment (lido pelo Cockpit e pelo DRE em lote) — sem a imagem em base64.
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

/**
 * Os 4 últimos dígitos só existem no navegador (vêm do Brick junto com o token) — a Orders API
 * não os devolve. São o único dado do cartão que guardamos (spec §9), e só para exibição.
 */
/** `X-Meli-Session-Id`: o código do aparelho que a vitrine captura do SDK do Mercado Pago. */
function deviceId(data: Record<string, unknown> | undefined): string | undefined {
  const v = data?.device_id
  return typeof v === "string" && v.trim() ? v.trim() : undefined
}

/**
 * Telefone brasileiro em `{ area_code, number }`. Aceita o que a cliente digitou (com +55,
 * parênteses e traços) e descarta o que não tiver DDD + 8 ou 9 dígitos — melhor omitir do que
 * mandar telefone quebrado para o antifraude.
 */
function telefoneBrasileiro(bruto: string | undefined): { area_code: string; number: string } | undefined {
  if (!bruto) return undefined
  let digitos = bruto.replace(/\D/g, "")
  if (digitos.length > 11 && digitos.startsWith("55")) digitos = digitos.slice(2)
  if (digitos.length < 10 || digitos.length > 11) return undefined
  return { area_code: digitos.slice(0, 2), number: digitos.slice(2) }
}

type EnderecoDaVitrine = { rua?: string; numero?: string; complemento?: string; bairro?: string; cidade?: string; estado?: string; cep?: string }

// Limites de tamanho da Orders API. Passar deles derruba a cobrança inteira com HTTP 400
// (`property_value`) — aconteceu em produção em 2026-09-20 com um complemento de 23 caracteres,
// e a cliente só via "não conseguimos iniciar o pagamento". Cortar é melhor que recusar a venda:
// endereço de cobrança é dado de antifraude, não o endereço de entrega (esse vai inteiro na etiqueta).
const LIMITES_ENDERECO = {
  street_name: 50,
  street_number: 20,
  neighborhood: 50,
  city: 50,
  state: 50,
  complement: 20,
} as const

/** Endereço do pagador no formato da Orders API. Sem rua ou sem CEP, não mandamos nada. */
function enderecoDoPagador(bruto: unknown): Record<string, string> | undefined {
  if (!bruto || typeof bruto !== "object") return undefined
  const e = bruto as EnderecoDaVitrine
  const txt = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined)
  const cortar = (v: unknown, campo: keyof typeof LIMITES_ENDERECO) => txt(v)?.slice(0, LIMITES_ENDERECO[campo])
  const rua = cortar(e.rua, "street_name")
  const cep = txt(e.cep)?.replace(/\D/g, "")
  if (!rua || !cep) return undefined
  const campos: Record<string, string | undefined> = {
    street_name: rua,
    street_number: cortar(e.numero, "street_number"),
    neighborhood: cortar(e.bairro, "neighborhood"),
    city: cortar(e.cidade, "city"),
    state: cortar(e.estado, "state"),
    zip_code: cep,
    complement: cortar(e.complemento, "complement"),
  }
  return Object.fromEntries(Object.entries(campos).filter(([, v]) => v !== undefined)) as Record<string, string>
}

type ItemDaVitrine = { titulo?: string; quantidade?: number; preco_unitario?: number; sku?: string; descricao?: string }

/**
 * Itens do carrinho no formato da Orders API (o antifraude usa o que está sendo comprado).
 * `preco_unitario` chega em reais decimais, como o resto do provider; vira string com 2 casas.
 */
function itensDaOrder(bruto: unknown, totalEsperado: string): Record<string, unknown>[] | undefined {
  // Regras da Orders API sondadas em produção (2026-09-19): `unit_measure` e `country` são
  // recusados (400 unsupported_properties) e a SOMA dos itens precisa bater com `total_amount`
  // (400 order_items_total_amount_mismatch). Item é opcional: na dúvida, manda sem — nunca
  // derruba o pagamento por causa de um dado que só ajuda o antifraude.
  if (!Array.isArray(bruto) || bruto.length === 0) return undefined
  const itens = bruto
    .map((i) => {
      const item = i as ItemDaVitrine
      const titulo = typeof item?.titulo === "string" ? item.titulo.trim() : ""
      const quantidade = Number(item?.quantidade)
      const preco = Number(item?.preco_unitario)
      if (!titulo || !Number.isFinite(quantidade) || quantidade <= 0 || !Number.isFinite(preco)) return undefined
      return {
        title: titulo.slice(0, 256),
        quantity: Math.trunc(quantidade),
        unit_price: preco.toFixed(2),
        ...(typeof item.sku === "string" && item.sku.trim() ? { external_code: item.sku.trim() } : {}),
        ...(typeof item.descricao === "string" && item.descricao.trim() ? { description: item.descricao.trim().slice(0, 256) } : {}),
        type: "product",
      }
    })
    .filter((i): i is NonNullable<typeof i> => i !== undefined)
  if (!itens.length || itens.length !== bruto.length) return undefined
  const soma = itens.reduce((t, i) => t + Number(i.unit_price) * Number(i.quantity), 0)
  return soma.toFixed(2) === Number(totalEsperado).toFixed(2) ? itens : undefined
}

function dadosDoCartaoInformados(data: Record<string, unknown> | undefined): Record<string, unknown> {
  const final = data?.final_cartao
  return typeof final === "string" && /^\d{4}$/.test(final) ? { final_cartao: final } : {}
}

function pegarHeader(cabecalhos: Record<string, string | string[] | undefined>, nome: string): string | undefined {
  const valor = cabecalhos[nome] ?? cabecalhos[nome.toLowerCase()]
  return Array.isArray(valor) ? valor[0] : valor
}
