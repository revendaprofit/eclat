import { describe, expect, it } from "vitest"
import { baseDoCarrinho, progressoFreteGratis, servicoDaOpcao, textoPrazo } from "./frete"

const REGRAS = { piso_mg: 49900, piso_brasil: 59900 }

describe("frete na vitrine", () => {
  it("base = peças menos descontos, em centavos (o Medusa entrega reais decimais)", () => {
    expect(baseDoCarrinho({ item_subtotal: 518, discount_total: 51.8 })).toBe(46620)
    expect(baseDoCarrinho({ item_subtotal: 159.9 })).toBe(15990)
    expect(baseDoCarrinho({})).toBe(0)
  })

  it("progresso usa o piso de MG só para MG", () => {
    expect(progressoFreteGratis(45000, "MG", REGRAS)).toEqual({ piso: 49900, falta: 4900, atingiu: false, percentual: 90 })
    expect(progressoFreteGratis(45000, "sp", REGRAS)).toMatchObject({ piso: 59900, falta: 14900 })
    expect(progressoFreteGratis(45000, null, REGRAS).piso).toBe(59900)
    expect(progressoFreteGratis(45000, "br-mg", REGRAS).piso).toBe(49900)
  })

  it("atingiu o piso", () => {
    expect(progressoFreteGratis(49900, "MG", REGRAS)).toEqual({ piso: 49900, falta: 0, atingiu: true, percentual: 100 })
    expect(progressoFreteGratis(99900, "MG", REGRAS).percentual).toBe(100)
  })

  it("texto do prazo", () => {
    expect(textoPrazo({ min: 5, max: 6 })).toBe("Chega em 5 a 6 dias úteis")
    expect(textoPrazo({ min: 2, max: 2 })).toBe("Chega em 2 dias úteis")
    expect(textoPrazo({ min: 1, max: 1 })).toBe("Chega em 1 dia útil")
    expect(textoPrazo(undefined)).toBeNull()
  })

  it("descobre o serviço pelo código do tipo da opção", () => {
    expect(servicoDaOpcao({ type: { code: "sedex" } })).toBe("sedex")
    expect(servicoDaOpcao({ type: { code: "standard" } })).toBeNull()
    expect(servicoDaOpcao({})).toBeNull()
  })
})
