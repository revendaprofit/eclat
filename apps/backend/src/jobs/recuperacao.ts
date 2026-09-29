import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { rodarDetector, rodarEnvios } from "../lib/recuperacao"

// Recuperação automática de vendas — a cada 5 minutos: detecta quem deixou contato e não comprou
// (lead do site, carrinho, Pix, lead de anúncio) e envia o que estiver na vez (e-mail, abordagem,
// oferta). Nada sai com os dois interruptores desligados (recuperacao_config). Nunca lança.
// Ver architecture/recuperacao.md.
export default async function recuperacaoJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return // suítes de integração carregam os jobs
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const log = { info: (m: string) => logger.info(m), warn: (m: string) => logger.warn(m) }
  try {
    await rodarDetector(container, log)
  } catch (e) {
    logger.warn(`[recuperacao] detector falhou: ${(e as Error).message}`)
  }
  try {
    await rodarEnvios(container, log)
  } catch (e) {
    logger.warn(`[recuperacao] envios falharam: ${(e as Error).message}`)
  }
}

export const config = {
  name: "recuperacao-vendas",
  schedule: "*/5 * * * *",
}
