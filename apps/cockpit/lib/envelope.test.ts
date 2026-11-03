import { describe, expect, it } from "vitest"
import { textoDoEnvelope } from "./envelope"

describe("textoDoEnvelope", () => {
  it("avisa o presente que precisa ir na caixa", () => {
    expect(textoDoEnvelope("presente")).toContain("na caixa")
  })
  it("pedido sem envelope não mostra nada", () => {
    expect(textoDoEnvelope(undefined)).toBe(null)
    expect(textoDoEnvelope("outro")).toBe(null)
  })
})
