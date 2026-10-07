import { describe, expect, it } from "vitest"
import { avisoTroca, codigosAoAplicar } from "./cupom-unico"

describe("um cupom por sacola", () => {
  it("o código novo substitui os anteriores em vez de somar", () => {
    expect(codigosAoAplicar(" paty10 ")).toEqual(["PATY10"])
    expect(codigosAoAplicar("   ")).toEqual([])
  })

  it("avisa quando tirou outro cupom; não avisa ao reaplicar o mesmo ou com sacola sem cupom", () => {
    expect(avisoTroca(["BEMVINDA10"], "PATY10")).toBe("O cupom PATY10 substituiu BEMVINDA10: só um cupom por pedido.")
    expect(avisoTroca(["PATY10"], "paty10")).toBeNull()
    expect(avisoTroca([], "PATY10")).toBeNull()
  })
})
