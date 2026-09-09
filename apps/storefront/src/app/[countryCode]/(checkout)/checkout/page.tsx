import { retrieveCart } from "@lib/data/cart"
import { retrieveCustomer } from "@lib/data/customer"
import { getCarrinhoConjunto } from "@lib/data/conjuntos"
import { etiquetasDoCarrinho } from "@lib/util/carrinho-conjunto"
import PaymentWrapper from "@modules/checkout/components/payment-wrapper"
import CheckoutForm from "@modules/checkout/templates/checkout-form"
import CheckoutSummary from "@modules/checkout/templates/checkout-summary"
import { Metadata } from "next"
import { notFound } from "next/navigation"
import Track from "@modules/analytics/track"
import { cartToBeginCheckout } from "@modules/analytics/items"

export const metadata: Metadata = {
  title: "Finalizar compra",
}

export default async function Checkout({
  params,
}: {
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await params
  const cart = await retrieveCart()

  if (!cart) {
    return notFound()
  }

  const customer = await retrieveCustomer()
  const { conjuntos } = await getCarrinhoConjunto(cart.id, countryCode, {
    comGatilhos: false,
  })
  const etiquetas = etiquetasDoCarrinho(conjuntos, cart.items ?? [])

  return (
    <div className="grid grid-cols-1 small:grid-cols-[1fr_416px] content-container gap-x-40 py-12">
      <Track event="begin_checkout" ecommerce={cartToBeginCheckout(cart)} />
      <PaymentWrapper cart={cart}>
        <CheckoutForm cart={cart} customer={customer} />
      </PaymentWrapper>
      <CheckoutSummary cart={cart} etiquetas={etiquetas} />
    </div>
  )
}
