import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rodarDetector, rodarEntrega } from "../lib/clube-carteiro"

// Clube Éclat — a cada 5 minutos: detecta eventos de estoque → fila; entrega o que está
// aprovado e vencido no grupo. Nunca lança (o scheduler do Medusa não deve morrer por isso).
export default async function clubeJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const log = (m: string) => logger.info(m)
  try {
    await rodarDetector(container, log)
  } catch (e) {
    logger.warn(`[clube] detector falhou: ${(e as Error).message}`)
  }
  try {
    await rodarEntrega(container, log)
  } catch (e) {
    logger.warn(`[clube] entrega falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "clube-eclat",
  schedule: "*/5 * * * *",
}
