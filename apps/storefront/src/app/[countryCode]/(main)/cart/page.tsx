import { retrieveCart } from "@lib/data/cart"
import { getCarrinhoConjunto } from "@lib/data/conjuntos"
import { getRegrasDeFrete } from "@lib/data/frete"
import { getPresenteDaSacola } from "@lib/data/brinde"
import { retrieveCustomer } from "@lib/data/customer"
import { etiquetasDoCarrinho } from "@lib/util/carrinho-conjunto"
import CartTemplate from "@modules/cart/templates"
import { Metadata } from "next"
import { notFound } from "next/navigation"

export const metadata: Metadata = {
  title: "Sua sacola",
  // É o texto que aparece no link da sacola mandado pelo WhatsApp (recuperação de carrinho).
  description: "Suas peças estão guardadas aqui. Finalize quando quiser.",
}

export default async function Cart({ params }: { params: Promise<{ countryCode: string }> }) {
  const { countryCode } = await params
  // Não depende de cart/customer/conjuntos: dispara já, aguarda só no fim (achado da revisão do Task 12).
  const regrasDeFretePromise = getRegrasDeFrete()
  const cart = await retrieveCart().catch((error) => {
    console.error(error)
    return notFound()
  })

  const customer = await retrieveCustomer()
  const { conjuntos, gatilhos } = cart ? await getCarrinhoConjunto(cart.id, countryCode) : { conjuntos: [], gatilhos: [] }
  const etiquetas = etiquetasDoCarrinho(conjuntos, cart?.items ?? [])
  const regrasDeFrete = await regrasDeFretePromise
  const presente = await getPresenteDaSacola(cart)

  return (
    <CartTemplate
      cart={cart}
      customer={customer}
      etiquetas={etiquetas}
      gatilhos={gatilhos}
      countryCode={countryCode}
      regrasDeFrete={regrasDeFrete}
      presente={presente}
    />
  )
}
