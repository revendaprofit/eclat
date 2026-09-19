import { calcularBase } from "../base-carrinho"

describe("calcularBase", () => {
  it("soma preço × quantidade, em centavos", () => {
    expect(calcularBase([{ unit_price: 259, quantity: 2 }, { unit_price: 159.9, quantity: 1 }])).toBe(67790)
  })

  it("desconta os adjustments (cupom e Benefício Conjunto), que vêm por linha", () => {
    expect(
      calcularBase([
        { unit_price: 259, quantity: 1, adjustments: [{ amount: 25.9 }] },
        { unit_price: 159, quantity: 1, adjustments: [{ amount: 15.9 }, { amount: 31.8 }] },
      ])
    ).toBe(34440)
  })

  it("aceita BigNumber do Medusa ({ numeric }) e valor bruto ({ value })", () => {
    expect(calcularBase([{ unit_price: { numeric: 100 }, quantity: { value: "2" }, adjustments: [{ amount: { numeric: 10 } }] }])).toBe(19000)
  })

  it("nunca fica negativa", () => {
    expect(calcularBase([{ unit_price: 10, quantity: 1, adjustments: [{ amount: 50 }] }])).toBe(0)
  })
})
