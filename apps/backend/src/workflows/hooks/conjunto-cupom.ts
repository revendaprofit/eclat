import { createPromotionsWorkflow, updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { converterCupom } from "../../modules/beneficio-conjunto/sincronizar-promocao"

// Toda promoção criada/editada pela Admin API (Cockpit, admin do Medusa) passa aqui (spec §6.4, F0
// D/D2/D3): cupom nunca alcança unidade em conjunto. Idempotente — `converterCupom` usa o serviço do
// módulo PROMOTION diretamente, então esta própria escrita não reentra em `promotionsUpdated`.
// Promoções CONJUNTO-* (automáticas do próprio módulo) são ignoradas; erro só loga, a promoção existe
// de qualquer forma (carrinho/checkout melhor com cupom "errado" do que com Admin API quebrada).
async function converter(promotions: { id: string }[], container: any) {
  for (const p of promotions) {
    try {
      await converterCupom(container, p.id)
    } catch (e) {
      console.error("[conjunto] conversão de cupom", p.id, e)
    }
  }
}

createPromotionsWorkflow.hooks.promotionsCreated(async ({ promotions }, { container }) => {
  await converter(promotions as any[], container)
  return new StepResponse(undefined)
})

updatePromotionsWorkflow.hooks.promotionsUpdated(async ({ promotions }, { container }) => {
  await converter(promotions as any[], container)
  return new StepResponse(undefined)
})
