"use client"

import { MetodoMercadoPago } from "@lib/util/pagamento-mercadopago"
import { HttpTypes } from "@medusajs/types"
import dynamic from "next/dynamic"
import PixMercadoPago from "./pix"

// O SDK dos Bricks mexe em `window` ao carregar — só no navegador, e só quando a cliente escolhe cartão.
const CartaoMercadoPago = dynamic(() => import("./cartao"), { ssr: false })

/**
 * Último passo do checkout para os meios do Mercado Pago: aqui a cobrança é de fato criada —
 * "Gerar código Pix" ou o "Finalizar pedido" do formulário do cartão (spec §5–§6).
 */
const PagamentoMercadoPago = ({ cart, metodo }: { cart: HttpTypes.StoreCart; metodo: MetodoMercadoPago }) => {
  const faltaAlgo =
    !cart.shipping_address || !cart.billing_address || !cart.email || (cart.shipping_methods?.length ?? 0) < 1

  if (metodo === "pix") return <PixMercadoPago cart={cart} bloqueado={faltaAlgo} />
  if (faltaAlgo) return null
  return <CartaoMercadoPago cart={cart} />
}

export default PagamentoMercadoPago
