import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { avaliarMinimo, mensagemDoMinimo } from "../../modules/pedido-minimo/regra"

// Pedido mínimo, barreira DIANTEIRA: recusa criar a cobrança de um carrinho abaixo do mínimo.
//
// Por que aqui e não só no fechamento: no `completeCartWorkflow` o Medusa valida o PAGAMENTO
// antes de rodar o gancho `validate` — ou seja, um carrinho furado pela API chegaria a ter Pix
// pago e só então seria recusado, com dinheiro na conta e sem pedido. Bloquear na criação da
// cobrança evita essa situação; o gancho do fechamento continua como segunda tranca.
export async function exigirPedidoMinimo(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const cartId = (req.body as { cart_id?: string } | undefined)?.cart_id
    if (!cartId) return next()
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "items.unit_price", "items.quantity"],
      filters: { id: cartId },
    })
    const carrinho = data?.[0]
    if (!carrinho) return next() // carrinho inexistente: quem responde é a rota, não este guarda
    const avaliacao = avaliarMinimo(carrinho.items as { unit_price?: number | null; quantity?: number | null }[])
    if (avaliacao.atingiu) return next()
    return next(
      new MedusaError(MedusaError.Types.NOT_ALLOWED, mensagemDoMinimo(avaliacao.falta, avaliacao.minimo))
    )
  } catch (e) {
    // Falha ao consultar o carrinho não pode derrubar o checkout de quem está acima do mínimo:
    // segue o fluxo e o gancho do fechamento ainda barra quem estiver abaixo.
    console.error("[pedido-minimo] middleware", e)
    return next()
  }
}
