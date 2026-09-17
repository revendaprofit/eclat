"use client"

import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import CountrySelect from "@modules/checkout/components/country-select"
import { cepValido, normalizarCep, type EnderecoCep } from "@lib/util/cep"
import { useState } from "react"

// Campos de endereço usados pelo checkout E pelo cadastro da conta.
//
// Existe um só porque endereço salvo na conta também vira nota fiscal: se os dois
// formulários divergirem, a cliente logada escolhe um endereço salvo sem número,
// bairro ou IBGE e o despacho falha — sem ela ter feito nada errado.
//
// O código IBGE nunca aparece para a cliente: ela não sabe o da própria cidade.
// Ele vem da busca de CEP e viaja num input hidden.

type AddressFieldsProps = {
  prefixo: string
  valores: Record<string, string>
  onChange: (campo: string, valor: string) => void
  countriesInRegion?: string[]
  region?: HttpTypes.StoreRegion
}

export default function AddressFields({
  prefixo,
  valores,
  onChange,
  countriesInRegion,
  region,
}: AddressFieldsProps) {
  const [buscando, setBuscando] = useState(false)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)

  const n = (campo: string) => (prefixo ? `${prefixo}.${campo}` : campo)
  const v = (campo: string) => valores[n(campo)] || ""

  async function buscarCep(bruto: string) {
    const cep = normalizarCep(bruto)
    if (!cepValido(cep)) return

    setBuscando(true)
    setAvisoCep(null)
    try {
      const r = await fetch(`/api/cep/${cep}`)
      if (!r.ok) {
        const { error } = (await r.json()) as { error?: string }
        // Falha de terceiro NÃO custa a venda: avisa e libera a digitação manual.
        setAvisoCep(error || "Não foi possível buscar o CEP. Preencha manualmente.")
        return
      }
      const e = (await r.json()) as EnderecoCep
      onChange(n("address_1"), e.logradouro)
      onChange(n("metadata.bairro"), e.bairro)
      onChange(n("city"), e.cidade)
      onChange(n("province"), e.uf)
      onChange(n("metadata.municipio_ibge"), e.ibge)
    } catch {
      setAvisoCep("Não foi possível buscar o CEP. Preencha manualmente.")
    } finally {
      setBuscando(false)
    }
  }

  return (
    <div className="grid grid-cols-2 gap-4">
      <Input
        label="CEP"
        name={n("postal_code")}
        autoComplete="postal-code"
        value={v("postal_code")}
        onChange={(e) => {
          onChange(n("postal_code"), e.target.value)
          void buscarCep(e.target.value)
        }}
        required
        data-testid="input-cep"
      />
      <div className="flex items-end text-sm text-ui-fg-subtle">
        {buscando ? "Buscando endereço…" : avisoCep}
      </div>

      <Input
        label="Endereço"
        name={n("address_1")}
        autoComplete="address-line1"
        value={v("address_1")}
        onChange={(e) => onChange(n("address_1"), e.target.value)}
        required
        data-testid="input-endereco"
      />
      <Input
        label="Número"
        name={n("metadata.numero")}
        autoComplete="address-line2"
        value={v("metadata.numero")}
        onChange={(e) => onChange(n("metadata.numero"), e.target.value)}
        required
        data-testid="input-numero"
      />

      <Input
        label="Complemento"
        name={n("address_2")}
        value={v("address_2")}
        onChange={(e) => onChange(n("address_2"), e.target.value)}
        data-testid="input-complemento"
      />
      <Input
        label="Bairro"
        name={n("metadata.bairro")}
        value={v("metadata.bairro")}
        onChange={(e) => onChange(n("metadata.bairro"), e.target.value)}
        required
        data-testid="input-bairro"
      />

      <Input
        label="Cidade"
        name={n("city")}
        autoComplete="address-level2"
        value={v("city")}
        onChange={(e) => onChange(n("city"), e.target.value)}
        required
        data-testid="input-cidade"
      />
      <Input
        label="Estado"
        name={n("province")}
        autoComplete="address-level1"
        value={v("province")}
        onChange={(e) => onChange(n("province"), e.target.value)}
        required
        data-testid="input-estado"
      />

      <CountrySelect
        name={n("country_code")}
        autoComplete="country"
        region={region}
        value={v("country_code")}
        onChange={(e) => onChange(n("country_code"), e.target.value)}
        required
        data-testid="select-pais"
      />

      {/* A cliente não digita código IBGE — ele vem da busca de CEP. */}
      <input type="hidden" name={n("metadata.municipio_ibge")} value={v("metadata.municipio_ibge")} />
    </div>
  )
}
