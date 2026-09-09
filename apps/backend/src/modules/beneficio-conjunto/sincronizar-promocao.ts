import { Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow, updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { codigoDaRegra, nUnidadesDaRegra, payloadPromocao } from "./utils/promocao"
import type { Curado, Regra } from "./utils/tipos"

// Garante que a regra tem UMA promoção automática coerente (spec §6.2, ruling 6): cria se não existe
// (ou se foi apagada à mão), atualiza tipo/valor/status se existe. A regra-alvo (eq regra_id) nunca muda.
export async function sincronizarPromocao(container: MedusaContainer, regraId: string): Promise<{ promotion_id: string }> {
  // Nota (fallback registrado, mesmo motivo do service.ts): listConjuntoCurados diverge do tipo
  // gerado (@medusajs/types Pluralize infere "ConjuntoCuradoes"); acesso via `any` evita TS2551.
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const promo: any = container.resolve(Modules.PROMOTION)
  const regra = (await svc.retrieveConjuntoRegra(regraId)) as Regra
  const curados = (await svc.listConjuntoCurados({ regra_id: regraId })) as Curado[]
  const payload = payloadPromocao(regra, nUnidadesDaRegra(regra, curados))

  let existente: any = null
  if (regra.promotion_id) existente = await promo.retrievePromotion(regra.promotion_id, { relations: ["application_method"] }).catch(() => null)
  if (!existente) {
    const [porCodigo] = await promo.listPromotions({ code: codigoDaRegra(regra.id) }, { relations: ["application_method"] })
    existente = porCodigo ?? null
  }
  if (!existente) {
    const { result } = await createPromotionsWorkflow(container).run({ input: { promotionsData: [payload] } })
    const criada = result[0]
    await svc.updateConjuntoRegras({ id: regra.id, promotion_id: criada.id })
    return { promotion_id: criada.id }
  }
  await updatePromotionsWorkflow(container).run({
    input: {
      promotionsData: [
        {
          id: existente.id,
          status: payload.status,
          application_method: {
            type: payload.application_method.type,
            value: payload.application_method.value,
            allocation: "each",
            max_quantity: payload.application_method.max_quantity,
            target_type: "items",
            currency_code: "brl",
          },
        },
      ],
    },
  })
  if (regra.promotion_id !== existente.id) await svc.updateConjuntoRegras({ id: regra.id, promotion_id: existente.id })
  return { promotion_id: existente.id }
}

export async function sincronizarTodas(container: MedusaContainer): Promise<number> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const regras = (await svc.listConjuntoRegras({})) as Regra[]
  for (const r of regras) await sincronizarPromocao(container, r.id)
  return regras.length
}
