import { avaliarMinimo, mensagemDoMinimo, subtotalDasPecas, PEDIDO_MINIMO_CENTAVOS } from "../regra"

describe("pedido mínimo", () => {
  it("soma preço × quantidade em centavos", () => {
    expect(subtotalDasPecas([{ unit_price: 169, quantity: 2 }, { unit_price: 34.9, quantity: 1 }])).toBe(37290)
  })

  it("R$ 100 é o mínimo (desde 21/09) e fecha exatamente no limite", () => {
    expect(avaliarMinimo([{ unit_price: 100, quantity: 1 }])).toEqual({ atingiu: true, subtotal: 10000, minimo: 10000, falta: 0 })
    expect(PEDIDO_MINIMO_CENTAVOS).toBe(10000)
  })

  it("um centavo abaixo ainda não passa", () => {
    expect(avaliarMinimo([{ unit_price: 99.99, quantity: 1 }])).toEqual({ atingiu: false, subtotal: 9999, minimo: 10000, falta: 1 })
  })

  it("abaixo do mínimo devolve o quanto falta", () => {
    expect(avaliarMinimo([{ unit_price: 34.9, quantity: 1 }])).toEqual({ atingiu: false, subtotal: 3490, minimo: 10000, falta: 6510 })
  })

  it("o desconto não conta: o mínimo é sobre o preço cheio das peças", () => {
    expect(avaliarMinimo([{ unit_price: 169, quantity: 1 }]).atingiu).toBe(true)
  })

  it("carrinho vazio não é 'abaixo do mínimo'", () => {
    expect(avaliarMinimo([]).atingiu).toBe(true)
    expect(avaliarMinimo(null).atingiu).toBe(true)
  })

  it("linha com quantidade ou preço inválido não derruba a conta", () => {
    expect(subtotalDasPecas([{ unit_price: null, quantity: 2 }, { unit_price: 10, quantity: null }])).toBe(0)
  })

  it("mensagem em reais, com vírgula", () => {
    expect(mensagemDoMinimo(6510, 10000)).toBe("Pedido mínimo de R$ 100,00 em peças. Faltam R$ 65,10.")
  })
})
