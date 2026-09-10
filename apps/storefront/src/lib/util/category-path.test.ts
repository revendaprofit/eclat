import { describe, expect, it } from "vitest"
import { categoryPath } from "./category-path"

const masculino = { id: "c1", handle: "masculino", parent_category: null }
const bermudas = { id: "c2", handle: "bermudas", parent_category: masculino }

describe("categoryPath", () => {
  it("categoria raiz devolve o próprio handle", () => {
    expect(categoryPath(masculino)).toBe("masculino")
  })
  it("segue parent_category expandido", () => {
    expect(categoryPath(bermudas)).toBe("masculino/bermudas")
  })
  it("resolve parent_category_id pelo mapa quando não veio expandido", () => {
    const byId = new Map([["c1", masculino]])
    expect(categoryPath({ id: "c2", handle: "bermudas", parent_category_id: "c1" }, byId)).toBe(
      "masculino/bermudas"
    )
  })
  it("não entra em loop com ciclo acidental", () => {
    const a: { id: string; handle: string; parent_category: unknown } = { id: "a", handle: "a", parent_category: null }
    const b = { id: "b", handle: "b", parent_category: a }
    a.parent_category = b
    expect(categoryPath(b as never)).toBe("a/b")
  })
})
