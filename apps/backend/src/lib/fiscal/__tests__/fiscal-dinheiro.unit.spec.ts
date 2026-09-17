import { numeroReais, ratearFrete, reais } from "../fiscal-dinheiro"
import { ErroFiscal } from "../tipos"

describe("reais", () => {
  it("formata centavos com duas casas", () => {
    expect(reais(18990)).toBe("189.90")
    expect(reais(5)).toBe("0.05")
    expect(reais(0)).toBe("0.00")
    expect(reais(100000)).toBe("1000.00")
  })
})

describe("numeroReais", () => {
  it("converte centavos em número JSON de reais", () => {
    expect(numeroReais(18990)).toBe(189.9)
    expect(numeroReais(5)).toBe(0.05)
    expect(numeroReais(0)).toBe(0)
  })

  it("serializa sem ruído de ponto flutuante", () => {
    // 0.1 + 0.2 em float é 0.30000000000000004 — a conversão a partir de inteiro não pode vazar isso.
    expect(JSON.stringify(numeroReais(30))).toBe("0.3")
    expect(JSON.stringify(numeroReais(1999))).toBe("19.99")
  })

  it("recusa valor não inteiro", () => {
    expect(() => numeroReais(10.5)).toThrow(ErroFiscal)
    expect(() => numeroReais(NaN)).toThrow(ErroFiscal)
  })
})

describe("ratearFrete", () => {
  it("a soma das partes é exatamente o frete", () => {
    const partes = ratearFrete(1000, [18990, 12990, 8990])
    expect(partes.reduce((a, b) => a + b, 0)).toBe(1000)
  })

  it("dízima: 100 centavos entre três itens iguais vira 34 + 33 + 33", () => {
    expect(ratearFrete(100, [5000, 5000, 5000])).toEqual([34, 33, 33])
  })

  it("rateia em proporção ao peso", () => {
    expect(ratearFrete(1000, [7500, 2500])).toEqual([750, 250])
  })

  it("um item só recebe o frete inteiro", () => {
    expect(ratearFrete(2590, [18990])).toEqual([2590])
  })

  it("frete zero dá zero para todos", () => {
    expect(ratearFrete(0, [100, 200])).toEqual([0, 0])
  })

  it("todos os pesos zero (pedido 100% desconto): divide igualmente", () => {
    expect(ratearFrete(101, [0, 0])).toEqual([51, 50])
  })

  it("recusa frete negativo, fracionário, ou lista vazia", () => {
    expect(() => ratearFrete(-1, [100])).toThrow(ErroFiscal)
    expect(() => ratearFrete(10.5, [100])).toThrow(ErroFiscal)
    expect(() => ratearFrete(100, [])).toThrow(ErroFiscal)
  })
})
