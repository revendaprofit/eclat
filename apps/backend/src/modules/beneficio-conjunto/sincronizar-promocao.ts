import { Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow, updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { ATRIBUTO, CODIGO_PREFIXO, MARCA_LIVRE, REGRA_EXCLUSAO, codigoDaRegra, nUnidadesDaRegra, payloadPromocao } from "./utils/promocao"
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

// Cupom nunca alcança unidade em conjunto (spec §6.4, F0 D/D2/D3): cupom de PEDIDO vira cupom de ITENS
// (`across`, sem max_quantity) e todo cupom não-conjunto ganha a regra-alvo `items.conjunto_desconto eq
// nenhum`. Usa o serviço do módulo PROMOTION diretamente (não o workflow) para não reentrar nos ganchos
// promotionsCreated/promotionsUpdated com a própria escrita desta função (idempotência sem StepResponse
// extra) — ver `updatePromotions`/`addPromotionTargetRules` em node_modules/@medusajs/promotion, que
// não disparam createPromotionsWorkflow/updatePromotionsWorkflow.
export async function converterCupom(container: MedusaContainer, promotionId: string): Promise<"convertido" | "ja_ok" | "ignorado"> {
  const promo: any = container.resolve(Modules.PROMOTION)
  const p = await promo
    .retrievePromotion(promotionId, { relations: ["application_method", "application_method.target_rules", "application_method.target_rules.values"] })
    .catch(() => null)
  if (!p?.code || p.code.startsWith(CODIGO_PREFIXO) || !p.application_method) return "ignorado"

  let mudou = false

  // `buyget` não tem o conceito de cupom "de pedido" (a mecânica é comprar X, ganhar Y) — a conversão
  // order→items não se aplica; a regra de exclusão abaixo é adicionada de qualquer forma.
  if (p.type !== "buyget" && p.application_method.target_type === "order") {
    await promo.updatePromotions([
      {
        id: p.id,
        application_method: { id: p.application_method.id, target_type: "items", allocation: "across", max_quantity: null },
      },
    ])
    mudou = true
  }

  const temExclusao = (p.application_method.target_rules ?? []).some(
    (r: any) => r.attribute === ATRIBUTO && r.operator === "eq" && (r.values ?? []).some((v: any) => (v.value ?? v) === MARCA_LIVRE)
  )
  if (!temExclusao) {
    await promo.addPromotionTargetRules(p.id, [{ attribute: REGRA_EXCLUSAO.attribute, operator: REGRA_EXCLUSAO.operator, values: [...REGRA_EXCLUSAO.values] }])
    mudou = true
  }

  return mudou ? "convertido" : "ja_ok"
}

// Varre todas as promoções (paginado) convertendo cupons que ainda não passaram pelo gancho (ex.:
// promoções criadas antes deste código existir, ou por script/seed). Usado por `reconciliar`.
export async function converterTodosCupons(container: MedusaContainer): Promise<number> {
  const promo: any = container.resolve(Modules.PROMOTION)
  const take = 100
  let skip = 0
  let convertidas = 0
  while (true) {
    const pagina = await promo.listPromotions({}, { take, skip })
    if (!pagina.length) break
    for (const p of pagina) {
      const resultado = await converterCupom(container, p.id)
      if (resultado === "convertido") convertidas++
    }
    if (pagina.length < take) break
    skip += take
  }
  return convertidas
}

// Reconciliação completa (regras → promoções automáticas do conjunto; cupons → conversão): usada por
// job/rota de manutenção para corrigir divergências sem depender só dos ganchos.
export async function reconciliar(container: MedusaContainer): Promise<{ regras: number; cupons: number }> {
  return { regras: await sincronizarTodas(container), cupons: await converterTodosCupons(container) }
}
