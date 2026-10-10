"use client"

import { useRef, useState } from "react"
import { cotarFreteDaPeca, type CotacaoDaPeca } from "@lib/data/frete"
import { normalizarCep } from "@lib/util/cep"
import { casasDoValor, progressoFreteGratis, textoPrazo, type RegrasDeFrete } from "@lib/util/frete"
import { convertToLocale } from "@lib/util/money"

const NOME: Record<string, string> = { mini: "Mini Envios", pac: "PAC", sedex: "SEDEX" }
const mascarar = (v: string) => {
  const d = normalizarCep(v).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}
const reais = (centavos: number) =>
  convertToLocale({ amount: centavos / 100, currency_code: "brl", minimumFractionDigits: casasDoValor(centavos), maximumFractionDigits: casasDoValor(centavos) })

// "Calcule o frete e o prazo" na página do produto (referência bechose.com.br, pedido da sócia em
// 2026-10-10). Cota UMA unidade da variante escolhida (ou a primeira do produto, antes de escolher
// tamanho) e mostra a régua do frete grátis com o preço da peça. Nada é gravado no carrinho.
export default function FretePrazo({ variantId, precoCentavos, regras }: { variantId: string | null; precoCentavos: number; regras: RegrasDeFrete | null }) {
  const [cep, setCep] = useState("")
  const [calculando, setCalculando] = useState(false)
  const [resultado, setResultado] = useState<CotacaoDaPeca | null>(null)
  const ultimo = useRef(0)
  if (!variantId) return null

  const calcular = async () => {
    if (normalizarCep(cep).length !== 8) {
      setResultado({ ok: false, erro: "Digite um CEP com 8 números." })
      return
    }
    const minha = ++ultimo.current
    setCalculando(true)
    const r = await cotarFreteDaPeca(cep, variantId)
    if (minha !== ultimo.current) return
    setResultado(r)
    setCalculando(false)
  }
  const regua = resultado?.ok && regras ? progressoFreteGratis(precoCentavos, resultado.uf, regras) : null

  return (
    <div className="flex flex-col gap-y-2 border-t border-ui-border-base pt-5" data-testid="frete-prazo">
      <p className="text-sm font-semibold text-eclat-grafite">Calcule o frete e o prazo</p>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          calcular()
        }}
      >
        <label htmlFor="pdp-cep" className="sr-only">
          CEP
        </label>
        <input
          id="pdp-cep"
          inputMode="numeric"
          autoComplete="postal-code"
          placeholder="Digite seu CEP"
          value={cep}
          onChange={(e) => setCep(mascarar(e.target.value))}
          className="h-11 min-w-0 flex-1 rounded-md border border-eclat-pedra bg-white px-3 text-base text-eclat-grafite"
          data-testid="pdp-cep"
        />
        <button type="submit" disabled={calculando} className="h-11 shrink-0 rounded-md bg-eclat-grafite px-4 text-xs uppercase tracking-widest text-eclat-luz disabled:opacity-50">
          {calculando ? "…" : "Calcular"}
        </button>
      </form>
      <a href="https://buscacepinter.correios.com.br/app/endereco/index.php" target="_blank" rel="noopener noreferrer" className="text-xs text-eclat-grafite/60 underline underline-offset-2 w-fit">
        Não sei meu CEP
      </a>
      {resultado && !resultado.ok && (
        <p className="text-xs text-red-600" role="alert">
          {resultado.erro}
        </p>
      )}
      {resultado?.ok && (
        <div className="flex flex-col gap-y-2 text-sm text-eclat-grafite">
          {resultado.lugar && <p className="text-xs text-eclat-grafite/60">Entrega em {resultado.lugar}</p>}
          {resultado.opcoes.length ? (
            <ul className="flex flex-col gap-y-1.5" data-testid="pdp-frete-opcoes">
              {resultado.opcoes.map((o) => (
                <li key={o.servico} className="flex items-baseline justify-between gap-3">
                  <span>
                    <span className="font-medium">{NOME[o.servico] ?? o.servico}</span>
                    <span className="text-eclat-grafite/60"> · {textoPrazo({ min: o.prazo_min, max: o.prazo_max })}</span>
                  </span>
                  <span className="shrink-0">{regua?.atingiu && o === resultado.opcoes[0] ? "Grátis" : reais(o.centavos)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-eclat-grafite/70">O valor exato aparece no checkout, depois do endereço.</p>
          )}
          {regua && (
            <div className="mt-1" data-testid="pdp-frete-gratis">
              <div className="h-1.5 w-full rounded-full bg-eclat-pedra/40">
                <div className="h-1.5 rounded-full bg-eclat-terracota" style={{ width: `${regua.percentual}%` }} />
              </div>
              <p className="mt-1 text-xs text-eclat-grafite/70">
                {regua.atingiu ? "Esta peça já tem frete grátis para o seu CEP." : `Com esta peça, faltam ${reais(regua.falta)} para o frete grátis.`}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
