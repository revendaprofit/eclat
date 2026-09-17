import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { baixarArquivo } from "../../../../../../lib/fiscal/fiscal-client"
import { ehUuidValido, lerDocumento } from "../../../../../../lib/fiscal/fiscal-db"
import { ErroFiscal } from "../../../../../../lib/fiscal/tipos"

// GET /admin/fiscal/documentos/:id/danfe — a DANFE em PDF, buscada no fornecedor sob demanda
// (spec §10). A API da Brasil NFe não devolve URL; e a DANFE não é guardada: o documento legal é
// o XML (fiscal_documento.xml_autorizado). A DANFE é só a representação impressa dele.
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const id = String(req.params.id ?? "")

  if (!ehUuidValido(id)) {
    return res.status(400).json({ error: "id precisa ser um uuid válido." })
  }

  try {
    let doc
    try {
      doc = await lerDocumento(id)
    } catch (e) {
      if (/não encontrado/i.test((e as Error).message)) {
        throw new ErroFiscal(`Documento fiscal ${id} não encontrado.`)
      }
      throw e
    }
    if (!doc.chave_acesso) {
      throw new ErroFiscal("Esta nota não foi autorizada — não existe DANFE para baixar.")
    }

    const pdf = await baixarArquivo(doc.chave_acesso, "danfe")
    res.setHeader("Content-Type", "application/pdf")
    res.setHeader("Content-Disposition", `inline; filename="danfe-${doc.chave_acesso}.pdf"`)
    return res.status(200).send(pdf)
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] danfe ${id}: ${erro.message}`)
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
