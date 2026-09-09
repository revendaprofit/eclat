import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { avaliarCarrinho, marcarContexto } from "../../modules/beneficio-conjunto/avaliar-carrinho"
import { MARCA_LIVRE } from "../../modules/beneficio-conjunto/utils/promocao"

// Benefício Conjunto (spec §6.1): marca as unidades do carrinho antes de o motor de promoções avaliar.
// Nunca lança — carrinho sem benefício é melhor que carrinho quebrado.
updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }, { container }) => {
  try {
    const items = ((cart as any)?.items ?? []) as any[]
    if (!items.length) return new StepResponse({})
    const { resultado } = await avaliarCarrinho(container, cart as any)
    return new StepResponse({ items: marcarContexto(items, resultado) })
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
