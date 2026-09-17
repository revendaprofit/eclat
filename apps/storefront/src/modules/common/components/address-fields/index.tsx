"use client"

import { HttpTypes } from "@medusajs/types"
import Input from "@modules/common/components/input"
import CountrySelect from "@modules/checkout/components/country-select"
import { cepValido, normalizarCep, type EnderecoCep } from "@lib/util/cep"
import { useEffect, useRef, useState } from "react"

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
  region?: HttpTypes.StoreRegion
}

export default function AddressFields({
  prefixo,
  valores,
  onChange,
  region,
}: AddressFieldsProps) {
  const [buscando, setBuscando] = useState(false)
  const [avisoCep, setAvisoCep] = useState<string | null>(null)
  const [avisoMunicipio, setAvisoMunicipio] = useState<string | null>(null)

  // Guarda de sequência: se a cliente corrigir o CEP antes da resposta anterior
  // voltar, ficam duas buscas em voo. Sem isto, a resposta mais lenta pode chegar
  // por último e sobrescrever os campos com os dados do CEP errado.
  const sequenciaBusca = useRef(0)

  const n = (campo: string) => (prefixo ? `${prefixo}.${campo}` : campo)
  const v = (campo: string) => valores[n(campo)] || ""
  // Com "cobrança diferente" aberto, entrega e cobrança renderizam ao mesmo tempo —
  // sem o sufixo do prefixo os data-testid ficam duplicados no DOM (achado da revisão).
  const testid = (base: string) => (prefixo ? `${base}-${prefixo.replace(/_/g, "-")}` : base)

  async function buscarCep(bruto: string) {
    const cep = normalizarCep(bruto)
    if (!cepValido(cep)) return

    const minhaBusca = ++sequenciaBusca.current

    setBuscando(true)
    setAvisoCep(null)
    try {
      const r = await fetch(`/api/cep/${cep}`)
      // Uma busca mais nova já começou: esta resposta chegou atrasada, descarta.
      if (minhaBusca !== sequenciaBusca.current) return

      if (!r.ok) {
        const { error } = (await r.json()) as { error?: string }
        if (minhaBusca !== sequenciaBusca.current) return
        // Falha de terceiro NÃO custa a venda: avisa e libera a digitação manual.
        setAvisoCep(error || "Não foi possível buscar o CEP. Preencha manualmente.")
        return
      }
      const e = (await r.json()) as EnderecoCep
      if (minhaBusca !== sequenciaBusca.current) return

      // Preenchimento vindo da própria busca: aplica direto, sem passar pelo
      // handler de edição manual que limpa o IBGE abaixo.
      onChange(n("address_1"), e.logradouro)
      onChange(n("metadata.bairro"), e.bairro)
      onChange(n("city"), e.cidade)
      onChange(n("province"), e.uf)
      onChange(n("metadata.municipio_ibge"), e.ibge)
      setAvisoMunicipio(null)
    } catch {
      if (minhaBusca !== sequenciaBusca.current) return
      setAvisoCep("Não foi possível buscar o CEP. Preencha manualmente.")
    } finally {
      if (minhaBusca === sequenciaBusca.current) setBuscando(false)
    }
  }

  // Endereço salvo (da conta, criado antes desta branch, ou escolhido de novo na
  // tela) chega com CEP preenchido mas sem metadata.municipio_ibge. A cliente não tem
  // motivo para mexer no CEP — ele já está certo — então sem isto o IBGE fica ""
  // para sempre e o pedido fecha sem emitir nota, sem ela perceber nada (o campo é
  // hidden). Dispara a busca sozinha quando o CEP é válido e falta o IBGE.
  //
  // A guarda (cepAutoBuscado) evita laço: a busca preenche o campo, o componente
  // re-renderiza, e sem ela isso disparia a busca de novo indefinidamente. No máximo
  // uma tentativa automática por CEP — se falhar, fica silenciosa (falha de terceiro
  // nunca bloqueia nada) e a cliente ainda pode digitar o CEP de novo à mão.
  const cepParaAutoBusca = v("postal_code")
  const ibgeAtual = v("metadata.municipio_ibge")
  const cepAutoBuscado = useRef<string | null>(null)
  useEffect(() => {
    const cep = normalizarCep(cepParaAutoBusca)
    if (!cepValido(cep) || ibgeAtual || cepAutoBuscado.current === cep) return
    cepAutoBuscado.current = cep
    void buscarCep(cepParaAutoBusca)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cepParaAutoBusca, ibgeAtual])

  // Cidade/estado editados à mão: o IBGE ali era do endereço anterior e não vale
  // mais para o texto novo. Como a cliente nunca vê o campo IBGE, ela não tem como
  // notar nem corrigir — então em vez de arriscar mandar a nota para o município
  // errado em silêncio, limpa o IBGE e avisa. Falha visível e recuperável.
  function mudarManualmente(campo: "city" | "province", valor: string) {
    onChange(n(campo), valor)
    if (v("metadata.municipio_ibge")) {
      onChange(n("metadata.municipio_ibge"), "")
    }
    setAvisoMunicipio(
      "Município alterado — busque o CEP novamente para atualizar os dados fiscais."
    )
  }

  const avisoJuntoDoCep = buscando
    ? "Buscando endereço…"
    : avisoCep || avisoMunicipio

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
        data-testid={testid("input-cep")}
      />
      <div className="flex items-end text-sm text-ui-fg-subtle">
        {avisoJuntoDoCep}
      </div>

      <Input
        label="Endereço"
        name={n("address_1")}
        autoComplete="address-line1"
        value={v("address_1")}
        onChange={(e) => onChange(n("address_1"), e.target.value)}
        required
        data-testid={testid("input-endereco")}
      />
      <Input
        label="Número"
        name={n("metadata.numero")}
        autoComplete="address-line2"
        value={v("metadata.numero")}
        onChange={(e) => onChange(n("metadata.numero"), e.target.value)}
        required
        data-testid={testid("input-numero")}
      />

      <Input
        label="Complemento"
        name={n("address_2")}
        value={v("address_2")}
        onChange={(e) => onChange(n("address_2"), e.target.value)}
        data-testid={testid("input-complemento")}
      />
      <Input
        label="Bairro"
        name={n("metadata.bairro")}
        value={v("metadata.bairro")}
        onChange={(e) => onChange(n("metadata.bairro"), e.target.value)}
        required
        data-testid={testid("input-bairro")}
      />

      <Input
        label="Cidade"
        name={n("city")}
        autoComplete="address-level2"
        value={v("city")}
        onChange={(e) => mudarManualmente("city", e.target.value)}
        required
        data-testid={testid("input-cidade")}
      />
      <Input
        label="Estado"
        name={n("province")}
        autoComplete="address-level1"
        value={v("province")}
        onChange={(e) => mudarManualmente("province", e.target.value)}
        required
        data-testid={testid("input-estado")}
      />

      <CountrySelect
        name={n("country_code")}
        autoComplete="country"
        region={region}
        value={v("country_code")}
        onChange={(e) => onChange(n("country_code"), e.target.value)}
        required
        data-testid={testid("select-pais")}
      />

      {/* A cliente não digita código IBGE — ele vem da busca de CEP. */}
      <input type="hidden" name={n("metadata.municipio_ibge")} value={v("metadata.municipio_ibge")} />
    </div>
  )
}
