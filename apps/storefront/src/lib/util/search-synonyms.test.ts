import { describe, expect, it } from "vitest"
import { normalizeTerm, synonymCategoryHandle } from "./search-synonyms"

describe("normalizeTerm", () => {
  it("tira acento, caixa e espaços repetidos", () => {
    expect(normalizeTerm("  Calça   Preta ")).toBe("calca preta")
    expect(normalizeTerm("MACACÃO")).toBe("macacao")
  })
})

describe("synonymCategoryHandle", () => {
  it("busca inteira que é sinônimo devolve o handle da categoria (spec §9)", () => {
    expect(synonymCategoryHandle("calça")).toBe("leggings")
    expect(synonymCategoryHandle("Calças")).toBe("leggings")
    expect(synonymCategoryHandle("blusa")).toBe("tops")
    expect(synonymCategoryHandle("cropped")).toBe("tops")
    expect(synonymCategoryHandle("macacão")).toBe("macaquinhos")
  })
  it("frase com mais palavras, termo vazio ou sem sinônimo devolve null", () => {
    expect(synonymCategoryHandle("calça preta")).toBeNull()
    expect(synonymCategoryHandle("")).toBeNull()
    expect(synonymCategoryHandle("verde")).toBeNull()
  })
  it("'bermuda' NÃO é sinônimo (Bermudas é categoria real em Masculino — ruling 1)", () => {
    expect(synonymCategoryHandle("bermuda")).toBeNull()
  })
  it("chave herdada do protótipo não é sinônimo (I3)", () => {
    expect(synonymCategoryHandle("constructor")).toBeNull()
    expect(synonymCategoryHandle("__proto__")).toBeNull()
  })
})
