import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rodarCicloDosCreators } from "../lib/creator-ciclo"

// Ciclo dos creators — uma vez por dia (7h de Brasília): lê o perfil público de cada creator aprovada, cadastra
// os posts que citam a marca, liga as vendas sem número ao último vídeo e marca os vencedores. Nunca lança.
// Desenho: docs/superpowers/specs/2026-09-29-programa-creators-design.md §9.
export default async function creatorPerfisJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return // suítes de integração carregam os jobs
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await rodarCicloDosCreators(container, new Date(), { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[creators] rotina diária falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "creator-perfis",
  schedule: "0 10 * * *", // 10h UTC = 7h em Brasília
}
