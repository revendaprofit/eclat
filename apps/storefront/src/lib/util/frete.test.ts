import { describe, expect, it } from "vitest"
import { baseDoCarrinho, casasDoValor, progressoFreteGratis, servicoDaOpcao, textoPrazo } from "./frete"

const REGRAS = { piso_mg: 49900, piso_brasil: 59900 }

describe("frete na vitrine", () => {
  it("base = soma preço × quantidade das linhas, em centavos (espelha calcularBase do backend)", () => {
    expect(
      baseDoCarrinho({ items: [{ unit_price: 259, quantity: 2 }, { unit_price: 159.9, quantity: 1 }] })
    ).toBe(67790)
  })

  it("base desconta os adjustments da própria linha (cupom e Benefício Conjunto), não o discount_total do carrinho", () => {
    expect(
      baseDoCarrinho({
        items: [
          { unit_price: 259, quantity: 1, adjustments: [{ amount: 25.9 }] },
          { unit_price: 159, quantity: 1, adjustments: [{ amount: 15.9 }, { amount: 31.8 }] },
        ],
      })
    ).toBe(34440)
  })

  it("ignora o discount_total do carrinho quando ele é maior por causa de desconto de MÉTODO DE FRETE", () => {
    // discount_total (45.90 = 25.90 de cupom de linha + 20.00 de desconto no frete) NÃO deve ser usado:
    // a base soma só o que está em items[].adjustments (a linha tem só o cupom de 25.90).
    const base = baseDoCarrinho({
      items: [{ unit_price: 259, quantity: 1, adjustments: [{ amount: 25.9 }] }],
      discount_total: 45.9,
    } as unknown as Parameters<typeof baseDoCarrinho>[0])
    expect(base).toBe(23310)
  })

  it("base nunca fica negativa", () => {
    expect(
      baseDoCarrinho({ items: [{ unit_price: 10, quantity: 1, adjustments: [{ amount: 50 }] }] })
    ).toBe(0)
  })

  it("sem itens (ausentes, vazios ou null) → base 0", () => {
    expect(baseDoCarrinho({})).toBe(0)
    expect(baseDoCarrinho({ items: [] })).toBe(0)
    expect(baseDoCarrinho({ items: null })).toBe(0)
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

  it("piso zero (campanha de frete grátis para todos): atingiu, 100%, sem NaN", () => {
    expect(progressoFreteGratis(0, "MG", { piso_mg: 0, piso_brasil: 59900 })).toEqual({ piso: 0, falta: 0, atingiu: true, percentual: 100 })
    expect(progressoFreteGratis(12000, "SP", { piso_mg: 49900, piso_brasil: 0 })).toEqual({ piso: 0, falta: 0, atingiu: true, percentual: 100 })
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

  it("casas decimais do valor: redondo usa 0, com centavos usa 2 (nunca corta o centavo)", () => {
    expect(casasDoValor(49900)).toBe(0)
    expect(casasDoValor(59900)).toBe(0)
    expect(casasDoValor(0)).toBe(0)
    expect(casasDoValor(46910)).toBe(2)
    expect(casasDoValor(1)).toBe(2)
    expect(casasDoValor(46901)).toBe(2)
  })
})
