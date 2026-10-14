"use client"

import React, { useEffect, useActionState, useState } from "react"
import Input from "@modules/common/components/input"
import AccountInfo from "../account-info"
import { HttpTypes } from "@medusajs/types"
import { updateCustomer } from "@lib/data/customer"
import { aniversarioParaCampo, chaveDeAniversario, ERRO_ANIVERSARIO, mascararAniversario } from "@lib/util/aniversario"

// Programa de aniversário (sócia, 2026-10-14): a cliente guarda dia/mês na conta; no dia, ganha 10% e um presente.
const ProfileAniversario: React.FC<{ customer: HttpTypes.StoreCustomer }> = ({ customer }) => {
  const [successState, setSuccessState] = useState(false)
  const atual = aniversarioParaCampo((customer.metadata as Record<string, unknown> | null)?.aniversario)
  const [valor, setValor] = useState(atual)

  const salvar = async (_estado: Record<string, unknown>, formData: FormData) => {
    const chave = chaveDeAniversario(String(formData.get("aniversario") ?? ""))
    if (chave === undefined) return { success: false, error: ERRO_ANIVERSARIO }
    try {
      await updateCustomer({ metadata: { ...(customer.metadata ?? {}), aniversario: chave, aniversario_origem: "cadastro" } })
      return { success: true, error: null }
    } catch (error) {
      return { success: false, error: String(error) }
    }
  }

  const [state, formAction] = useActionState(salvar, { error: null as string | null, success: false })
  useEffect(() => setSuccessState(state.success), [state])

  return (
    <form action={formAction} className="w-full">
      <AccountInfo
        label="Aniversário"
        currentInfo={atual || "Não informado"}
        isSuccess={successState}
        isError={!!state.error}
        errorMessage={state.error || undefined}
        clearState={() => setSuccessState(false)}
        data-testid="account-aniversario-editor"
      >
        <div className="grid grid-cols-1 gap-y-2">
          <Input
            label="Dia e mês (ex.: 14/10)"
            name="aniversario"
            inputMode="numeric"
            value={valor}
            onChange={(e) => setValor(mascararAniversario(e.target.value))}
            data-testid="aniversario-input"
          />
          <span className="text-xs text-ui-fg-subtle">No seu dia você ganha 10% off e um presente especial da ÉCLAT. 🎂</span>
        </div>
      </AccountInfo>
    </form>
  )
}

export default ProfileAniversario
