"use client"

import { useState } from "react"
import { lerDadosFiscais, faltamDadosFiscaisPedido } from "@/lib/dados-fiscais"
import { cepValido, normalizarCep, type EnderecoCep } from "@/lib/cep"

// Completa os dados fiscais de um pedido que veio sem eles.
//
// Só aparece quando falta algo E o pedido ainda não tem nota. Depois de emitida,
// o dado é histórico: alterá-lo criaria divergência com o XML já transmitido.

const card = "border border-eclat-pedra/40 rounded-lg p-5 bg-eclat-luz flex flex-col gap-3"
const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const hint = "text-xs text-eclat-grafite/55 leading-relaxed"
const btn =
  "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"

export function DadosFiscaisDoPedido({
  order,
  temNotaEmitida,
}: {
  order: unknown
  temNotaEmitida: boolean
}) {
  const atual = lerDadosFiscais(order)
  const faltam = faltamDadosFiscaisPedido(atual)

  const [form, setForm] = useState({ ...atual, cep: "" })
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (temNotaEmitida || faltam.length === 0) return null

  const orderId = (order as { id?: string })?.id ?? ""

  async function buscarCep(bruto: string) {
    if (!cepValido(bruto)) return
    try {
      const r = await fetch(`/api/cep/${normalizarCep(bruto)}`)
      if (!r.ok) return
      const e = (await r.json()) as EnderecoCep
      setForm((p) => ({ ...p, bairro: e.bairro || p.bairro, municipio_ibge: e.ibge }))
    } catch {
      // Silencioso: o operador pode digitar o IBGE à mão no campo abaixo.
    }
  }

  async function salvar() {
    setOcupado(true)
    setErro(null)
    try {
      const r = await fetch(`/api/orders/${orderId}/dados-fiscais`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cpf: form.cpf,
          numero: form.numero,
          bairro: form.bairro,
          municipio_ibge: form.municipio_ibge,
        }),
      })
      const d = (await r.json()) as { error?: string }
      if (!r.ok) throw new Error(d.error ?? "Falha ao salvar.")
      location.reload()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setOcupado(false)
    }
  }

  return (
    <section className={card}>
      <h3 className="font-medium text-eclat-grafite">Dados fiscais</h3>

      <p className="rounded border border-yellow-300 bg-yellow-50 p-2 text-sm">
        Este pedido não pode gerar nota fiscal ainda. Falta: <b>{faltam.join(", ")}</b>.
      </p>

      <label className={label}>CPF da cliente</label>
      <input
        className={input}
        value={form.cpf}
        onChange={(e) => setForm((p) => ({ ...p, cpf: e.target.value }))}
      />

      <label className={label}>CEP (preenche bairro e município)</label>
      <input
        className={input}
        value={form.cep}
        onChange={(e) => {
          setForm((p) => ({ ...p, cep: e.target.value }))
          void buscarCep(e.target.value)
        }}
      />

      <label className={label}>Número</label>
      <input
        className={input}
        value={form.numero}
        onChange={(e) => setForm((p) => ({ ...p, numero: e.target.value }))}
      />

      <label className={label}>Bairro</label>
      <input
        className={input}
        value={form.bairro}
        onChange={(e) => setForm((p) => ({ ...p, bairro: e.target.value }))}
      />

      <label className={label}>Código IBGE do município</label>
      <input
        className={input}
        value={form.municipio_ibge}
        onChange={(e) => setForm((p) => ({ ...p, municipio_ibge: e.target.value }))}
      />
      <p className={hint}>7 dígitos. O CEP acima preenche automaticamente.</p>

      <button type="button" className={btn} onClick={salvar} disabled={ocupado}>
        {ocupado ? "Salvando…" : "Salvar dados fiscais"}
      </button>

      {erro && <p className="text-sm text-red-700">{erro}</p>}
    </section>
  )
}
