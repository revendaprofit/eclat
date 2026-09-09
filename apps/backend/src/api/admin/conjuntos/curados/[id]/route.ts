import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deletePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { z } from "zod"
import { BENEFICIO_CONJUNTO_MODULE } from "../../../../../modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../../../../modules/beneficio-conjunto/sincronizar-promocao"
import { AtualizarCuradoSchema } from "../../../../middlewares"

type AtualizarCuradoBody = z.infer<typeof AtualizarCuradoSchema>

// `handle` é imutável (spec): o schema em middlewares.ts não o aceita neste body (modo estrito
// rejeita com 400 quem tentar mandá-lo), então a rota nunca precisa decidir se ignora ou aplica.
export const PUT = async (req: AuthenticatedMedusaRequest<AtualizarCuradoBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { id } = req.params
  const b = req.validatedBody

  const atual = await svc.retrieveConjuntoCurado(id).catch(() => null)
  if (!atual) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Conjunto curado ${id} não encontrado.`)
  const regraAtual = await svc.retrieveConjuntoRegra(atual.regra_id)

  let product_ids: string[] | undefined
  if (b.product_ids) {
    const idsUnicos = Array.from(new Set(b.product_ids))
    if (idsUnicos.length < 2) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um conjunto curado precisa de pelo menos 2 produtos distintos.")
    const { data: produtos } = await query.graph({ entity: "product", fields: ["id", "status"], filters: { id: idsUnicos } })
    if (produtos.length !== idsUnicos.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um ou mais produtos não existem.")
    const naoPublicado = produtos.find((p: any) => p.status !== "published")
    if (naoPublicado) throw new MedusaError(MedusaError.Types.INVALID_DATA, `O produto ${naoPublicado.id} não está publicado.`)
    product_ids = idsUnicos
  }

  const tipoFinal = b.tipo_desconto ?? regraAtual.tipo_desconto
  const valorFinal = b.valor ?? regraAtual.valor
  if (String(tipoFinal).endsWith("percentual") && valorFinal > 100) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Valor percentual não pode passar de 100.")
  }

  await svc.updateConjuntoCurados({
    id,
    ...(b.nome !== undefined ? { nome: b.nome } : {}),
    ...(b.capa_url !== undefined ? { capa_url: b.capa_url } : {}),
    ...(product_ids ? { product_ids } : {}),
    ...(b.ativo !== undefined ? { ativo: b.ativo } : {}),
    ...(b.ordem !== undefined ? { ordem: b.ordem } : {}),
  })

  // Regra: sincroniza tipo/valor/nome/status quando algum deles muda (spec — nome do curado e da
  // regra ficam iguais). Sempre resincroniza a promoção no fim, mesmo sem mudança na regra (barato).
  if (b.nome !== undefined || b.tipo_desconto !== undefined || b.valor !== undefined || b.ativo !== undefined) {
    await svc.updateConjuntoRegras({
      id: atual.regra_id,
      ...(b.nome !== undefined ? { nome: b.nome } : {}),
      ...(b.tipo_desconto !== undefined ? { tipo_desconto: b.tipo_desconto } : {}),
      ...(b.valor !== undefined ? { valor: b.valor } : {}),
      ...(b.ativo !== undefined ? { ativa: b.ativo } : {}),
    })
  }
  await sincronizarPromocao(req.scope, atual.regra_id)

  res.json({ curado: { ...(await svc.retrieveConjuntoCurado(id)), regra: await svc.retrieveConjuntoRegra(atual.regra_id) } })
}

// Apaga curado, regra e promoção (spec §4.4) — ORDEM (fix round 1, achado "DELETE pode deixar
// promoção órfã"): (1) promoção primeiro, (2) regra, (3) curado. Se apagar a promoção falhar por
// qualquer motivo QUE NÃO seja "ela já não existe", o erro sobe e NADA é apagado (curado e regra
// continuam de pé) — não há mais o `.catch(() => {})` genérico que engolia qualquer erro do
// workflow, incluindo falhas reais, e deixava a regra apontando para uma promoção que ninguém
// mais teria como encontrar (órfã, spec §4.4). Só o caso "não encontrada" (idempotência de quem
// já apagou a promoção por fora) é engolido, inspecionando `e.type`/mensagem do erro.
function ehErroNaoEncontrada(e: any): boolean {
  return e?.type === MedusaError.Types.NOT_FOUND || /n[ãa]o encontrad|not\s*found/i.test(String(e?.message ?? ""))
}

export const DELETE = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const { id } = req.params

  const atual = await svc.retrieveConjuntoCurado(id).catch(() => null)
  if (!atual) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Conjunto curado ${id} não encontrado.`)
  const regra = await svc.retrieveConjuntoRegra(atual.regra_id).catch(() => null)

  if (regra?.promotion_id) {
    try {
      await deletePromotionsWorkflow(req.scope).run({ input: { ids: [regra.promotion_id] } })
    } catch (e) {
      if (!ehErroNaoEncontrada(e)) throw e
    }
  }
  if (regra) await svc.deleteConjuntoRegras([regra.id])
  await svc.deleteConjuntoCurados([id])

  res.json({ id, deleted: true })
}
