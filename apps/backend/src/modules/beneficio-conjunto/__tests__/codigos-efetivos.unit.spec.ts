import { codigosEfetivos } from "../codigos-efetivos"

describe("codigosEfetivos", () => {
  it("replace: só os novos (tirar o cupom não deixa o antigo competir com o conjunto)", () => {
    expect(codigosEfetivos(["BEMVINDA10", "PIX5"], ["PIX5"], "replace")).toEqual(["PIX5"])
    expect(codigosEfetivos(["BEMVINDA10"], [], "replace")).toEqual([])
  })
  it("remove: os do carrinho menos os informados", () => {
    expect(codigosEfetivos(["BEMVINDA10", "PIX5"], ["BEMVINDA10"], "remove")).toEqual(["PIX5"])
  })
  it("add (ou sem ação): soma, sem repetir", () => {
    expect(codigosEfetivos(["BEMVINDA10"], ["PIX5", "BEMVINDA10"], "add")).toEqual(["BEMVINDA10", "PIX5"])
    expect(codigosEfetivos(["A", null], ["B"])).toEqual(["A", "B"])
  })
})
