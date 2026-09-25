"use client"

import { cotarFreteDaSacola, type ResultadoCotacao } from "@lib/data/cotacao-sacola"
import { convertToLocale } from "@lib/util/money"
import { casasDoValor } from "@lib/util/frete"
import { normalizarCep } from "@lib/util/cep"
import { useEffect, useRef, useState } from "react"

const mascararCep = (v: string) => {
  const d = normalizarCep(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

const reais = (centavos: number) =>
  centavos === 0
    ? "Grátis"
    : convertToLocale({
        amount: centavos / 100,
        currency_code: "brl",
        minimumFractionDigits: casasDoValor(centavos),
        maximumFractionDigits: casasDoValor(centavos),
      })

// "Calcular frete" da sacola (diagnóstico 2026-09-25): a cliente vê preço e prazo de entrega antes
// de preencher qualquer dado. Se o carrinho já tem CEP (voltou do checkout), cota sozinho ao abrir.
export default function CalcularFrete({ cepInicial, itensKey }: { cepInicial: string | null; itensKey: string }) {
  const [cep, setCep] = useState(mascararCep(cepInicial ?? ""))
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCotacao | null>(null)
  const ultimo = useRef(0)

  const calcular = async (valor: string) => {
    if (normalizarCep(valor).length !== 8) {
      setResultado({ ok: false, erro: "Digite um CEP com 8 números." })
      return
    }
    const minha = ++ultimo.current
    setCalculando(true)
    const r = await cotarFreteDaSacola(valor)
    if (minha !== ultimo.current) return
    setResultado(r)
    setCalculando(false)
  }

  // Recota quando as peças mudam (peso e frete grátis dependem delas), se já havia um CEP.
  useEffect(() => {
    if (normalizarCep(cep).length === 8) calcular(cep)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensKey])

  return (
    <div className="flex flex-col gap-y-2" data-testid="calcular-frete">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          calcular(cep)
        }}
      >
        <label htmlFor="sacola-cep" className="sr-only">
          CEP para calcular o frete
        </label>
        <input
          id="sacola-cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Seu CEP"
          value={cep}
          onChange={(e) => setCep(mascararCep(e.target.value))}
          className="h-11 min-w-0 flex-1 rounded-md border border-eclat-pedra bg-white px-3 text-base text-eclat-grafite"
          data-testid="calcular-frete-cep"
        />
        <button
          type="submit"
          disabled={calculando}
          className="h-11 shrink-0 rounded-md border border-eclat-grafite px-4 text-sm text-eclat-grafite disabled:opacity-50"
          data-testid="calcular-frete-botao"
        >
          {calculando ? "Calculando…" : "Calcular frete"}
        </button>
      </form>
      {resultado && !resultado.ok && (
        <p className="text-xs text-red-600" role="alert">
          {resultado.erro}
        </p>
      )}
      {resultado?.ok && (
        <ul className="flex flex-col gap-y-1.5 text-sm text-eclat-grafite" data-testid="calcular-frete-opcoes">
          {resultado.lugar && <li className="text-xs text-eclat-grafite/60">Entrega em {resultado.lugar}</li>}
          {resultado.opcoes.map((o) => (
            <li key={o.id} className="flex items-baseline justify-between gap-3">
              <span className="min-w-0">
                {o.nome}
                {o.prazo && <span className="block text-xs text-eclat-grafite/60">{o.prazo}</span>}
              </span>
              <span className="shrink-0 tabular-nums font-medium">{reais(o.centavos)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
