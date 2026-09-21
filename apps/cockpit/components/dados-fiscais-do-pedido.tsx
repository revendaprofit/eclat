"use client"

import { useRef, useState } from "react"
import { lerDadosFiscais, faltamDadosFiscaisPedido } from "@/lib/dados-fiscais"
import { cepValido, normalizarCep, type EnderecoCep } from "@/lib/cep"
import type { StatusDocumento } from "@/lib/fiscal"

// Completa os dados fiscais de um pedido que veio sem eles.
//
// Só aparece quando falta algo E o pedido AINDA NÃO tem nota emitida de verdade (status
// "verificado" ou "autorizado_nao_verificado"). Ter um documento fiscal não é a mesma
// coisa: "montado", "rejeitado", "denegado" e "transmitido_sem_confirmacao" também são
// documentos (fiscal-emissao.ts grava "montado" ANTES de transmitir), mas a nota não
// existe de fato — e é justamente nesses casos que o operador mais precisa deste bloco
// para corrigir o dado e reemitir. Reduzir isso a um booleano na página escondia o
// bloco bem na hora em que ele era mais necessário (achado da revisão).
const NOTA_EXISTE: ReadonlySet<StatusDocumento> = new Set(["verificado", "autorizado_nao_verificado"])

// Forma mínima do pedido que este bloco precisa — espelha exatamente o que
// lerDadosFiscais (lib/dados-fiscais.ts) lê. Antes era `unknown`, e foi isso que deixou
// o tsc sem como pegar o `fields` do medusaGetOrder faltando esses dois metadata
// (achado da revisão final).
export type PedidoComDadosFiscais = {
  id: string
  metadata?: Record<string, unknown> | null
  shipping_address?: { metadata?: Record<string, unknown> | null } | null
  billing_address?: { metadata?: Record<string, unknown> | null } | null
}

const card = "border border-eclat-pedra/40 rounded-lg p-5 bg-eclat-luz flex flex-col gap-3"
const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-meta uppercase tracking-wider text-eclat-texto-3 mb-1 block"
const hint = "text-meta text-eclat-texto-3 leading-relaxed"
const btn =
  "bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-meta px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-texto disabled:opacity-50"

export function DadosFiscaisDoPedido({
  order,
  statusFiscal,
}: {
  order: PedidoComDadosFiscais
  statusFiscal?: StatusDocumento | null
}) {
  const atual = lerDadosFiscais(order)
  const faltam = faltamDadosFiscaisPedido(atual)

  const [form, setForm] = useState({ ...atual, cep: "" })
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // Guarda de sequência: se o operador corrigir o CEP antes da resposta anterior
  // voltar, ficam duas buscas em voo. Sem isto, a resposta mais lenta pode chegar por
  // último e sobrescrever o campo com o IBGE do CEP errado — mesma classe de bug já
  // corrigida na vitrine (address-fields/index.tsx), copiada aqui (achado da revisão).
  const sequenciaBusca = useRef(0)

  const notaExiste = !!statusFiscal && NOTA_EXISTE.has(statusFiscal)
  if (notaExiste || faltam.length === 0) return null

  const orderId = order?.id ?? ""

  async function buscarCep(bruto: string) {
    if (!cepValido(bruto)) return
    const minhaBusca = ++sequenciaBusca.current
    try {
      const r = await fetch(`/api/cep/${normalizarCep(bruto)}`)
      // Uma busca mais nova já começou: esta resposta chegou atrasada, descarta.
      if (minhaBusca !== sequenciaBusca.current) return
      if (!r.ok) return
      const e = (await r.json()) as EnderecoCep
      if (minhaBusca !== sequenciaBusca.current) return
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
      <h3 className="font-medium text-eclat-texto">Dados fiscais</h3>

      <p className="rounded border border-yellow-300 bg-yellow-50 p-2 text-corpo">
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

      {erro && <p className="text-corpo text-red-700">{erro}</p>}
    </section>
  )
}
