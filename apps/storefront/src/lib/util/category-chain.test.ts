import { describe, expect, it } from "vitest"
import { buildChain, deepestCategoryId, type CategoryLike } from "./category-chain"

const CATS: CategoryLike[] = [
  { id: "root", name: "Legging", handle: "legging", parent_category_id: null },
  { id: "child", name: "Legging Cintura Alta", handle: "legging-cintura-alta", parent_category_id: "root" },
  { id: "other-root", name: "Top", handle: "top", parent_category_id: null },
]

describe("buildChain", () => {
  it("categoria filha: cadeia raiz -> filha", () => {
    expect(buildChain(CATS, "child")).toEqual([
      { id: "root", name: "Legging", handle: "legging" },
      { id: "child", name: "Legging Cintura Alta", handle: "legging-cintura-alta" },
    ])
  })
  it("categoria raiz: cadeia com um item só", () => {
    expect(buildChain(CATS, "root")).toEqual([{ id: "root", name: "Legging", handle: "legging" }])
  })
  it("id desconhecido: cadeia vazia", () => {
    expect(buildChain(CATS, "nope")).toEqual([])
  })
  it("ciclo: não trava, termina", () => {
    const cyclic: CategoryLike[] = [
      { id: "a", name: "A", handle: "a", parent_category_id: "b" },
      { id: "b", name: "B", handle: "b", parent_category_id: "a" },
    ]
    const chain = buildChain(cyclic, "a")
    expect(chain.length).toBeGreaterThan(0)
    expect(chain.every((c) => ["a", "b"].includes(c.id))).toBe(true)
  })
})

describe("deepestCategoryId", () => {
  it("entre raiz e filha, a filha é a mais profunda", () => {
    expect(deepestCategoryId(CATS, ["root", "child"])).toBe("child")
    expect(deepestCategoryId(CATS, ["child", "root"])).toBe("child")
  })
  it("empate: a primeira da lista", () => {
    expect(deepestCategoryId(CATS, ["root", "other-root"])).toBe("root")
  })
  it("lista vazia: null", () => {
    expect(deepestCategoryId(CATS, [])).toBeNull()
  })
})
