"use client"

import { Heading, Text, clx } from "@modules/common/components/ui"

import PaymentButton from "../payment-button"
import PagamentoMercadoPago from "../pagamento-mercadopago"
import { ehMetodoMercadoPago } from "@lib/util/pagamento-mercadopago"
import { useSearchParams } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

const Review = ({
  cart,
  mercadoPagoDisponivel = false,
}: {
  cart: HttpTypes.StoreCart
  mercadoPagoDisponivel?: boolean
}) => {
  const searchParams = useSearchParams()

  const isOpen = searchParams.get("step") === "review"

  // Meio do Mercado Pago escolhido na etapa anterior (vem na URL: nenhuma sessão de pagamento
  // existe até a cliente gerar o Pix ou enviar o cartão — ver @lib/util/pagamento-mercadopago).
  const metodoParam = searchParams.get("metodo")
  const metodoMercadoPago =
    mercadoPagoDisponivel && ehMetodoMercadoPago(metodoParam) ? metodoParam : null

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const previousStepsCompleted =
    cart.shipping_address &&
    (cart.shipping_methods?.length ?? 0) > 0 &&
    (cart.payment_collection || paidByGiftcard || metodoMercadoPago)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none": !isOpen,
            }
          )}
        >
          Revisão
        </Heading>
      </div>
      {isOpen && previousStepsCompleted && (
        <>
          <div className="flex items-start gap-x-1 w-full mb-6">
            <div className="w-full">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Ao clicar em {metodoMercadoPago === "pix" ? "Gerar código Pix" : "Finalizar pedido"}, você confirma que leu, entendeu
                e aceita nossos Termos de Uso, Termos de Venda e Política de
                Trocas, e reconhece que leu a Política de Privacidade da
                use.ÉCLAT.
              </Text>
            </div>
          </div>
          {metodoMercadoPago ? (
            <PagamentoMercadoPago cart={cart} metodo={metodoMercadoPago} />
          ) : (
            <PaymentButton cart={cart} data-testid="submit-order-button" />
          )}
        </>
      )}
    </div>
  )
}

export default Review
