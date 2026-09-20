"use client"

import { Button } from "@modules/common/components/ui"

import CartTotals from "@modules/common/components/cart-totals"
import NotaAtelie from "@modules/common/components/nota-atelie"
import DiscountCode from "@modules/checkout/components/discount-code"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import FreteGratisBarra from "@modules/cart/components/frete-gratis-barra"
import { convertToLocale } from "@lib/util/money"
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
  const href = "/checkout?step=" + getCheckoutStep(cart)

  return (
    <>
      <NotaAtelie titulo="Resumo" data-testid="cart-summary">
        <div className="flex flex-col gap-y-5">
          <FreteGratisBarra cart={cart} regras={regrasDeFrete} />
          <DiscountCode cart={cart} />
          <CartTotals totals={cart} />
          {/* No celular o botão vive na barra fixa do rodapé (zona do polegar); aqui só no desktop. */}
          <LocalizedClientLink href={href} data-testid="checkout-button" className="hidden small:block">
            <Button className="w-full h-12 uppercase tracking-[0.18em] text-xs">Finalizar compra</Button>
          </LocalizedClientLink>
          <p className="text-xs text-eclat-grafite/55 text-center">Pix ou cartão de crédito · 7 dias para desistir, com reembolso integral</p>
        </div>
      </NotaAtelie>

      <div
        className="small:hidden fixed inset-x-0 bottom-0 z-40 border-t border-eclat-pedra/60 bg-eclat-luz/95 backdrop-blur px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)]"
        data-testid="cart-barra-fixa"
      >
        <div className="flex items-center gap-4">
          <div className="leading-tight">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-eclat-grafite/60">Total</span>
            <span className="font-serif text-2xl tabular-nums text-eclat-grafite">
              {convertToLocale({ amount: cart.total ?? 0, currency_code: cart.currency_code })}
            </span>
          </div>
          <LocalizedClientLink href={href} className="flex-1" data-testid="checkout-button-mobile">
            <Button className="w-full h-12 uppercase tracking-[0.18em] text-xs">Finalizar compra</Button>
          </LocalizedClientLink>
        </div>
      </div>
    </>
  )
}

export default Summary
