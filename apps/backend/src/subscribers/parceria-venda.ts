// order.placed → venda com cupom de parceria vira linha em `parceria_aviso` e a creator é avisada no WhatsApp
// (lib/parceria-aviso.ts). O pedido só nasce com o pagamento aprovado, então `order.placed` É a venda.
// Falha aqui NUNCA pode afetar o pedido: tudo é try/catch + log.
import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { registrarVendaDeParceria } from "../lib/parceria-aviso"

export default async function parceriaVenda({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await registrarVendaDeParceria(container, data.id, { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[parceria] falha ao registrar a venda do pedido ${data.id}: ${(e as Error).message}`)
  }
}

export const config: SubscriberConfig = { event: "order.placed" }
