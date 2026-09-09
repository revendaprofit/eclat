import { raizPorCategoria, type CategoriaMin } from "../utils/categorias"

describe("raizPorCategoria", () => {
  it("categoria raiz mapeia para o próprio handle", () => {
    const cats: CategoriaMin[] = [{ id: "cat_tops", handle: "tops", parent_category_id: null }]
    expect(raizPorCategoria(cats).get("cat_tops")).toBe("tops")
  })

  it("filha (óculos, pai acessórios) mapeia para o handle da raiz (acessórios)", () => {
    const cats: CategoriaMin[] = [
      { id: "cat_acessorios", handle: "acessorios", parent_category_id: null },
      { id: "cat_oculos", handle: "oculos", parent_category_id: "cat_acessorios" },
    ]
    const raiz = raizPorCategoria(cats)
    expect(raiz.get("cat_acessorios")).toBe("acessorios")
    expect(raiz.get("cat_oculos")).toBe("acessorios")
  })

  it("neta mapeia para a raiz do avô (multi-nível)", () => {
    const cats: CategoriaMin[] = [
      { id: "cat_acessorios", handle: "acessorios", parent_category_id: null },
      { id: "cat_oculos", handle: "oculos", parent_category_id: "cat_acessorios" },
      { id: "cat_oculos_sol", handle: "oculos-de-sol", parent_category_id: "cat_oculos" },
    ]
    expect(raizPorCategoria(cats).get("cat_oculos_sol")).toBe("acessorios")
  })

  it("pai desconhecido (não presente na lista) → o próprio handle", () => {
    const cats: CategoriaMin[] = [{ id: "cat_orfa", handle: "orfa", parent_category_id: "cat_inexistente" }]
    expect(raizPorCategoria(cats).get("cat_orfa")).toBe("orfa")
  })
})
