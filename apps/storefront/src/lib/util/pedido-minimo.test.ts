import { describe, expect, it } from "vitest"
import { avaliarMinimo, subtotalDasPecas } from "./pedido-minimo"

describe("pedido mínimo (vitrine)", () => {
  it("soma preço × quantidade em centavos", () => {
    expect(subtotalDasPecas({ items: [{ unit_price: 169, quantity: 2 }, { unit_price: 34.9, quantity: 1 }] })).toBe(37290)
  })

  it("abaixo do mínimo: diz quanto falta e o quanto já andou", () => {
    const a = avaliarMinimo({ items: [{ unit_price: 34.9, quantity: 1 }] })
    expect(a).toEqual({ atingiu: false, subtotal: 3490, minimo: 10000, falta: 6510, percentual: 34 })
  })

  it("exatamente R$ 100 já libera (mínimo desde 21/09)", () => {
    expect(avaliarMinimo({ items: [{ unit_price: 100, quantity: 1 }] }).atingiu).toBe(true)
    expect(avaliarMinimo({ items: [{ unit_price: 99.99, quantity: 1 }] }).atingiu).toBe(false)
  })

  it("mesma conta do backend: o desconto do cupom não derruba o mínimo", () => {
    expect(avaliarMinimo({ items: [{ unit_price: 169, quantity: 1 }] }).atingiu).toBe(true)
  })

  it("carrinho vazio não acusa mínimo", () => {
    expect(avaliarMinimo({ items: [] }).atingiu).toBe(true)
    expect(avaliarMinimo({}).atingiu).toBe(true)
  })
})
