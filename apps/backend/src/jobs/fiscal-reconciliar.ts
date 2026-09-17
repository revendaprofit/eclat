import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarPendentes } from "../lib/fiscal/fiscal-reconciliar"
import { fiscalDbConfigured } from "../lib/fiscal/fiscal-db"

// Rede de segurança da emissão síncrona (spec §7.3): resolve transmissões que ficaram sem resposta
// (timeout, 5xx) localizando a nota no fornecedor, e refaz reconciliações que falharam. Um
// documento preso em 'autorizado_nao_verificado' bloqueia a devolução daquele pedido.

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
