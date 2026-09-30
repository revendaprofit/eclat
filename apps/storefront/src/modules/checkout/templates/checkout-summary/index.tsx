import { Heading } from "@modules/common/components/ui"

import ItemsPreviewTemplate from "@modules/cart/templates/preview"
import DiscountCode from "@modules/checkout/components/discount-code"
import CartTotals from "@modules/common/components/cart-totals"
import Divider from "@modules/common/components/divider"
import { HttpTypes } from "@medusajs/types"
import Presente from "@modules/cart/components/presente"
import type { DadosDoPresente } from "@lib/data/brinde"

const CheckoutSummary = ({
  cart,
  etiquetas,
  presente,
}: {
  cart: HttpTypes.StoreCart
  etiquetas?: Record<string, string>
  presente?: DadosDoPresente
}) => {
  return (
    <div className="sticky top-0 flex flex-col-reverse small:flex-col gap-y-8 py-8 small:py-0 ">
      <div className="w-full bg-white flex flex-col">
        <Divider className="my-6 small:hidden" />
        <Heading
          level="h2"
          className="flex flex-row text-3xl-regular items-baseline"
        >
          Na sua sacola
        </Heading>
        <Divider className="my-6" />
        <CartTotals totals={cart} />
        <ItemsPreviewTemplate cart={cart} etiquetas={etiquetas} />
        {/* Lembrete não bloqueante: quem ganhou e ainda não escolheu pode escolher aqui. */}
        {presente && (
          <div className="mt-4">
            <Presente estado={presente.estado} opcoes={presente.opcoes} aviso={presente.aviso} moeda={cart.currency_code} />
          </div>
        )}
        <div className="my-6">
          <DiscountCode cart={cart} />
        </div>
      </div>
    </div>
  )
}

export default CheckoutSummary
