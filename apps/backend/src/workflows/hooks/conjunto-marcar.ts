import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { Modules } from "@medusajs/framework/utils"
import { avaliarCarrinho, marcarContexto, type CupomPercentual } from "../../modules/beneficio-conjunto/avaliar-carrinho"
import { CODIGO_PREFIXO, MARCA_LIVRE } from "../../modules/beneficio-conjunto/utils/promocao"

// Benefício Conjunto (spec §6.1): marca as unidades do carrinho antes de o motor de promoções avaliar.
// Nunca lança — carrinho sem benefício é melhor que carrinho quebrado.

/**
 * Cupons PERCENTUAIS de itens aplicados (ou entrando agora) no carrinho, para a regra do maior
 * desconto por peça (decisão do dono, 2026-09-20). Fora da conta: as promoções automáticas do
 * próprio Benefício Conjunto (prefixo `CONJUNTO-`) e cupons de valor fixo — ver
 * `descontoDoCupomNaUnidade`. Falha aqui devolve lista vazia: sem comparação, valem as marcas
 * de sempre.
 */
async function cupomPercentualDoCarrinho(container: any, cart: any, promoCodes: string[]): Promise<CupomPercentual[]> {
  const codigos = [
    ...((cart?.promotions ?? []) as { code?: string | null }[]).map((p) => p?.code),
    ...(promoCodes ?? []),
  ].filter((c): c is string => !!c && !c.startsWith(CODIGO_PREFIXO))
  if (!codigos.length) return []
  try {
    const promocoes: any[] = await container.resolve(Modules.PROMOTION).listPromotions(
      { code: Array.from(new Set(codigos)) },
      { relations: ["application_method"] }
    )
    return promocoes
      .filter((p) => p?.status !== "inactive" && p?.application_method?.type === "percentage")
      .map((p) => ({ code: p.code as string, percentual: Number(p.application_method?.value) || 0 }))
      .filter((c) => c.percentual > 0)
  } catch (e) {
    console.error("[conjunto] cupons do carrinho", e)
    return []
  }
}

updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart, promo_codes }, { container }) => {
  try {
    const items = ((cart as any)?.items ?? []) as any[]
    if (!items.length) return new StepResponse({})
    const [{ resultado }, cupons] = await Promise.all([
      avaliarCarrinho(container, cart as any),
      cupomPercentualDoCarrinho(container, cart, (promo_codes ?? []) as string[]),
    ])
    return new StepResponse({ items: marcarContexto(items, resultado, cupons) })
  } catch (e) {
    // I1: um erro aqui (ex.: módulo indisponível, query graph falhando) não pode desligar os
    // cupons do carrinho inteiro. `items: {}` (StepResponse vazio) some com o atributo
    // `conjunto_desconto` do contexto — e um cupom de itens com a regra de exclusão
    // (`items.conjunto_desconto eq "nenhum"`, §6.4) passa a não achar NENHUM item elegível,
    // porque o atributo não existe em nenhuma entrada. Marcar todas as unidades como MARCA_LIVRE
    // ("nenhum") aqui degrada para "sem benefício de conjunto, cupons normais" em vez de
    // "sem benefício de conjunto E sem cupom".
    console.error("[conjunto] gancho", e)
    const items = ((cart as any)?.items ?? []) as any[]
    return new StepResponse(items.length ? { items: items.map((it) => ({ ...it, conjunto_desconto: MARCA_LIVRE })) } : {})
  }
})
