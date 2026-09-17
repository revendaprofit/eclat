"use client"
import { RadioGroup } from "@headlessui/react"
import { isManual, isStripeLike, paymentInfoMap } from "@lib/constants"
import { initiatePaymentSession } from "@lib/data/cart"
import {
  ehMetodoMercadoPago,
  isMercadoPago,
  lerOpcao,
  opcoesDePagamento,
  tituloDoMetodo,
  valorDaOpcao,
} from "@lib/util/pagamento-mercadopago"
import { CheckCircleSolid, CreditCard } from "@medusajs/icons"
import ErrorMessage from "@modules/checkout/components/error-message"
import PaymentContainer, {
  StripeCardContainer,
} from "@modules/checkout/components/payment-container"
import Divider from "@modules/common/components/divider"
import {
  Button,
  Container,
  Heading,
  Text,
  clx,
} from "@modules/common/components/ui"
import { HttpTypes } from "@medusajs/types"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useCallback, useEffect, useState } from "react"

const Payment = ({
  cart,
  availablePaymentMethods,
}: {
  cart: HttpTypes.StoreCart
  availablePaymentMethods: { id: string }[]
}) => {
  const activeSession = cart.payment_collection?.payment_sessions?.find(
    (paymentSession) => paymentSession.status === "pending"
  )

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardBrand, setCardBrand] = useState<string | null>(null)
  const [cardComplete, setCardComplete] = useState(false)
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  const isOpen = searchParams.get("step") === "payment"

  // Mercado Pago (Parte 4): um provider, dois meios. A escolha entre Pix e cartão viaja na URL
  // (`metodo=`) porque a sessão de pagamento só nasce no último passo, quando a cliente gera o
  // Pix ou envia o cartão — ver @lib/util/pagamento-mercadopago.
  const opcoes = opcoesDePagamento(
    availablePaymentMethods ?? [],
    !!process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
  )
  const mercadoPagoId = availablePaymentMethods?.find((p) => isMercadoPago(p.id))?.id
  const metodoParam = searchParams.get("metodo")
  const metodoNaUrl =
    mercadoPagoId && ehMetodoMercadoPago(metodoParam) ? metodoParam : null

  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(
    metodoNaUrl && mercadoPagoId
      ? valorDaOpcao(mercadoPagoId, metodoNaUrl)
      : activeSession?.provider_id ?? ""
  )

  const setPaymentMethod = async (method: string) => {
    setError(null)
    setSelectedPaymentMethod(method)
    if (isStripeLike(method)) {
      await initiatePaymentSession(cart, {
        provider_id: method,
      })
    }
  }

  const paidByGiftcard = !!(
    (cart as unknown as Record<string, unknown>)?.gift_cards && ((cart as unknown as Record<string, unknown>)?.gift_cards as unknown[])?.length > 0 && cart?.total === 0
  )

  const paymentReady =
    ((activeSession || metodoNaUrl) &&
      (cart?.shipping_methods?.length ?? 0) !== 0) ||
    paidByGiftcard

  const createQueryString = useCallback(
    (name: string, value: string) => {
      const params = new URLSearchParams(searchParams)
      params.set(name, value)

      return params.toString()
    },
    [searchParams]
  )

  const handleEdit = () => {
    router.push(pathname + "?" + createQueryString("step", "payment"), {
      scroll: false,
    })
  }

  const handleSubmit = async () => {
    setIsLoading(true)
    try {
      const { metodo } = lerOpcao(selectedPaymentMethod)
      if (metodo) {
        // Meio do Mercado Pago: nada é cobrado nem criado aqui — só segue para a revisão.
        const params = new URLSearchParams(searchParams)
        params.set("step", "review")
        params.set("metodo", metodo)
        return router.push(pathname + "?" + params.toString(), { scroll: false })
      }

      const shouldInputCard =
        isStripeLike(selectedPaymentMethod) && !activeSession

      const checkActiveSession =
        activeSession?.provider_id === selectedPaymentMethod

      if (!checkActiveSession) {
        await initiatePaymentSession(cart, {
          provider_id: selectedPaymentMethod,
        })
      }

      if (!shouldInputCard) {
        const params = new URLSearchParams(searchParams)
        params.set("step", "review")
        params.delete("metodo")
        return router.push(pathname + "?" + params.toString(), {
          scroll: false,
        })
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    setError(null)
  }, [isOpen])

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading
          level="h2"
          className={clx(
            "flex flex-row text-3xl-regular gap-x-2 items-baseline",
            {
              "opacity-50 pointer-events-none select-none":
                !isOpen && !paymentReady,
            }
          )}
        >
          Pagamento
          {!isOpen && paymentReady && <CheckCircleSolid />}
        </Heading>
        {!isOpen && paymentReady && (
          <Text>
            <button
              onClick={handleEdit}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-payment-button"
            >
              Editar
            </button>
          </Text>
        )}
      </div>
      <div>
        <div className={isOpen ? "block" : "hidden"}>
          {!paidByGiftcard && availablePaymentMethods?.length && (
            <>
              <RadioGroup
                value={selectedPaymentMethod}
                onChange={(value: string) => setPaymentMethod(value)}
              >
                {opcoes.map(({ valor, metodo }) => {
                  const paymentMethod = { id: valor, metodo }
                  return (
                  <div key={paymentMethod.id}>
                    {paymentMethod.metodo ? (
                      <PaymentContainer
                        paymentInfoMap={{
                          [paymentMethod.id]: {
                            title: tituloDoMetodo(paymentMethod.metodo),
                            icon: <CreditCard />,
                          },
                        }}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    ) : isStripeLike(paymentMethod.id) ? (
                      <StripeCardContainer
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                        paymentInfoMap={paymentInfoMap}
                        setCardBrand={setCardBrand}
                        setError={setError}
                        setCardComplete={setCardComplete}
                      />
                    ) : (
                      <PaymentContainer
                        paymentInfoMap={paymentInfoMap}
                        paymentProviderId={paymentMethod.id}
                        selectedPaymentOptionId={selectedPaymentMethod}
                      />
                    )}
                  </div>
                  )
                })}
              </RadioGroup>
            </>
          )}

          {paidByGiftcard && (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Forma de pagamento
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Vale-presente
              </Text>
            </div>
          )}

          <ErrorMessage
            error={error}
            data-testid="payment-method-error-message"
          />

          <Button
            size="large"
            className="mt-6"
            onClick={handleSubmit}
            isLoading={isLoading}
            disabled={
              (isStripeLike(selectedPaymentMethod) && !cardComplete) ||
              (!selectedPaymentMethod && !paidByGiftcard)
            }
            data-testid="submit-payment-button"
          >
            {!activeSession && isStripeLike(selectedPaymentMethod)
              ? " Inserir dados do cartão"
              : "Continuar para revisão"}
          </Button>
        </div>

        <div className={isOpen ? "hidden" : "block"}>
          {cart && paymentReady && metodoNaUrl ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Forma de pagamento
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {tituloDoMetodo(metodoNaUrl)}
                </Text>
              </div>
              <div className="flex flex-col w-2/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Detalhes do pagamento
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-details-summary"
                >
                  {metodoNaUrl === "pix"
                    ? "Você gera o código Pix na última etapa e paga pelo app do seu banco."
                    : "Você informa o cartão na última etapa, em formulário seguro do Mercado Pago."}
                </Text>
              </div>
            </div>
          ) : cart && paymentReady && activeSession ? (
            <div className="flex items-start gap-x-1 w-full">
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Forma de pagamento
                </Text>
                <Text
                  className="txt-medium text-ui-fg-subtle"
                  data-testid="payment-method-summary"
                >
                  {paymentInfoMap[activeSession?.provider_id]?.title ||
                    activeSession?.provider_id}
                </Text>
              </div>
              <div className="flex flex-col w-1/3">
                <Text className="txt-medium-plus text-ui-fg-base mb-1">
                  Detalhes do pagamento
                </Text>
                <div
                  className="flex gap-2 txt-medium text-ui-fg-subtle items-center"
                  data-testid="payment-details-summary"
                >
                  <Container className="flex items-center h-7 w-fit p-2 bg-ui-button-neutral-hover">
                    {paymentInfoMap[selectedPaymentMethod]?.icon || (
                      <CreditCard />
                    )}
                  </Container>
                  <Text>
                    {isStripeLike(selectedPaymentMethod) && cardBrand
                      ? cardBrand
                      : isManual(selectedPaymentMethod)
                        ? "A chave Pix chega no seu WhatsApp logo depois do pedido"
                        : "Mais uma etapa vai aparecer"}
                  </Text>
                </div>
              </div>
            </div>
          ) : paidByGiftcard ? (
            <div className="flex flex-col w-1/3">
              <Text className="txt-medium-plus text-ui-fg-base mb-1">
                Forma de pagamento
              </Text>
              <Text
                className="txt-medium text-ui-fg-subtle"
                data-testid="payment-method-summary"
              >
                Vale-presente
              </Text>
            </div>
          ) : null}
        </div>
      </div>
      <Divider className="mt-8" />
    </div>
  )
}

export default Payment
