import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { reconciliarDocumento } from "../../../lib/fiscal/fiscal-reconciliar"
import { documentoPorChave } from "../../../lib/fiscal/fiscal-db"
import type { StatusDocumento } from "../../../lib/fiscal/tipos"

// Status que já não mudam mais: reconciliar de novo só baixaria XML à toa (achado da revisão
// de 2026-09-17). "verificado" já foi lido; "rejeitado" nunca teve chave autorizada;
// "denegado" consumiu numeração mas não tem XML de autorização para baixar.
const STATUS_TERMINAIS = new Set<StatusDocumento>(["verificado", "rejeitado", "denegado"])

// Webhook da Brasil NFe: avisa que um documento mudou de status.
//
// O corpo é tratado como DADO NÃO CONFIÁVEL. Ele nunca carrega o resultado fiscal — só diz
// "o documento X mudou". A verdade vem do XML que NÓS baixamos, assinado pela SEFAZ. Assim um
// webhook forjado não consegue fabricar uma autorização.
//
// Idempotente: reconciliar duas vezes o mesmo documento é inofensivo (grava o mesmo nItem).
// Sempre responde 200, para o fornecedor não ficar reenviando indefinidamente.

// Esquema de autenticação PENDENTE de confirmação com o fornecedor (ver brief da Task 11).
// Assumimos aqui o mesmo padrão do webhook do WhatsApp (?token= comparado a um segredo).
// Isolado nesta função para que, se a Brasil NFe usar assinatura HMAC no header, a troca seja
// só aqui dentro — sem tocar no restante da rota.
function autenticado(req: MedusaRequest): boolean {
  const esperado = process.env.BRASILNFE_WEBHOOK_SECRET
  if (!esperado) return false
  const recebido = (req.query?.token as string | undefined) ?? ""
  return recebido === esperado
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)

  if (!autenticado(req)) {
    logger.warn("[fiscal] webhook recebido com token inválido — ignorado")
    return res.status(200).json({ ok: true })
  }

  const body = (req.body || {}) as { chave?: string; chave_acesso?: string }
  const chave = body.chave_acesso ?? body.chave

  if (!chave) {
    logger.warn("[fiscal] webhook sem chave de acesso — ignorado")
    return res.status(200).json({ ok: true })
  }

  try {
    const doc = await documentoPorChave(String(chave))
    if (!doc) {
      logger.warn(`[fiscal] webhook para chave desconhecida ${chave} — ignorado`)
      return res.status(200).json({ ok: true })
    }
    if (STATUS_TERMINAIS.has(doc.status)) {
      return res.status(200).json({ ok: true, ja_resolvido: true })
    }
    const r = await reconciliarDocumento(doc.id)
    for (const d of r.divergencias) logger.warn(`[fiscal] ${d}`)
    logger.info(`[fiscal] documento ${doc.id} reconciliado via webhook`)
  } catch (e) {
    // Nunca devolve erro ao fornecedor: a varredura periódica pega o caso depois.
    logger.error(`[fiscal] webhook falhou: ${(e as Error).message}`)
  }

  return res.status(200).json({ ok: true })
}
