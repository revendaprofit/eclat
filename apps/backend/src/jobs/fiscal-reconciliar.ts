import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarPendentes } from "../lib/fiscal/fiscal-reconciliar"
import { fiscalDbConfigured } from "../lib/fiscal/fiscal-db"

// Rede de segurança da reconciliação (spec §7.3): o webhook pode se perder, e um documento
// preso em 'autorizado_nao_verificado' bloqueia a devolução daquele pedido para sempre.

export default async function fiscalReconciliarJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  if (!fiscalDbConfigured()) return
  try {
    const r = await reconciliarPendentes(50)
    if (r.processados > 0) {
      logger.info(`[fiscal] varredura: ${r.verificados}/${r.processados} documentos verificados`)
    }
  } catch (e) {
    logger.error(`[fiscal] varredura falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "fiscal-reconciliar",
  schedule: "*/10 * * * *",
}
