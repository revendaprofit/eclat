import ItemsTemplate from "./items"
import Summary from "./summary"
import EmptyCartMessage from "../components/empty-cart-message"
import SignInPrompt from "../components/sign-in-prompt"
import { HttpTypes } from "@medusajs/types"
import type { Gatilho } from "@lib/util/carrinho-conjunto"
import type { RegrasDeFrete } from "@lib/util/frete"
import GatilhosConjunto from "../components/gatilhos-conjunto"

const CartTemplate = ({
  cart,
  customer,
  etiquetas,
  gatilhos,
  countryCode,
  regrasDeFrete,
}: {
  cart: HttpTypes.StoreCart | null
  customer: HttpTypes.StoreCustomer | null
  etiquetas?: Record<string, string>
  gatilhos?: Gatilho[]
  countryCode: string
  regrasDeFrete?: RegrasDeFrete | null
}) => {
  return (
    // pb extra no celular: a barra fixa "Finalizar compra" não pode cobrir o fim do resumo
    <div className="pt-8 pb-32 small:py-14">
      <div className="content-container" data-testid="cart-container">
        {cart?.items?.length ? (
          <div className="grid grid-cols-1 small:grid-cols-[1fr_380px] gap-x-16 gap-y-10 items-start">
            <div className="flex flex-col gap-y-6">
              <ItemsTemplate cart={cart} etiquetas={etiquetas} />
              <GatilhosConjunto gatilhos={gatilhos ?? []} countryCode={countryCode} />
              {!customer && <SignInPrompt />}
            </div>
            {cart.region && (
              <div className="small:sticky small:top-24">
                <Summary cart={cart} regrasDeFrete={regrasDeFrete ?? null} />
              </div>
            )}
          </div>
        ) : (
          <EmptyCartMessage />
        )}
      </div>
    </div>
  )
}

export default CartTemplate
