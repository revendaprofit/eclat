"use client"

import { conferirPagamento, pagarComCartao } from "@lib/data/pagamento-mercadopago"
import { normalizarCpf } from "@lib/util/cpf"
import { deviceIdDoMercadoPago } from "@lib/util/device-id-mercadopago"
import { HttpTypes } from "@medusajs/types"
import { CardPayment, initMercadoPago } from "@mercadopago/sdk-react"
import { Text } from "@modules/common/components/ui"
import { useEffect, useMemo, useRef, useState } from "react"
import ErrorMessage from "../error-message"

const CHAVE_PUBLICA = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY
const MAX_PARCELAS = Number(process.env.NEXT_PUBLIC_MERCADOPAGO_MAX_PARCELAS) || 4
const INTERVALO_DA_CONSULTA_MS = 5000

let sdkIniciado = false

/**
 * Cartão de crédito pelo Card Payment Brick (spec §5). O número do cartão nunca passa pelo nosso
 * servidor (Invariante 4): o Brick tokeniza no navegador e só o token de uso único segue adiante.
 */
const CartaoMercadoPago = ({ cart }: { cart: HttpTypes.StoreCart }) => {
  const [erro, setErro] = useState<string | null>(null)
  const [emAnalise, setEmAnalise] = useState(false)
  const [pronto, setPronto] = useState(false)
  const consultando = useRef(false)

  if (!sdkIniciado && CHAVE_PUBLICA) {
    initMercadoPago(CHAVE_PUBLICA, { locale: "pt-BR" })
    sdkIniciado = true
  }

  // O Brick remonta (e perde o que foi digitado) se `initialization` mudar de identidade — por
  // isso tudo aqui é memorizado pelo que realmente importa: valor, e-mail e CPF.
  const cpf = normalizarCpf(String(cart.metadata?.cpf ?? ""))
  const initialization = useMemo(
    () => ({
      amount: Number(cart.total),
      payer: { email: cart.email ?? undefined, ...(cpf ? { identification: { type: "CPF", number: cpf } } : {}) },
    }),
    [cart.total, cart.email, cpf]
  )
  const customization = useMemo(
    () => ({
      paymentMethods: { minInstallments: 1, maxInstallments: MAX_PARCELAS, types: { excluded: ["debit_card" as const, "prepaid_card" as const] } },
      visual: {
        hideFormTitle: true,
        texts: { formSubmit: "Finalizar pedido" },
        style: {
          theme: "default",
          customVariables: {
            baseColor: "#7A3B2C", // eclat-terracota
            baseColorFirstVariant: "#9C5238",
            baseColorSecondVariant: "#5E2C20",
            textPrimaryColor: "#2B2A28",
            outlinePrimaryColor: "#C9BFAE",
            formBackgroundColor: "#FFFFFF",
            borderRadiusMedium: "8px",
            borderRadiusLarge: "8px",
            formPadding: "0px",
          },
        },
      },
    }),
    []
  )

  // Pagamento em análise no Mercado Pago: consulta até virar pedido (mesma rotina do Pix).
  useEffect(() => {
    if (!emAnalise) return
    let ativo = true
    let id: ReturnType<typeof setTimeout>
    const consultar = async () => {
      if (!ativo || consultando.current) return
      consultando.current = true
      try {
        await conferirPagamento()
      } catch {
        // tenta de novo na próxima volta
      } finally {
        consultando.current = false
        if (ativo) id = setTimeout(consultar, INTERVALO_DA_CONSULTA_MS)
      }
    }
    id = setTimeout(consultar, INTERVALO_DA_CONSULTA_MS)
    return () => {
      ativo = false
      clearTimeout(id)
    }
  }, [emAnalise])

  if (!CHAVE_PUBLICA) return null

  if (emAnalise) {
    return (
      <div className="bg-eclat-blush-claro rounded-rounded px-4 py-3" role="status" aria-live="polite" data-testid="cartao-em-analise">
        <Text className="txt-medium text-eclat-grafite">
          Estamos confirmando seu pagamento com o banco. Isso costuma levar poucos minutos — pode
          deixar esta página aberta, que o pedido aparece aqui assim que for aprovado.
        </Text>
      </div>
    )
  }

  return (
    <div data-testid="cartao-mercadopago">
      {!pronto && <Text className="txt-medium text-ui-fg-subtle mb-2">Carregando o formulário seguro do cartão…</Text>}
      <ErrorMessage error={erro} data-testid="cartao-erro" />
      <CardPayment
        initialization={initialization}
        customization={customization}
        locale="pt-BR"
        onReady={() => setPronto(true)}
        onError={() => setErro("O formulário do cartão não carregou direito. Atualiza a página ou paga com Pix.")}
        onSubmit={async (dados, extra) => {
          setErro(null)
          const r = await pagarComCartao({
            token: dados.token,
            bandeira: dados.payment_method_id,
            parcelas: dados.installments,
            nomeTitular: extra?.cardholderName,
            finalCartao: extra?.lastFourDigits,
            deviceId: deviceIdDoMercadoPago(),
          })
          // Aprovado não volta: a ação de servidor redireciona para a confirmação do pedido.
          if (r.resultado === "pendente") return setEmAnalise(true)
          setErro(r.mensagem)
          // Rejeitar a promessa devolve o Brick ao estado editável, com um token novo na
          // próxima tentativa (o token é de uso único).
          throw new Error(r.resultado)
        }}
      />
    </div>
  )
}

export default CartaoMercadoPago
