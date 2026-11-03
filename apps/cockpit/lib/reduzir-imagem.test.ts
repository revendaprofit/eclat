import { describe, expect, it } from "vitest"
import { medidasReduzidas } from "./reduzir-imagem"

describe("medidasReduzidas", () => {
  it("reduz pelo lado maior e mantém a proporção", () => {
    expect(medidasReduzidas(3000, 4500)).toEqual({ largura: 1067, altura: 1600 })
    expect(medidasReduzidas(4000, 2000)).toEqual({ largura: 1600, altura: 800 })
  })
  it("nunca aumenta foto pequena", () => {
    expect(medidasReduzidas(800, 1200)).toEqual({ largura: 800, altura: 1200 })
  })
})
