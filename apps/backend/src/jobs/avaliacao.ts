import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rodarAvaliacoes } from "../lib/avaliacao"

// Pedido de avaliação pelo WhatsApp — a cada 5 minutos: registra pedidos entregues (ou despachados há
// 10 dias) e envia o que estiver na vez. Nada sai com o interruptor desligado (avaliacao_config.ativo).
// Nunca lança. Ver architecture/avaliacao.md.
export default async function avaliacaoJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return // suítes de integração carregam os jobs
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await rodarAvaliacoes(container, { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[avaliacao] rodada falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "avaliacao-pedidos",
  schedule: "*/5 * * * *",
}
