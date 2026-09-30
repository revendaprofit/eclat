import { describe, expect, it } from "vitest"
import { ehLinhaDePresente, faixasParaEscolher, percentualAteProxima, rotuloDaVariante, type EstadoBrinde } from "./brinde"

const base: EstadoBrinde = {
  ativo: true,
  base_centavos: 23310,
  liberadas: [],
  proxima: { id: "meia", minimo_centavos: 25000, falta_centavos: 1690 },
  faixas: [],
  presente: null,
  valido: true,
  motivo: null,
}

describe("brinde (vitrine)", () => {
  it("reconhece a linha de presente pela metadata", () => {
    expect(ehLinhaDePresente({ metadata: { brinde: "meia" } })).toBe(true)
    expect(ehLinhaDePresente({ metadata: {} })).toBe(false)
    expect(ehLinhaDePresente(null)).toBe(false)
  })

  it("calcula o progresso até a próxima faixa", () => {
    expect(percentualAteProxima(base)).toBe(93)
    expect(percentualAteProxima({ ...base, proxima: null })).toBe(100)
  })

  it("oferece a faixa mais alta primeiro", () => {
    const e = {
      ...base,
      liberadas: [
        { id: "meia" as const, minimo_centavos: 25000, product_handle: "meia-cano-medio" },
        { id: "oculos" as const, minimo_centavos: 55000, product_handle: "oculos-eclat" },
      ],
    }
    expect(faixasParaEscolher(e)).toEqual(["oculos", "meia"])
  })

  it("escreve a variante com tamanho antes da cor", () => {
    expect(
      rotuloDaVariante([
        { value: "Cinza & Grafitti", option: { title: "Cor" } },
        { value: "34-38", option: { title: "Tamanho" } },
      ])
    ).toBe("34-38 · Cinza & Grafitti")
  })
})
