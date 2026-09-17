import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { emitirVenda } from "../../../../lib/fiscal/fiscal-emissao"
import { montarItensDoPedido } from "../../../../lib/fiscal/fiscal-pedido"
import { montarPayloadVenda } from "../../../../lib/fiscal/fiscal-payload"
import { previsualizar } from "../../../../lib/fiscal/fiscal-client"
import { getConfig, listPerfis } from "../../../../lib/fiscal/fiscal-db"
import { ErroFiscal } from "../../../../lib/fiscal/tipos"

// POST /admin/fiscal/emitir { order_id, previa?: boolean }
// Com previa=true, gera o XML/PDF sem transmitir à SEFAZ e sem consumir numeração.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { order_id, previa } = (req.body || {}) as { order_id?: string; previa?: boolean }

  if (!order_id) return res.status(400).json({ error: "order_id é obrigatório." })

  try {
    const dados = await montarItensDoPedido(req.scope, order_id)

    if (previa) {
      const [config, perfis] = await Promise.all([getConfig(), listPerfis()])
      const { payload } = montarPayloadVenda({ config, perfis, ...dados })
      return res.json({ previa: await previsualizar(payload), payload })
    }

    const documento = await emitirVenda({ orderId: order_id, ...dados })
    if (documento === null) {
      // Interruptor mestre desligado (spec §6.1) — não é erro, é modo seguro (Bloco 1 / achados
      // C1+C2). 200 com corpo explícito: o Cockpit reconhece este caso e despacha sem nota.
      return res.json({
        documento: null,
        emissao_desligada: true,
        motivo: "Emissão fiscal desligada em Fiscal → Configuração.",
      })
    }
    return res.json({ documento })
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] emitir ${order_id}: ${erro.message}`)
    // ErroFiscal sempre tem mensagem escrita para o operador ler.
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
