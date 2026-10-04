import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rodarAvisosPendentes } from "../lib/parceria-aviso"

// Aviso de venda para a creator — a cada 5 minutos manda o que ficou pendente (venda fora do horário 8h–21h,
// teto da hora, falha passageira) e fecha como "incerto" o que travou no envio. Nunca lança.
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md.
export default async function parceriaAvisosJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return // suítes de integração carregam os jobs
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await rodarAvisosPendentes(container, new Date(), { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[parceria] rodada de avisos falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "parceria-avisos",
  schedule: "*/5 * * * *",
}
