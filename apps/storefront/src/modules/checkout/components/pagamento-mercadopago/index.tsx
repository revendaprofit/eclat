"use client"

import { MetodoMercadoPago } from "@lib/util/pagamento-mercadopago"
import { HttpTypes } from "@medusajs/types"
import { SCRIPT_SEGURANCA_MP } from "@lib/util/device-id-mercadopago"
import dynamic from "next/dynamic"
import Script from "next/script"
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

  return (
    <>
      {/* Cria `MP_DEVICE_SESSION_ID` no navegador: o antifraude do Mercado Pago usa o aparelho
          para separar compra legítima de fraude (sem isso, recusa por "alto risco"). */}
      <Script src={SCRIPT_SEGURANCA_MP} strategy="afterInteractive" data-view="checkout" />
      {metodo === "pix" ? (
        <PixMercadoPago cart={cart} bloqueado={faltaAlgo} />
      ) : faltaAlgo ? null : (
        <CartaoMercadoPago cart={cart} />
      )}
    </>
  )
}

export default PagamentoMercadoPago
