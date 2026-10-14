// order.placed → se o carrinho trouxe o aniversário (campo opcional do checkout, cart.metadata.aniversario vira
// order.metadata.aniversario) e a cliente ainda não tem a data na ficha, grava em customer.metadata.
// Programa de aniversário (sócia, 2026-10-14). Nunca pode afetar o pedido: tudo em try/catch + log.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { gravarAniversario } from "../lib/aniversario-envios"

export default async function aniversarioDoPedido({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [pedido],
    } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id", "metadata", "customer.metadata"],
      filters: { id: data.id },
    })
    const aniversario = (pedido?.metadata as Record<string, unknown> | null)?.aniversario
    if (!pedido?.customer_id || typeof aniversario !== "string" || !/^\d{2}-\d{2}$/.test(aniversario)) return
    const jaTem = (pedido.customer as { metadata?: Record<string, unknown> | null } | null)?.metadata?.aniversario
    if (jaTem) return
    await gravarAniversario(container, pedido.customer_id, { aniversario, aniversario_origem: "checkout" })
    logger.info(`[aniversario] pedido ${data.id}: aniversário ${aniversario} gravado na cliente ${pedido.customer_id}`)
  } catch (e) {
    logger.warn(`[aniversario] pedido ${data.id}: não gravou o aniversário (${(e as Error).message})`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
