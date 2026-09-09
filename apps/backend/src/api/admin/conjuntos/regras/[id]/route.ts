import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { z } from "zod"
import { BENEFICIO_CONJUNTO_MODULE } from "../../../../../modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../../../../modules/beneficio-conjunto/sincronizar-promocao"
import { AtualizarRegraSchema } from "../../../../middlewares"

type AtualizarRegraBody = z.infer<typeof AtualizarRegraSchema>

// Body parcial: nunca troca `escopo`/`collection_id` (o schema estrito em middlewares.ts já
// rejeita essas chaves com 400 antes de a rota rodar). Sincroniza a promoção sempre que chamada,
// mesmo se só `nome` mudou — barato e mantém `sincronizarPromocao` como única fonte de verdade.
export const PUT = async (req: AuthenticatedMedusaRequest<AtualizarRegraBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const { id } = req.params

  const atual = await svc.retrieveConjuntoRegra(id).catch(() => null)
  if (!atual) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Regra ${id} não encontrada.`)

  const b = req.validatedBody
  const tipoFinal = b.tipo_desconto ?? atual.tipo_desconto
  const valorFinal = b.valor ?? atual.valor
  if (String(tipoFinal).endsWith("percentual") && valorFinal > 100) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Valor percentual não pode passar de 100.")
  }

  await svc.updateConjuntoRegras({ id, ...b })
  await sincronizarPromocao(req.scope, id)
  res.json({ regra: await svc.retrieveConjuntoRegra(id) })
}
