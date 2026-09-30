import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { carrinhoDoPresente, configDaLoja, presentesUsados } from "../../lib/brinde"
import { avaliarCarrinho } from "../../modules/brinde/regra"

// Presente por faixa, barreira DIANTEIRA (mesmo motivo do pedido mínimo: o fechamento valida o pagamento antes
// do gancho `validate`). Recusa criar a cobrança de carrinho com presente fora da regra — abaixo da faixa, em dobro,
// com quantidade mexida pela API padrão, esgotado. A vitrine tira o presente inválido antes de chegar aqui.
export async function exigirPresenteValido(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const cartId = (req.body as { cart_id?: string } | undefined)?.cart_id
    if (!cartId) return next()
    const carrinho = await carrinhoDoPresente(req.scope, cartId)
    if (!carrinho) return next()
    const config = await configDaLoja()
    const avaliacao = avaliarCarrinho(carrinho.itens, carrinho.base, config, await presentesUsados(req.scope, config))
    if (avaliacao.ok) return next()
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, avaliacao.motivo))
  } catch (e) {
    // Falha de consulta não derruba o checkout: o gancho do fechamento é a segunda tranca.
    console.error("[brinde] middleware", e)
    return next()
  }
}
