import { describe, expect, it } from "vitest"
import { aplicar, normalizar } from "./carrinhos-ignorados"

describe("carrinhos ignorados (marca de teste da equipe)", () => {
  it("normaliza lixo e aceita só ids de carrinho", () => {
    expect(normalizar(null)).toEqual({ ids: [], em: {} })
    expect(normalizar({ ids: ["cart_a", "x", "cart_a", 3], em: { cart_a: "2026-10-11" } })).toEqual({ ids: ["cart_a"], em: { cart_a: "2026-10-11" } })
  })
  it("ignorar acrescenta sem duplicar e guarda quando; restaurar tira", () => {
    const a = aplicar({ ids: [], em: {} }, "ignorar", ["cart_1", "cart_2", "cart_1"], "2026-10-11T00:00:00Z")
    expect(a.ids).toEqual(["cart_1", "cart_2"])
    expect(a.em.cart_1).toBe("2026-10-11T00:00:00Z")
    const b = aplicar(a, "restaurar", ["cart_1"])
    expect(b).toEqual({ ids: ["cart_2"], em: { cart_2: "2026-10-11T00:00:00Z" } })
  })
})
