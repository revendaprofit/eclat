import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { enviarConvitesClube } from "../lib/convite-clube"

// Convite para o Clube Éclat depois do despacho — a cada 5 minutos: pedidos despachados há mais de
// 10 min (e menos de 24 h) cuja cliente ainda não está no grupo recebem o convite, uma vez.
// Regras e marcas em lib/convite-clube.ts. NODE_ENV=test: não roda (mesmo motivo dos outros jobs).
export default async function conviteClubeJob(container: MedusaContainer) {
  if (process.env.NODE_ENV === "test") return
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    await enviarConvitesClube(container, { info: (m) => logger.info(m), warn: (m) => logger.warn(m) })
  } catch (e) {
    logger.warn(`[clube-convite] rodada falhou (${(e as Error)?.name ?? "erro"}) — tenta de novo na próxima`)
  }
}

export const config = {
  name: "convite-clube-pos-despacho",
  schedule: "*/5 * * * *",
}
