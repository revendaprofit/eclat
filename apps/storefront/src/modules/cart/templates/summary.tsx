"use client"

import { Button, Heading } from "@modules/common/components/ui"

import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import FreteGratisBarra from "@modules/cart/components/frete-gratis-barra"
import { HttpTypes } from "@medusajs/types"
import type { RegrasDeFrete } from "@lib/util/frete"

type SummaryProps = {
  cart: HttpTypes.StoreCart
  regrasDeFrete: RegrasDeFrete | null
}

function getCheckoutStep(cart: HttpTypes.StoreCart) {
  if (!cart?.shipping_address?.address_1 || !cart.email) {
    return "address"
  } else if (cart?.shipping_methods?.length === 0) {
    return "delivery"
  } else {
    return "payment"
  }
}

const Summary = ({ cart, regrasDeFrete }: SummaryProps) => {
  const step = getCheckoutStep(cart)

  return (
    <div className="flex flex-col gap-y-4">
      <Heading level="h2" className="text-[2rem] leading-[2.75rem]">
        Resumo
      </Heading>
      <FreteGratisBarra cart={cart} regras={regrasDeFrete} />
      <DiscountCode cart={cart} />
      <Divider />
      <CartTotals totals={cart} />
      <LocalizedClientLink
        href={"/checkout?step=" + step}
        data-testid="checkout-button"
      >
        <Button className="w-full h-10">Finalizar compra</Button>
      </LocalizedClientLink>
    </div>
  )
}

export default Summary
