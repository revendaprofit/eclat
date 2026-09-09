import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { z } from "zod"
import { BENEFICIO_CONJUNTO_MODULE } from "../../../../modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../../../modules/beneficio-conjunto/sincronizar-promocao"
import type { Regra } from "../../../../modules/beneficio-conjunto/utils/tipos"
import { CriarRegraSchema } from "../../../middlewares"

type CriarRegraBody = z.infer<typeof CriarRegraSchema>

// Todas as regras (inclusive inativas — quem filtra por `ativa` é o consumidor), exceto as de
// escopo `curado`: essas são geridas só através de `/admin/conjuntos/curados` (spec Task 6).
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const regras = (await svc.listConjuntoRegras({})) as Regra[]
  res.json({ regras: regras.filter((r) => r.escopo !== "curado") })
}

export const POST = async (req: AuthenticatedMedusaRequest<CriarRegraBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const b = req.validatedBody

  if (b.escopo === "padrao" && (await svc.listConjuntoRegras({ escopo: "padrao" })).length) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Já existe a regra padrão; edite-a.")
  }
  if (b.escopo === "colecao") {
    if (!b.collection_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Exceção por coleção exige collection_id.")
    const jaExiste = await svc.listConjuntoRegras({ escopo: "colecao", collection_id: b.collection_id })
    // 409 no brief da task; o mapeamento do framework (error-handler.js) só dá 409 para
    // MedusaError.Types.CONFLICT — que sobrescreve a mensagem por um texto genérico de retry.
    // Usamos DUPLICATE_ERROR (422) para manter a mensagem pt-BR, conforme decisão registrada no
    // prompt da task ("se o brief pede 409 e o framework mapeia DUPLICATE para 422, use 422").
    if (jaExiste.length) throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Esta coleção já tem uma exceção cadastrada.")
  }

  const regra = await svc.createConjuntoRegras({ ...b, collection_id: b.escopo === "colecao" ? b.collection_id : null, ativa: b.ativa ?? true })
  await sincronizarPromocao(req.scope, regra.id)
  res.json({ regra: await svc.retrieveConjuntoRegra(regra.id) })
}
