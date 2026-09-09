import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { avaliarCarrinho, marcarContexto } from "../../modules/beneficio-conjunto/avaliar-carrinho"

// Benefício Conjunto (spec §6.1): marca as unidades do carrinho antes de o motor de promoções avaliar.
// Nunca lança — carrinho sem benefício é melhor que carrinho quebrado.
updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }, { container }) => {
  try {
    const items = ((cart as any)?.items ?? []) as any[]
    if (!items.length) return new StepResponse({})
    const { resultado } = await avaliarCarrinho(container, cart as any)
    return new StepResponse({ items: marcarContexto(items, resultado) })
  } catch (e) {
    console.error("[conjunto] gancho", e)
    return new StepResponse({})
  }
})
