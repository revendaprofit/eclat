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
    // Achado N1 (re-revisão da onda de correção): o interruptor mestre precisa ser lido ANTES de
    // montarItensDoPedido. Essa função lança ErroFiscal quando falta CPF ou municipio_ibge no
    // pedido — que é TODO pedido real hoje, porque o checkout ainda não coleta esses dados. Com
    // a ordem antiga (montar itens primeiro, checar o interruptor depois dentro de emitirVenda),
    // o pedido sem CPF nunca chegava a saber que a emissão estava desligada: abortava com 422
    // antes disso, no exato cenário que motivou o Bloco 1 (emissao_ativa=false, o padrão de
    // fábrica). A rota é a ÚNICA dona desta decisão agora — emitirVenda não verifica mais
    // emissao_ativa (ver comentário lá). Não afeta a prévia: previa=true nunca transmite nem
    // consome numeração, então roda independente do interruptor, como sempre foi.
    if (!previa) {
      const config = await getConfig()
      if (!config.emissao_ativa) {
        return res.json({
          documento: null,
          emissao_desligada: true,
          motivo: "Emissão fiscal desligada em Fiscal → Configuração.",
        })
      }
    }

    const dados = await montarItensDoPedido(req.scope, order_id)

    if (previa) {
      const [config, perfis] = await Promise.all([getConfig(), listPerfis()])
      // Prévia não consome numeração nem grava documento — o identificador só precisa existir.
      const { payload } = montarPayloadVenda({ config, perfis, ...dados, identificador: `previa:${order_id}` })
      return res.json({ previa: await previsualizar(payload), payload })
    }

    return res.json({
      documento: await emitirVenda({ orderId: order_id, ...dados, avisar: (m) => logger.warn(m) }),
    })
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] emitir ${order_id}: ${erro.message}`)
    // ErroFiscal sempre tem mensagem escrita para o operador ler.
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
