import { describe, expect, it } from "vitest"
import { buildSuggestions } from "./search-suggest"
import type { NavCategory, NavData } from "./navigation"

const cat = (id: string, name: string, handle: string, colors: { name: string; hex: string }[] = [], children: NavCategory[] = []): NavCategory =>
  ({ id, name, handle, image_url: null, descricao_curta: null, rank: 0, feminine: true, hasProducts: true, colors: colors.map((c) => ({ ...c, swatch_url: null })), children })

const NAV: NavData = {
  roots: [
    cat("c_top", "Top", "tops", [{ name: "Verde Exército", hex: "#3B4A2F" }, { name: "Licor", hex: "#D5823E" }]),
    cat("c_leg", "Legging", "leggings", [{ name: "Verde Exército", hex: "#3B4A2F" }]),
    cat("c_ace", "Acessórios", "acessorios", [{ name: "Preto", hex: "#000000" }], [cat("c_meia", "Meias", "meias")]),
  ],
  feminine: [],
  collections: [],
}

describe("buildSuggestions", () => {
  it("menos de 2 caracteres não sugere nada", () => {
    expect(buildSuggestions("v", NAV)).toEqual({ categories: [], colors: [], products: [] })
  })
  it("'verde' sugere a cor com as categorias onde ela existe (link já filtrado por cor)", () => {
    const s = buildSuggestions("verde", NAV)
    expect(s.categories).toEqual([])
    expect(s.colors).toEqual([
      {
        type: "cor",
        color: "Verde Exército",
        hex: "#3B4A2F",
        categories: [
          { name: "Top", handle: "tops", href: "/categories/tops?cor=Verde%20Ex%C3%A9rcito" },
          { name: "Legging", handle: "leggings", href: "/categories/leggings?cor=Verde%20Ex%C3%A9rcito" },
        ],
      },
    ])
  })
  it("nome de categoria (inclusive filha) casa sem acento e caixa", () => {
    expect(buildSuggestions("MEIA", NAV).categories).toEqual([{ type: "categoria", name: "Meias", handle: "meias", href: "/categories/meias" }])
    expect(buildSuggestions("acessor", NAV).categories.map((c) => c.handle)).toEqual(["acessorios"])
  })
  it("sinônimo sugere a categoria-alvo ('calça' → Legging)", () => {
    expect(buildSuggestions("calça", NAV).categories.map((c) => c.handle)).toEqual(["leggings"])
  })
  it("produtos passam no máximo 5, com href da PDP", () => {
    const hits = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, title: `Peça ${i}`, handle: `peca-${i}`, thumbnail: null }))
    const s = buildSuggestions("peça", NAV, hits)
    expect(s.products).toHaveLength(5)
    expect(s.products[0]).toEqual({ type: "produto", id: "p0", title: "Peça 0", handle: "peca-0", thumbnail: null, href: "/products/peca-0" })
  })
  // 5 categorias e 4 cores casando o mesmo termo "peça" (M8)
  const NAV_TRUNC: NavData = {
    roots: [
      cat("c1", "Peça Um", "peca-1", [
        { name: "Peça Cor A", hex: "#111" },
        { name: "Peça Cor B", hex: "#222" },
        { name: "Peça Cor C", hex: "#333" },
        { name: "Peça Cor D", hex: "#444" },
      ]),
      cat("c2", "Peça Dois", "peca-2"),
      cat("c3", "Peça Três", "peca-3"),
      cat("c4", "Peça Quatro", "peca-4"),
      cat("c5", "Peça Cinco", "peca-5"),
    ],
    feminine: [],
    collections: [],
  }
  it("categorias truncam em MAX_CATEGORIES (4)", () => {
    expect(buildSuggestions("peça", NAV_TRUNC).categories).toHaveLength(4)
  })
  it("cores truncam em MAX_COLORS (3)", () => {
    expect(buildSuggestions("peça", NAV_TRUNC).colors).toHaveLength(3)
  })
})
