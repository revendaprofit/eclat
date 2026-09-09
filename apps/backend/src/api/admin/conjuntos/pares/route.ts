import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import type { z } from "zod"
import { BENEFICIO_CONJUNTO_MODULE } from "../../../../modules/beneficio-conjunto"
import type { Par } from "../../../../modules/beneficio-conjunto/utils/tipos"
import { AtualizarParesSchema } from "../../../middlewares"

type AtualizarParesBody = z.infer<typeof AtualizarParesSchema>

const chave = (a: string, b: string) => `${a}::${b}`

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  res.json({ pares: await svc.listConjuntoPars({}) })
}

// Substitui a lista inteira (spec): normaliza cada par (a < b), remove duplicatas do body, cria
// os que faltam, atualiza `ativo` dos existentes e apaga (soft delete) os que não vieram no body.
export const PUT = async (req: AuthenticatedMedusaRequest<AtualizarParesBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const body = req.validatedBody

  const normalizados = new Map<string, { categoria_a: string; categoria_b: string; ativo: boolean }>()
  for (const p of body.pares) {
    if (p.categoria_a === p.categoria_b) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um par precisa de duas categorias diferentes.")
    const [categoria_a, categoria_b] = [p.categoria_a, p.categoria_b].sort()
    const k = chave(categoria_a, categoria_b)
    // Duplicata no body (mesmo par repetido, ordem qualquer): a última entrada decide `ativo`.
    normalizados.set(k, { categoria_a, categoria_b, ativo: p.ativo ?? true })
  }

  const existentes = (await svc.listConjuntoPars({})) as Par[]
  const existentesPorChave = new Map(existentes.map((e) => [chave(e.categoria_a, e.categoria_b), e]))

  for (const [k, novo] of normalizados) {
    const existente = existentesPorChave.get(k)
    if (!existente) {
      await svc.createConjuntoPars(novo)
    } else if (existente.ativo !== novo.ativo) {
      await svc.updateConjuntoPars({ id: existente.id, ativo: novo.ativo })
    }
  }

  const paraApagar = existentes.filter((e) => !normalizados.has(chave(e.categoria_a, e.categoria_b)))
  if (paraApagar.length) await svc.deleteConjuntoPars(paraApagar.map((e) => e.id))

  res.json({ pares: await svc.listConjuntoPars({}) })
}
