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
import { avaliarMinimo } from "@lib/util/pedido-minimo"

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

const reais = (centavos: number, moeda: string) =>
  convertToLocale({ amount: centavos / 100, currency_code: moeda })

const Summary = ({ cart, regrasDeFrete }: SummaryProps) => {
  const href = "/checkout?step=" + getCheckoutStep(cart)
  // Pedido mínimo (R$ 150 em peças): a cliente é avisada aqui; quem recusa de verdade é o servidor.
  const minimo = avaliarMinimo(cart)
  const aviso = minimo.atingiu ? null : (
    <div
      className="rounded-base border border-eclat-terracota/30 bg-eclat-blush-claro/60 px-3 py-2.5 text-xs leading-5 text-eclat-grafite"
      data-testid="aviso-pedido-minimo"
      role="status"
    >
      Pedido mínimo de <strong>{reais(minimo.minimo, cart.currency_code)}</strong> em peças. Faltam{" "}
      <strong>{reais(minimo.falta, cart.currency_code)}</strong>.
    </div>
  )

  return (
    <>
      <NotaAtelie titulo="Resumo" data-testid="cart-summary">
        <div className="flex flex-col gap-y-5">
          <FreteGratisBarra cart={cart} regras={regrasDeFrete} />
          <DiscountCode cart={cart} />
          <CartTotals totals={cart} />
          {/* No celular o botão vive na barra fixa do rodapé (zona do polegar); aqui só no desktop. */}
          {aviso}
          {minimo.atingiu ? (
            <LocalizedClientLink href={href} data-testid="checkout-button" className="hidden small:block">
              <Button className="w-full h-12 uppercase tracking-[0.18em] text-xs">Finalizar compra</Button>
            </LocalizedClientLink>
          ) : (
            <Button
              disabled
              data-testid="checkout-button-bloqueado"
              className="hidden small:block w-full h-12 uppercase tracking-[0.18em] text-xs"
            >
              Finalizar compra
            </Button>
          )}
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
          {minimo.atingiu ? (
            <LocalizedClientLink href={href} className="flex-1" data-testid="checkout-button-mobile">
              <Button className="w-full h-12 uppercase tracking-[0.18em] text-xs">Finalizar compra</Button>
            </LocalizedClientLink>
          ) : (
            <div className="flex-1 leading-tight">
              <Button disabled className="w-full h-12 uppercase tracking-[0.18em] text-xs" data-testid="checkout-button-mobile-bloqueado">
                Finalizar compra
              </Button>
              <span className="mt-1 block text-center text-[11px] text-eclat-grafite/70">
                Faltam {reais(minimo.falta, cart.currency_code)} para o pedido mínimo
              </span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default Summary
