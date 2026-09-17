import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarDocumento, STATUS_TERMINAIS } from "../../../lib/fiscal/fiscal-reconciliar"
import { documentoPorChave } from "../../../lib/fiscal/fiscal-db"
import { assinaturaValida, chavesDoLote } from "../../../lib/fiscal/fiscal-webhook"

// Webhook da Brasil NFe (spec §7.4). Envelope: { event, deliveryId, timestamp, data }.
//
// A emissão de venda usa a rota SÍNCRONA do fornecedor, que não dispara webhook — então este
// endpoint NÃO é o gatilho da reconciliação. Ele existe para: o botão "Testar" do painel deles
// (test.ping), o fechamento de lote (não usamos lote hoje, mas ignorar o evento principal do
// fornecedor seria uma armadilha) e o aviso de nota de entrada contra o nosso CNPJ.
//
// O corpo é DADO NÃO CONFIÁVEL mesmo depois de autenticado: nunca carrega o resultado fiscal.
// A verdade vem do XML autorizado. Um webhook não fabrica autorização.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  const assinatura = req.headers["x-webhook-signature"]
  const valida = assinaturaValida(
    req.rawBody,
    Array.isArray(assinatura) ? assinatura[0] : assinatura,
    process.env.BRASILNFE_WEBHOOK_SECRET
  )
  if (!valida) {
    // 401, não 200: quem assina errado não é o fornecedor, e ele não precisa de gentileza.
    logger.warn("[fiscal] webhook com assinatura inválida — recusado")
    return res.status(401).json({ error: "assinatura inválida" })
  }

  const { event, deliveryId, data } = (req.body || {}) as {
    event?: string
    deliveryId?: string
    data?: unknown
  }

  try {
    if (event === "nfe.lote.finalizado") {
      for (const chave of chavesDoLote(data)) {
        const doc = await documentoPorChave(chave)
        if (!doc || STATUS_TERMINAIS.has(doc.status)) continue
        const r = await reconciliarDocumento(doc.id)
        for (const d of r.divergencias) logger.warn(`[fiscal] ${d}`)
        logger.info(`[fiscal] documento ${doc.id} reconciliado via webhook (${deliveryId})`)
      }
    } else if (event === "documento.entrada.recebida" || event === "documento.entrada.cancelada") {
      const d = (data || {}) as Record<string, unknown>
      logger.info(
        `[fiscal] nota de ENTRADA (${event}): emissor ${d.NomeEmissor} (${d.CnpjEmissor}), ` +
          `valor ${d.Valor}, chave ${d.Chave}, status ${d.Status}`
      )
    } else if (event !== "test.ping") {
      logger.info(`[fiscal] webhook com evento não tratado: ${event}`)
    }
  } catch (e) {
    // Autenticado e recebido: responde 200 mesmo se o processamento falhar, para o fornecedor
    // não re-tentar 5 vezes algo que a varredura periódica resolve.
    logger.error(`[fiscal] webhook ${event} (${deliveryId}) falhou: ${(e as Error).message}`)
  }

  return res.status(200).json({ ok: true })
}
