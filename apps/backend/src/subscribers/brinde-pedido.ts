// order.placed → marca o pedido com o presente que levou (`metadata.brinde = "meia" | "oculos"`).
// É essa marca que conta o estoque reservado para presente (lib/brinde.ts, presentesUsados).
// Falha aqui não afeta o pedido: só log.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { ehLinhaDePresente } from "../modules/brinde/regra"

export default async function brindePedido({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [pedido],
    } = await query.graph({ entity: "order", fields: ["id", "metadata", "items.metadata"], filters: { id: data.id } })
    const presente = (pedido?.items ?? []).find((i: any) => ehLinhaDePresente(i)) as any
    if (!presente) return
    const orderService: any = container.resolve(Modules.ORDER)
    await orderService.updateOrders(data.id, { metadata: { ...(pedido.metadata ?? {}), brinde: presente.metadata.brinde } })
    logger.info(`[brinde] pedido ${data.id}: presente ${presente.metadata.brinde}`)
  } catch (e) {
    logger.error(`[brinde] falha ao marcar o pedido ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
