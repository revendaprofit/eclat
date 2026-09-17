import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { atualizarDocumento, lerDocumento } from "../../../../lib/fiscal/fiscal-db"
import { reconciliarDocumento } from "../../../../lib/fiscal/fiscal-reconciliar"
import { ErroFiscal } from "../../../../lib/fiscal/tipos"

type Acao = "anexar_chave" | "marcar_rejeitado"

const MOTIVO_PADRAO =
  "Operador confirmou no painel da Brasil NFe que esta nota não foi transmitida."

// POST /admin/fiscal/resolver { documento_id, acao, chave_acesso?, motivo? }
//
// Saída manual para o documento que fica preso em transmitido_sem_confirmacao sem chave de
// acesso: transmitir() falhou por erro de rede, reconciliarPendentes pula quem não tem chave, e
// emitirVenda recusa reemitir de propósito (evitar nota duplicada). O operador consulta o painel
// da Brasil NFe e informa o desfecho real (spec — Tarefa A do plano 2026-09-16).
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { documento_id, acao, chave_acesso, motivo } = (req.body || {}) as {
    documento_id?: string
    acao?: Acao
    chave_acesso?: string
    motivo?: string
  }

  if (!documento_id) {
    return res.status(400).json({ error: "documento_id é obrigatório." })
  }
  if (acao !== "anexar_chave" && acao !== "marcar_rejeitado") {
    return res.status(400).json({ error: "acao inválida. Use anexar_chave ou marcar_rejeitado." })
  }

  // Identifica quem fez a chamada, sem vazar segredo nenhum no log.
  const operador = (req as any).auth_context?.actor_id ?? "desconhecido"

  try {
    // Valida o formato da chave antes de qualquer chamada à rede: é erro de negócio (422),
    // não depende do estado do documento, e falhar rápido evita um round-trip desnecessário.
    if (acao === "anexar_chave" && (!chave_acesso || !/^\d{44}$/.test(chave_acesso))) {
      throw new ErroFiscal("chave_acesso precisa ter exatamente 44 dígitos numéricos.")
    }

    // Normaliza qualquer falha de leitura (inclusive "não encontrado") para ErroFiscal — regra
    // de negócio da rota, não erro de infraestrutura.
    let doc
    try {
      doc = await lerDocumento(documento_id)
    } catch {
      throw new ErroFiscal(`Documento fiscal ${documento_id} não encontrado.`)
    }

    if (doc.status !== "transmitido_sem_confirmacao" || doc.chave_acesso) {
      throw new ErroFiscal(
        `Documento ${documento_id} está em status "${doc.status}"` +
          (doc.chave_acesso ? " e já tem chave de acesso" : "") +
          '. Esta rota só resolve documentos em "transmitido_sem_confirmacao" sem chave — ' +
          "qualquer outro estado já foi resolvido pelo sistema (ou segue outro fluxo) e não deve " +
          "ser alterado manualmente."
      )
    }

    if (acao === "anexar_chave") {
      logger.info(
        `[fiscal] resolver ${documento_id}: operador ${operador} anexou chave manualmente`
      )

      await atualizarDocumento(doc.id, {
        chave_acesso: chave_acesso as string,
        status: "autorizado_nao_verificado",
      })

      // A reconciliação é quem lê o XML e confirma o nItem — não marcamos "verificado" aqui.
      try {
        const reconciliacao = await reconciliarDocumento(doc.id)
        return res.json({
          documento: await lerDocumento(doc.id),
          reconciliacao,
        })
      } catch (e) {
        // Falha da reconciliação não é erro fatal desta rota: a chave já foi gravada, o
        // documento fica em autorizado_nao_verificado e a resposta explica o que houve.
        const erroReconciliacao = e as Error
        logger.warn(
          `[fiscal] resolver ${documento_id}: chave anexada, reconciliação falhou: ${erroReconciliacao.message}`
        )
        return res.json({
          documento: await lerDocumento(doc.id),
          reconciliacao_erro:
            "A chave foi gravada, mas a reconciliação automática falhou. O documento ficou em " +
            `autorizado_nao_verificado — rode a reconciliação de novo depois. Detalhe: ${erroReconciliacao.message}`,
        })
      }
    }

    // acao === "marcar_rejeitado"
    logger.info(
      `[fiscal] resolver ${documento_id}: operador ${operador} marcou como rejeitado manualmente`
    )
    const atualizado = await atualizarDocumento(doc.id, {
      status: "rejeitado",
      rejeicao_codigo: "MANUAL",
      rejeicao_motivo: motivo || MOTIVO_PADRAO,
    })
    return res.json({ documento: atualizado })
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] resolver ${documento_id}: ${erro.message}`)
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
