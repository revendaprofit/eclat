import { describe, expect, it } from "vitest"
import { buildNavData } from "./navigation"

const cat = (id: string, name: string, handle: string, rank: number, parent: string | null = null, meta: Record<string, unknown> = {}) =>
  ({ id, name, handle, rank, parent_category_id: parent, metadata: meta })
const CATS = [
  cat("c_top", "Top", "tops", 0, null, { image_url: "top.jpg", descricao_curta: "Tops que sustentam" }),
  cat("c_short", "Short", "shorts", 1),
  cat("c_leg", "Legging", "leggings", 2),
  cat("c_mac", "Macaquinho / Macacão", "macaquinhos", 3),
  cat("c_conj", "Conjuntos", "conjuntos", 4),
  cat("c_ace", "Acessórios", "acessorios", 5),
  cat("c_ocu", "Óculos", "oculos", 0, "c_ace"),
  cat("c_meia", "Meias", "meias", 1, "c_ace"),
  cat("c_masc", "Masculino", "masculino", 6),
  cat("c_berm", "Bermudas", "bermudas", 0, "c_masc"),
]
const OPTS = [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }]
const v = (id: string, cor: string, qty: number) => ({ id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty, options: [{ option_id: "o_t", value: "M" }, { option_id: "o_c", value: cor }] })
const prod = (id: string, catIds: string[], variants: any[], collection_id: string | null = null, thumbnail = `${id}.jpg`) =>
  ({ id, thumbnail, collection_id, categories: catIds.map((i) => ({ id: i })), options: OPTS, variants })
const PRODUCTS = [
  prod("p1", ["c_top"], [v("v1", "Licor", 2), v("v2", "Verde Exercito", 0)], "col_black"),
  prod("p2", ["c_top"], [v("v3", "verde exército", 1)], "col_black"),
  prod("p3", ["c_leg"], [v("v4", "Blackout", 5)], "col_black"),
  prod("p4", ["c_meia"], [v("v5", "Preto", 1)], null),
]
const COLLECTIONS = [{ id: "col_black", title: "Família Blackout", handle: "familia-blackout", metadata: {} }, { id: "col_lum", title: "Lumière", handle: "lumiere", metadata: { image_url: "lum.jpg" } }]
const MAP = { "Verde Exército": { hex: "#3B4A2F", swatch_url: null }, Licor: { hex: "#D5823E", swatch_url: null } }

describe("buildNavData", () => {
  const nav = buildNavData({ categories: CATS as any, products: PRODUCTS as any, collections: COLLECTIONS, colorMap: MAP })
  it("raízes visíveis na ordem do rank; sem produto some (Short, Legging fica, Conjuntos some, Masculino some)", () => {
    expect(nav.roots.map((r) => r.handle)).toEqual(["tops", "leggings", "acessorios"])
  })
  it("Acessórios aparece por causa de Meias e lista TODAS as filhas, na ordem", () => {
    const ace = nav.roots.find((r) => r.handle === "acessorios")!
    expect(ace.children.map((c) => c.handle)).toEqual(["oculos", "meias"])
    expect(ace.children[0].hasProducts).toBe(false)
    expect(ace.hasProducts).toBe(true)
    expect(ace.feminine).toBe(false)
  })
  it("cores distintas, só disponíveis, resolvidas pelo mapa, ordem de aparição", () => {
    const top = nav.roots.find((r) => r.handle === "tops")!
    expect(top.colors).toEqual([
      { name: "Licor", hex: "#D5823E", swatch_url: null },
      { name: "Verde Exército", hex: "#3B4A2F", swatch_url: null }, // v2 esgotada, v3 disponível (grafia diferente → 1 cor, nome canônico)
    ])
    expect(top.feminine).toBe(true)
    expect(top.image_url).toBe("top.jpg")
    expect(top.descricao_curta).toBe("Tops que sustentam")
  })
  it("femininas = só as visíveis entre as cinco, na ordem", () => {
    expect(nav.feminine.map((c) => c.handle)).toEqual(["tops", "leggings"])
  })
  it("coleções com capa do metadata ou thumbnail do 1º produto; sem produto e sem capa continua listada", () => {
    expect(nav.collections).toEqual([
      { id: "col_black", title: "Família Blackout", handle: "familia-blackout", image_url: "p1.jpg" },
      { id: "col_lum", title: "Lumière", handle: "lumiere", image_url: "lum.jpg" },
    ])
  })
  it("entrada vazia devolve vazio", () => {
    expect(buildNavData({ categories: [], products: [], collections: [], colorMap: {} })).toEqual({ roots: [], feminine: [], collections: [] })
  })
})
