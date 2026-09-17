import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listarPorStatus, documentoDeVendaDoPedido, getConfig, listarItens } from "../../../../lib/fiscal/fiscal-db"
import type { StatusDocumento } from "../../../../lib/fiscal/tipos"

// GET /admin/fiscal/documentos            → fila de exceções (rejeitado, denegado, pendentes)
// GET /admin/fiscal/documentos?order_id=  → documento de venda daquele pedido, com itens
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const orderId = req.query?.order_id as string | undefined

  if (orderId) {
    // Escopado pelo ambiente ATUAL da config (achado I6/5.2) — nunca pega o documento de
    // homologação de um pedido depois da virada para produção.
    const { ambiente } = await getConfig()
    const doc = await documentoDeVendaDoPedido(orderId, ambiente)
    const itens = doc ? await listarItens(doc.id) : []
    return res.json({ documento: doc, itens })
  }

  const status = (req.query?.status as string | undefined)?.split(",") as StatusDocumento[] | undefined
  const alvo: StatusDocumento[] = status?.length
    ? status
    : ["rejeitado", "denegado", "em_contingencia", "transmitido_sem_confirmacao", "autorizado_nao_verificado"]

  return res.json({ documentos: await listarPorStatus(alvo, 100) })
}
