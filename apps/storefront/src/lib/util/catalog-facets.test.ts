import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { DEFAULT_FILTERS } from "./catalog-filters"
import { applyFilters, computeFacets, paginate, productMinPrice, sortByKey, sortSizes } from "./catalog-facets"

type P = HttpTypes.StoreProduct
const OPTS = [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }]
const v = (id: string, tam: string, cor: string, qty: number, price: number) =>
  ({
    id,
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: qty,
    options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
    calculated_price: { calculated_amount: price, original_amount: price, currency_code: "brl", calculated_price: { price_list_type: "default" } },
  }) as unknown as HttpTypes.StoreProductVariant
const prod = (id: string, created: string, variants: HttpTypes.StoreProductVariant[], metadata: Record<string, unknown> = {}) =>
  ({ id, title: id, handle: id, created_at: created, options: OPTS, variants, metadata }) as unknown as P

const LEG = prod("legging", "2026-09-01", [v("l1", "P", "Verde Exercito", 2, 219), v("l2", "G", "Verde Exercito", 0, 219), v("l3", "G", "Licor", 4, 219)])
const TOP = prod("top", "2026-08-01", [v("t1", "P", "Licor", 1, 169), v("t2", "M", "Licor", 3, 169)], { destaque_rank: "1" })
const SHORT = prod("short", "2026-07-01", [v("s1", "M", "Blackout", 0, 149)], { destaque_rank: "0" })
const ALL = [LEG, TOP, SHORT]

describe("productMinPrice / sortSizes", () => {
  it("menor preço entre as variantes com preço", () => {
    expect(productMinPrice(LEG)).toBe(219)
    expect(productMinPrice({ ...LEG, variants: [] } as P)).toBeNull()
  })
  it("ordena P/M/G/GG antes e o resto alfabético", () => {
    expect(sortSizes(["GG", "34-38", "P", "G", "39-43", "M"])).toEqual(["P", "M", "G", "GG", "34-38", "39-43"])
  })
})

describe("applyFilters", () => {
  it("tamanho exige variante disponível", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["G"] }).map((p) => p.id)).toEqual(["legging"]) // l3 G Licor disponível
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["M"] }).map((p) => p.id)).toEqual(["top"]) // short M esgotado
  })
  it("tamanho E cor na mesma variante", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["G"], cor: ["Verde Exército"] })).toEqual([]) // l2 G verde esgotado
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["P"], cor: ["Verde Exército"] }).map((p) => p.id)).toEqual(["legging"])
  })
  it("cor compara ignorando acento e caixa", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, cor: ["verde exército"] }).map((p) => p.id)).toEqual(["legging"])
  })
  it("preço usa a variante mais barata; faixa aberta", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, preco: { min: 160, max: 200 } }).map((p) => p.id)).toEqual(["top"])
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, preco: { min: null, max: 150 } }).map((p) => p.id)).toEqual(["short"])
  })
  it("só disponíveis remove produto esgotado", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, disponivel: true }).map((p) => p.id)).toEqual(["legging", "top"])
  })
})

describe("computeFacets", () => {
  it("conta valores com os outros filtros aplicados e ignora o próprio", () => {
    const f = computeFacets(ALL, { ...DEFAULT_FILTERS, cor: ["Licor"] })
    expect(f.tamanhos).toEqual([{ value: "P", count: 1 }, { value: "M", count: 1 }, { value: "G", count: 1 }])
    // faceta de cor ignora o filtro de cor: todas as cores disponíveis
    expect(f.cores.map((c) => c.name)).toEqual(["Verde Exercito", "Licor"]) // Blackout só em variante esgotada → não conta
    expect(f.preco).toEqual({ min: 169, max: 219 })
  })
  it("sem produtos devolve facetas vazias", () => {
    expect(computeFacets([], DEFAULT_FILTERS)).toEqual({ tamanhos: [], cores: [], preco: null })
  })
})

describe("sortByKey", () => {
  it("novidades por created_at desc; preços; destaques por destaque_rank e depois novidades", () => {
    expect(sortByKey(ALL, "novidades").map((p) => p.id)).toEqual(["legging", "top", "short"])
    expect(sortByKey(ALL, "menor-preco").map((p) => p.id)).toEqual(["short", "top", "legging"])
    expect(sortByKey(ALL, "maior-preco").map((p) => p.id)).toEqual(["legging", "top", "short"])
    expect(sortByKey(ALL, "destaques").map((p) => p.id)).toEqual(["short", "top", "legging"])
  })
  it("não muta a entrada", () => {
    const copy = [...ALL]
    sortByKey(ALL, "menor-preco")
    expect(ALL).toEqual(copy)
  })
})

describe("paginate", () => {
  it("24 por página e página fora do intervalo cai na última", () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(paginate(items, 1).items.length).toBe(24)
    expect(paginate(items, 3).items).toEqual([48, 49])
    expect(paginate(items, 9)).toEqual({ items: [48, 49], totalPages: 3, pagina: 3 })
    expect(paginate([], 1)).toEqual({ items: [], totalPages: 1, pagina: 1 })
  })
})
