import { describe, expect, it } from "vitest"
import { montarCotacao } from "./cotacao-sacola"

describe("montarCotacao", () => {
  const opcoes = [
    { id: "sedex", name: "SEDEX", price_type: "calculated", type: { code: "sedex" } },
    { id: "pac", name: "PAC", price_type: "calculated", type: { code: "pac" } },
    { id: "mini", name: "Econômica (Mini Envios)", price_type: "calculated", type: { code: "mini" } },
    { id: "app", name: "Entrega por aplicativo", price_type: "calculated", type: { code: "entrega-app" } },
    { id: "fixo", name: "Retirada", price_type: "flat", amount: 0 },
  ]

  it("ordena pela mais barata, converte para centavos e traz o prazo", () => {
    const r = montarCotacao(opcoes, { sedex: 39.9, pac: 24.9 }, { pac: { min: 5, max: 8 }, sedex: { min: 2, max: 2 } })
    expect(r).toEqual([
      { id: "fixo", nome: "Retirada", centavos: 0, prazo: null },
      { id: "pac", nome: "PAC", centavos: 2490, prazo: "Chega em 5 a 8 dias úteis" },
      { id: "sedex", nome: "SEDEX", centavos: 3990, prazo: "Chega em 2 dias úteis" },
    ])
  })

  it("opção calculada que o backend recusou (sem preço) não aparece", () => {
    expect(montarCotacao(opcoes.slice(2, 4), {}, {})).toEqual([])
  })
})
