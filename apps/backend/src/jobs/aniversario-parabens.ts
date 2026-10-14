import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { enviarParabens } from "../lib/aniversario-envios"

// Programa de aniversário (sócia, 2026-10-14): todo dia às 9h de Brasília, quem aniversaria hoje ganha o cupom
// (10%, 1 uso, 30 dias) e a mensagem de parabéns pelo WhatsApp da marca — uma vez por ano (lib/aniversario-envios.ts).
export default async function aniversarioParabensJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await enviarParabens(container, { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[aniversario-parabens] rodada falhou (${(e as Error)?.message ?? "erro"}) — tenta de novo amanhã`)
  }
}

export const config = {
  name: "aniversario-parabens",
  schedule: "0 12 * * *", // 12h UTC = 9h em Brasília
}
