// order.placed → e-mail "pedido confirmado" (architecture/email.md).
// O pedido só nasce com o pagamento aprovado, então este é também o "pagamento recebido".
// Falha de e-mail NUNCA pode afetar o pedido: tudo aqui é try/catch + log.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { getPrevenda } from "../lib/prevenda"
import { montarDadosPedido } from "../modules/resend/dados-pedido"

const LOJA_URL = process.env.STOREFRONT_URL || "https://www.useeclat.com.br"

export default async function pedidoConfirmado({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!process.env.RESEND_API_KEY) return // e-mail desligado neste ambiente (ver medusa-config.ts)

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [pedido],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "email",
        "total",
        "item_subtotal",
        "shipping_total",
        "discount_total",
        "items.*",
        "shipping_address.*",
      ],
      filters: { id: data.id },
    })
    if (!pedido?.email) {
      logger.warn(`[email] pedido ${data.id} sem e-mail; confirmação não enviada`)
      return
    }

    const idempotencia = `pedido-confirmado-${pedido.id}`
    await container.resolve(Modules.NOTIFICATION).createNotifications({
      to: pedido.email,
      channel: "email",
      template: "pedido-confirmado",
      trigger_type: "order.placed",
      resource_type: "order",
      resource_id: pedido.id,
      idempotency_key: idempotencia,
      data: { ...montarDadosPedido(pedido as never, { lojaUrl: LOJA_URL, prevenda: await getPrevenda() }), idempotencia },
    })
  } catch (e) {
    logger.error(`[email] falha ao enviar confirmação do pedido ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
