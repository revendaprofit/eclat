import { describe, expect, it } from "vitest"
import { FALLBACK_HEX, isValidHex, normalizeColorName, resolveColor } from "./colors"

const MAP = {
  "Verde Exército": { hex: "#3B4A2F", swatch_url: null },
  Licor: { hex: "#d5823e", swatch_url: "https://x/licor.jpg" },
  "Off-white": { hex: null },
}

describe("normalizeColorName", () => {
  it("ignora caixa, acento e espaços extras", () => {
    expect(normalizeColorName("  verde exercito ")).toBe("verde exercito")
    expect(normalizeColorName("Verde Exército")).toBe("verde exercito")
  })
})

describe("resolveColor", () => {
  it("acha por nome exato e devolve hex em maiúsculas", () => {
    expect(resolveColor(MAP, "Licor")).toEqual({ name: "Licor", hex: "#D5823E", swatch_url: "https://x/licor.jpg", known: true })
  })
  it("acha ignorando acento/caixa e devolve o nome canônico do mapa", () => {
    expect(resolveColor(MAP, "verde exercito").name).toBe("Verde Exército")
    expect(resolveColor(MAP, "verde exercito").known).toBe(true)
  })
  it("cor conhecida sem hex usa o fallback mas continua known", () => {
    const r = resolveColor(MAP, "Off-white")
    expect(r.hex).toBe(FALLBACK_HEX)
    expect(r.known).toBe(true)
  })
  it("cor desconhecida: fallback, known=false, nome como veio", () => {
    expect(resolveColor(MAP, "Azul Petróleo")).toEqual({ name: "Azul Petróleo", hex: FALLBACK_HEX, swatch_url: null, known: false })
    expect(resolveColor(null, "Licor").known).toBe(false)
  })
})

describe("isValidHex", () => {
  it("aceita #RGB e #RRGGBB", () => {
    expect(isValidHex("#fff")).toBe(true)
    expect(isValidHex("#3B4A2F")).toBe(true)
    expect(isValidHex("3B4A2F")).toBe(false)
    expect(isValidHex("#GGG")).toBe(false)
  })
})
