import { cartaoComDescontoPix, codigoPix, ehCodigoPix } from "../regra"

describe("desconto-pix/regra", () => {
  it("código padrão PIX5, sem diferenciar maiúsculas", () => {
    expect(codigoPix({})).toBe("PIX5")
    expect(ehCodigoPix("pix5", {})).toBe(true)
    expect(ehCodigoPix(" PIX5 ", {})).toBe(true)
    expect(ehCodigoPix("BEMVINDA10", {})).toBe(false)
    expect(ehCodigoPix(null, {})).toBe(false)
  })
  it("código trocável por env", () => {
    expect(ehCodigoPix("PIXOFF", { DESCONTO_PIX_CODIGO: "pixoff" })).toBe(true)
    expect(ehCodigoPix("PIX5", { DESCONTO_PIX_CODIGO: "pixoff" })).toBe(false)
  })
  it("recusa só cartão com o código no carrinho", () => {
    expect(cartaoComDescontoPix("cartao", ["BEMVINDA10", "PIX5"], {})).toBe(true)
    expect(cartaoComDescontoPix("pix", ["PIX5"], {})).toBe(false)
    expect(cartaoComDescontoPix("cartao", ["BEMVINDA10"], {})).toBe(false)
  })
})
