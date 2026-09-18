// Provider de notificação por e-mail via Resend (canal "email" do Notification Module).
//
// fetch cru em vez do SDK `resend`: é um POST só, e assim o backend não ganha dependência nova
// (mesma escolha de modules/mercadopago/cliente.ts). Templates são funções puras em ./templates.
import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type { Logger, NotificationTypes } from "@medusajs/framework/types"
import type { DadosPedido } from "./dados-pedido"
import { pedidoConfirmado, type EmailPronto } from "./templates/pedido-confirmado"

const API = "https://api.resend.com/emails"

export type OpcoesResend = { apiKey: string; from: string; replyTo?: string }

// Um template novo entra aqui: nome usado no createNotifications → função que monta o e-mail.
const TEMPLATES: Record<string, (dados: never) => EmailPronto> = {
  "pedido-confirmado": pedidoConfirmado as (dados: never) => EmailPronto,
}

export default class ResendNotificationService extends AbstractNotificationProviderService {
  static identifier = "resend"

  private logger: Logger
  private opcoes: OpcoesResend

  constructor({ logger }: { logger: Logger }, opcoes: OpcoesResend) {
    super()
    this.logger = logger
    this.opcoes = opcoes
  }

  static validateOptions(opcoes: Record<string, unknown>) {
    for (const campo of ["apiKey", "from"]) {
      if (!opcoes?.[campo]) {
        throw new MedusaError(MedusaError.Types.INVALID_DATA, `Resend: opção "${campo}" é obrigatória`)
      }
    }
  }

  async send(
    n: NotificationTypes.ProviderSendNotificationDTO
  ): Promise<NotificationTypes.ProviderSendNotificationResultsDTO> {
    const montar = TEMPLATES[n.template]
    if (!montar) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `Resend: template "${n.template}" não existe`)
    }
    const { idempotencia, ...dados } = (n.data ?? {}) as Record<string, unknown>
    const email = montar(dados as unknown as DadosPedido as never)

    const resposta = await fetch(API, {
      method: "POST",
      headers: {
        authorization: `Bearer ${this.opcoes.apiKey}`,
        "content-type": "application/json",
        // o Resend descarta um segundo envio com a mesma chave em 24h — protege de evento repetido
        ...(idempotencia ? { "idempotency-key": String(idempotencia) } : {}),
      },
      body: JSON.stringify({
        from: n.from || this.opcoes.from,
        to: [n.to],
        ...(this.opcoes.replyTo ? { reply_to: this.opcoes.replyTo } : {}),
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    })

    if (!resposta.ok) {
      const detalhe = await resposta.text().catch(() => "")
      const msg = `Resend respondeu ${resposta.status} ao enviar "${n.template}": ${detalhe.slice(0, 300)}`
      this.logger.error(msg)
      throw new MedusaError(MedusaError.Types.UNEXPECTED_STATE, msg)
    }

    const { id } = (await resposta.json()) as { id: string }
    this.logger.info(`Resend: "${n.template}" enviado (${id})`)
    return { id }
  }
}
