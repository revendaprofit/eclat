import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarPagamentos } from "../modules/mercadopago/reconciliar"

// Rede de segurança do pagamento (spec Parte 4 §13, riscos 2 e 3): webhook perdido → conclui o
// carrinho; dinheiro recebido sem pedido → estorna e avisa. Só age com MERCADOPAGO_ACCESS_TOKEN.
export default async function mercadopagoReconciliarJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  try {
    const r = await reconciliarPagamentos(container)
    if ("pulado" in r) return
    if (r.sessoesConsultadas || r.pagamentosSemPedido || r.erros.length) {
      logger.info(
        `[mercadopago] reconciliação: ${r.sessoesConsultadas} sessão(ões) consultada(s), ${r.carrinhosConcluidos} carrinho(s) concluído(s), ` +
          `${r.pagamentosSemPedido} pagamento(s) sem pedido, ${r.estornados} estornado(s)${r.erros.length ? `, erros: ${r.erros.join(" | ")}` : ""}`
      )
    }
  } catch (e) {
    logger.error(`[mercadopago] reconciliação falhou: ${(e as Error).message}`)
  }
}

export const config = {
  name: "mercadopago-reconciliar",
  schedule: "*/10 * * * *",
}
