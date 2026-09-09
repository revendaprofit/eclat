import { describe, expect, it } from "vitest"
import { agruparDescontosPedido, etiquetaConjunto } from "./pedido-conjunto"

describe("agruparDescontosPedido", () => {
  it("separa CONJUNTO- de cupom, somando em centavos e devolvendo decimal", () => {
    expect(
      agruparDescontosPedido([
        { adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] },
        { adjustments: [{ code: "CUPOM10", amount: 25.9 }, { code: "CONJUNTO-creg_1", amount: 0.1 }] },
        {},
      ])
    ).toEqual({ conjunto: 19, cupom: 25.9 })
  })
  it("vazio → zeros", () => {
    expect(agruparDescontosPedido(undefined)).toEqual({ conjunto: 0, cupom: 0 })
  })
})

describe("etiquetaConjunto", () => {
  it("ajuste CONJUNTO- ou conjunto_slot → 'Conjunto'; senão null", () => {
    expect(etiquetaConjunto({ adjustments: [{ code: "CONJUNTO-x", amount: 1 }] })).toBe("Conjunto")
    expect(etiquetaConjunto({ metadata: { conjunto_slot: "a#0#1" } })).toBe("Conjunto")
    expect(etiquetaConjunto({ adjustments: [{ code: "CUPOM10", amount: 1 }] })).toBeNull()
    expect(etiquetaConjunto({})).toBeNull()
  })
})
