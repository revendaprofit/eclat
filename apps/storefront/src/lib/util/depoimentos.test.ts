import { describe, expect, it } from "vitest"
import { depoimentosReais } from "./depoimentos"
import { HOME_DEFAULTS } from "@modules/home/content"

describe("depoimentosReais", () => {
  it("só passa depoimento com fala e autora", () => {
    expect(
      depoimentosReais([
        { quote: " Amei viu! Super aprovado! ", author: "Pollianna", origem: "Instagram" },
        { quote: "sem autora" },
        { author: "sem fala" },
        null,
      ])
    ).toEqual([{ quote: "Amei viu! Super aprovado!", author: "Pollianna", origem: "Instagram" }])
    expect(depoimentosReais(undefined)).toEqual([])
  })
  it("o código não traz depoimento padrão (nada inventado)", () => {
    expect(HOME_DEFAULTS.testimonials.items ?? []).toEqual([])
  })
})
