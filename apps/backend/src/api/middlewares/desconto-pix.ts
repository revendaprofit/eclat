import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cartaoComDescontoPix, MENSAGEM_CARTAO_COM_PIX } from "../../modules/desconto-pix/regra"

// Desconto do Pix, barreira de segurança: recusa criar sessão de pagamento de CARTÃO quando o
// carrinho ainda tem o código do Pix (PIX5). A vitrine tira o código ao escolher cartão; isto só
// pega o caminho torto (aba antiga, API direta, cupom digitado à mão) — sem isso daria para pagar
// no cartão com o desconto do Pix. Rota: POST /store/payment-collections/:id/payment-sessions,
// body { provider_id, data: { metodo: "pix" | "cartao" } } (lib/data/pagamento-mercadopago.ts).
export async function recusarCartaoComDescontoPix(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const metodo = (req.body as { data?: { metodo?: unknown } } | undefined)?.data?.metodo
    if (metodo !== "cartao") return next()
    const collectionId = (req.params as { id?: string } | undefined)?.id
    if (!collectionId) return next()
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "payment_collection",
      fields: ["id", "cart.id", "cart.promotions.code"],
      filters: { id: collectionId },
    })
    const codigos = ((data?.[0] as any)?.cart?.promotions ?? []).map((p: { code?: string | null }) => p?.code)
    if (!cartaoComDescontoPix(metodo, codigos)) return next()
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, MENSAGEM_CARTAO_COM_PIX))
  } catch (e) {
    // Falha de consulta não derruba o checkout: a vitrine já tira o código antes do cartão.
    console.error("[desconto-pix] middleware", e)
    return next()
  }
}
