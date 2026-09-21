import { MedusaError } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recusaPorCupomDePrimeiraCompra } from "../../modules/cupom-primeira-compra/checar"

// Cupom de primeira compra: recusa criar a cobrança quando o CPF já usou um. É a ÚNICA barreira
// (ver modules/cupom-primeira-compra/checar.ts): fica antes de qualquer pagamento, e é o primeiro
// ponto em que o CPF já existe no carrinho (vem do passo de endereço).
export async function exigirCupomPrimeiraCompraLivre(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const cartId = (req.body as { cart_id?: string } | undefined)?.cart_id
    if (!cartId) return next()
    const recusa = await recusaPorCupomDePrimeiraCompra(req.scope, cartId)
    return recusa ? next(new MedusaError(MedusaError.Types.NOT_ALLOWED, recusa)) : next()
  } catch (e) {
    // Falha na consulta não pode travar venda: segue sem a trava.
    console.error("[cupom-primeira-compra] middleware", e)
    return next()
  }
}
