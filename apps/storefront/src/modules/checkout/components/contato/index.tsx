"use client"

import { salvarContato } from "@lib/data/cart"
import { mascararCelular } from "@lib/util/boas-vindas"
import { CheckCircleSolid } from "@medusajs/icons"
import { HttpTypes } from "@medusajs/types"
import Divider from "@modules/common/components/divider"
import Input from "@modules/common/components/input"
import { Heading, Text } from "@modules/common/components/ui"
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation"
import { useActionState, useState } from "react"
import ErrorMessage from "../error-message"
import { SubmitButton } from "../submit-button"

// 1º passo do checkout (diagnóstico de 2026-09-25): só WhatsApp + e-mail. Gravados no carrinho ao
// continuar, antes de endereço e CPF — quem desiste depois ainda pode ser chamada pelo Cockpit.
// Abre quando `step=contato` ou quando o carrinho ainda não tem e-mail (link antigo sem step).
export default function Contato({
  cart,
  customer,
}: {
  cart: HttpTypes.StoreCart
  customer: HttpTypes.StoreCustomer | null
}) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const { countryCode } = useParams() as { countryCode?: string }
  const step = searchParams.get("step")
  const isOpen = step === "contato" || !cart.email

  const meta = (cart.metadata ?? {}) as Record<string, unknown>
  const [whatsapp, setWhatsapp] = useState(mascararCelular(String(meta.whatsapp ?? customer?.phone ?? "")))
  const [email, setEmail] = useState(cart.email || customer?.email || "")
  const [message, formAction] = useActionState(salvarContato, null)

  return (
    <div className="bg-white">
      <div className="flex flex-row items-center justify-between mb-6">
        <Heading level="h2" className="flex flex-row text-3xl-regular gap-x-2 items-baseline">
          Seus dados de contato
          {!isOpen && <CheckCircleSolid />}
        </Heading>
        {!isOpen && (
          <Text>
            <button
              onClick={() => router.push(pathname + "?step=contato")}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
              data-testid="edit-contato-button"
            >
              Editar
            </button>
          </Text>
        )}
      </div>
      {isOpen ? (
        <form action={formAction} className="flex flex-col gap-y-4" data-testid="contato-form">
          <input type="hidden" name="country_code" value={countryCode ?? "br"} />
          <p className="text-sm text-ui-fg-subtle">
            É por aqui que avisamos da confirmação do pedido e do envio.
          </p>
          <Input
            label="WhatsApp (com DDD)"
            name="whatsapp"
            type="tel"
            inputMode="numeric"
            autoComplete="tel-national"
            value={whatsapp}
            onChange={(e) => setWhatsapp(mascararCelular(e.target.value))}
            required
            data-testid="contato-whatsapp-input"
          />
          <Input
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            data-testid="contato-email-input"
          />
          <SubmitButton className="mt-2" data-testid="submit-contato-button">
            Continuar para o endereço
          </SubmitButton>
          <ErrorMessage error={message} data-testid="contato-error-message" />
        </form>
      ) : (
        <div className="text-small-regular flex flex-col" data-testid="contato-summary">
          <Text className="txt-medium text-ui-fg-subtle">{mascararCelular(String(meta.whatsapp ?? ""))}</Text>
          <Text className="txt-medium text-ui-fg-subtle break-all">{cart.email}</Text>
        </div>
      )}
      <Divider className="mt-8" />
    </div>
  )
}
