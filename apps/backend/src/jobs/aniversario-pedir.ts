import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { enviarPerguntasDeAniversario } from "../lib/aniversario-envios"

// Programa de aniversário (sócia, 2026-10-14): todo dia às 10h de Brasília pergunta a data a quem já comprou e
// ainda não tem aniversário na ficha — uma vez por cliente, até 20 por dia (lib/aniversario-envios.ts).
export default async function aniversarioPedirJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await enviarPerguntasDeAniversario(container, { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[aniversario-pedir] rodada falhou (${(e as Error)?.message ?? "erro"}) — tenta de novo amanhã`)
  }
}

export const config = {
  name: "aniversario-pedir-data",
  schedule: "0 13 * * *", // 13h UTC = 10h em Brasília
}
