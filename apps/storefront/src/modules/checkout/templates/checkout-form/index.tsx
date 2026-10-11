import { listCartShippingMethods } from "@lib/data/fulfillment"
import { listCartPaymentMethods } from "@lib/data/payment"
import { getCondicoes } from "@lib/data/condicoes"
import { isMercadoPago } from "@lib/util/pagamento-mercadopago"
import { HttpTypes } from "@medusajs/types"
import Addresses from "@modules/checkout/components/addresses"
import Contato from "@modules/checkout/components/contato"
import Payment from "@modules/checkout/components/payment"
import Review from "@modules/checkout/components/review"
import Shipping from "@modules/checkout/components/shipping"
import Presente from "@modules/cart/components/presente"
import PresentePopup from "@modules/cart/components/presente-popup"
import type { DadosDoPresente } from "@lib/data/brinde"

export default async function CheckoutForm({
  cart,
  customer,
  presente,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  presente?: DadosDoPresente
}) {
  if (!cart) {
    return null
  }

  const shippingMethods = await listCartShippingMethods(cart.id)
  const [paymentMethods, condicoes] = await Promise.all([
    listCartPaymentMethods(cart.region?.id ?? ""),
    getCondicoes(),
  ])

  if (!shippingMethods || !paymentMethods) {
    return null
  }

  return (
    <div className="w-full grid grid-cols-1 gap-y-8">
      {presente && (
        <>
          <Presente estado={presente.estado} opcoes={presente.opcoes} aviso={presente.aviso} moeda={cart.currency_code} destaque />
          <PresentePopup estado={presente.estado} opcoes={presente.opcoes} cartId={cart.id} />
        </>
      )}
      <Contato cart={cart} customer={customer} />

      <Addresses cart={cart} customer={customer} />

      <Shipping cart={cart} availableShippingMethods={shippingMethods} />

      <Payment cart={cart} availablePaymentMethods={paymentMethods} condicoes={condicoes} presente={presente} />

      <Review
        cart={cart}
        mercadoPagoDisponivel={paymentMethods.some((p) => isMercadoPago(p.id))}
      />
    </div>
  )
}
