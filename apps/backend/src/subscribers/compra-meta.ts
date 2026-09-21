// order.placed → Purchase na API de Conversões da Meta (lib/meta-capi.ts).
// O pedido só nasce com o pagamento aprovado, então `order.placed` É a compra.
// Falha de medição NUNCA pode afetar o pedido: tudo aqui é try/catch + log.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { enviarCompraParaMeta } from "../lib/meta-capi"

const LOJA_URL = process.env.STOREFRONT_URL || "https://www.useeclat.com.br"

export default async function compraMeta({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!process.env.META_CAPI_TOKEN) return // medição desligada neste ambiente

  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [pedido],
    } = await query.graph({
      entity: "order",
      fields: ["id", "email", "total", "currency_code", "metadata", "items.*", "shipping_address.*"],
      filters: { id: data.id },
    })
    if (!pedido) return
    logger.info(`[meta-capi] pedido ${data.id}: ${await enviarCompraParaMeta(pedido as never, LOJA_URL)}`)
  } catch (e) {
    logger.error(`[meta-capi] falha no Purchase do pedido ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
