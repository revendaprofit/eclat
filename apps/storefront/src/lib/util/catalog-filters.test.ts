import { describe, expect, it } from "vitest"
import {
  DEFAULT_FILTERS,
  explicitFilters,
  hasActiveFilters,
  isIndexable,
  isSelected,
  legacyRedirectQuery,
  listingHref,
  parseFilters,
  serializeFilters,
  shouldOptOut,
  toggleValue,
} from "./catalog-filters"

describe("parseFilters", () => {
  it("sem params devolve o padrão", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS)
  })
  it("lê listas, faixa, disponível, ordenação e página", () => {
    expect(
      parseFilters({ tamanho: "P, M ,,G", cor: "Licor,Verde Exército", preco: "150-220", disponivel: "1", ordenar: "menor-preco", pagina: "3" })
    ).toEqual({
      tamanho: ["P", "M", "G"],
      cor: ["Licor", "Verde Exército"],
      preco: { min: 150, max: 220 },
      disponivel: true,
      ordenar: "menor-preco",
      pagina: 3,
    })
  })
  it("faixa aberta e faixa inválida", () => {
    expect(parseFilters({ preco: "150-" }).preco).toEqual({ min: 150, max: null })
    expect(parseFilters({ preco: "-220" }).preco).toEqual({ min: null, max: 220 })
    expect(parseFilters({ preco: "abc" }).preco).toBeNull()
    expect(parseFilters({ preco: "300-100" }).preco).toEqual({ min: 100, max: 300 })
  })
  it("ordenação desconhecida e página inválida caem no padrão", () => {
    expect(parseFilters({ ordenar: "x" }).ordenar).toBe("novidades")
    expect(parseFilters({ pagina: "0" }).pagina).toBe(1)
    expect(parseFilters({ pagina: "abc" }).pagina).toBe(1)
  })
  it("aceita array (param repetido) usando o primeiro", () => {
    expect(parseFilters({ tamanho: ["P", "M"] }).tamanho).toEqual(["P"])
  })
  it("remove duplicatas de tamanho ignorando caixa", () => {
    expect(parseFilters({ tamanho: "p,P,m" }).tamanho).toEqual(["p", "m"])
  })
})

describe("serializeFilters", () => {
  it("padrão vira string vazia", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("")
  })
  it("omite página 1 e ordenação padrão; codifica acento", () => {
    const q = serializeFilters({ ...DEFAULT_FILTERS, tamanho: ["G"], cor: ["Verde Exército"], preco: { min: 150, max: null }, disponivel: true, pagina: 2, ordenar: "destaques" })
    expect(q).toBe("tamanho=G&cor=Verde+Ex%C3%A9rcito&preco=150-&disponivel=1&ordenar=destaques&pagina=2")
  })
  it("ida e volta", () => {
    const f = { ...DEFAULT_FILTERS, tamanho: ["P", "M"], cor: ["Licor"], preco: { min: null, max: 220 }, pagina: 4 }
    expect(parseFilters(Object.fromEntries(new URLSearchParams(serializeFilters(f))))).toEqual(f)
  })
})

describe("hasActiveFilters / isIndexable", () => {
  it("ordenação e página não são filtros; página > 1 tira da indexação", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, ordenar: "destaques" })).toBe(false)
    expect(isIndexable({ ...DEFAULT_FILTERS, ordenar: "destaques" })).toBe(true)
    expect(isIndexable({ ...DEFAULT_FILTERS, pagina: 2 })).toBe(false)
    expect(isIndexable({ ...DEFAULT_FILTERS, cor: ["Licor"] })).toBe(false)
  })
})

describe("isSelected / toggleValue", () => {
  it("tamanho: adiciona quando ausente", () => {
    expect(toggleValue(["P"], "M", "tamanho")).toEqual(["P", "M"])
  })
  it("tamanho: remove ignorando caixa", () => {
    expect(isSelected(["p", "M"], "P", "tamanho")).toBe(true)
    expect(toggleValue(["p", "M"], "P", "tamanho")).toEqual(["M"])
  })
  it("cor: adiciona quando ausente", () => {
    expect(toggleValue(["Licor"], "Verde Exército", "cor")).toEqual(["Licor", "Verde Exército"])
  })
  it("cor: remove ignorando acento/caixa mesmo com grafia diferente (facetas × site_content.cores)", () => {
    expect(isSelected(["Verde Exército"], "verde exercito", "cor")).toBe(true)
    expect(toggleValue(["Verde Exército"], "Verde Exercito", "cor")).toEqual([])
    expect(toggleValue(["Licor", "Verde Exército"], "verde   exército", "cor")).toEqual(["Licor"])
  })
})

describe("legacyRedirectQuery", () => {
  it("mapeia sortBy/page antigos", () => {
    expect(legacyRedirectQuery({ sortBy: "price_asc", page: "2" })).toBe("ordenar=menor-preco&pagina=2")
    expect(legacyRedirectQuery({ sortBy: "created_at" })).toBe("")
    expect(legacyRedirectQuery({ page: "1" })).toBe("")
  })
  it("sem params antigos devolve null", () => {
    expect(legacyRedirectQuery({ tamanho: "P" })).toBeNull()
  })
})

describe("listingHref", () => {
  it("sem opt-out: URL normal; com q preservado", () => {
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, cor: ["Licor"] }, false)).toBe("/br/store?cor=Licor")
    expect(listingHref("/br/store", DEFAULT_FILTERS, false)).toBe("/br/store")
    expect(listingHref("/br/busca", { ...DEFAULT_FILTERS, cor: ["Licor"] }, false, "calça preta")).toBe("/br/busca?cor=Licor&q=cal%C3%A7a+preta")
  })
  it("com opt-out: grava `tamanho=` vazio, mantendo os demais params — exceto quando o resultado já tem tamanho", () => {
    expect(listingHref("/br/store", DEFAULT_FILTERS, true)).toBe("/br/store?tamanho=")
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, ordenar: "destaques" }, true)).toBe("/br/store?tamanho=&ordenar=destaques")
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, cor: ["Licor"] }, true)).toBe("/br/store?tamanho=&cor=Licor")
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, tamanho: ["G"] }, true)).toBe("/br/store?tamanho=G")
  })
})

describe("explicitFilters", () => {
  it("remove só o tamanho implícito, ignorando caixa", () => {
    expect(explicitFilters({ ...DEFAULT_FILTERS, tamanho: ["M", "G"] }, "m")).toEqual({ ...DEFAULT_FILTERS, tamanho: ["G"] })
  })
  it("sem tamanho implícito: devolve a mesma referência", () => {
    const f = { ...DEFAULT_FILTERS, tamanho: ["M"] }
    expect(explicitFilters(f, null)).toBe(f)
    expect(explicitFilters(f, undefined)).toBe(f)
  })
})

describe("shouldOptOut", () => {
  const semTamanho = DEFAULT_FILTERS
  const comTamanho = { ...DEFAULT_FILTERS, tamanho: ["M"] }
  it("ação em outro filtro com implícito ativo: não opta por sair (o implícito não vira explícito)", () => {
    expect(shouldOptOut(semTamanho, "outro", "M", false)).toBe(false)
  })
  it("ação em tamanho, zerando a lista, com implícito ativo: opt-out", () => {
    expect(shouldOptOut(semTamanho, "tamanho", "M", false)).toBe(true)
  })
  it("limpar tudo com implícito ativo: opt-out", () => {
    expect(shouldOptOut(semTamanho, "limpar", "M", false)).toBe(true)
  })
  it("já em opt-out: preserva ao mexer em outro filtro", () => {
    expect(shouldOptOut(semTamanho, "outro", "M", true)).toBe(true)
  })
  it("sem implícito e sem opt-out prévio: nunca grava o opt-out", () => {
    expect(shouldOptOut(semTamanho, "outro", null, false)).toBe(false)
  })
  it("resultado com tamanho presente: nunca é opt-out, em nenhuma ação", () => {
    expect(shouldOptOut(comTamanho, "tamanho", "M", false)).toBe(false)
    expect(shouldOptOut(comTamanho, "outro", "M", true)).toBe(false)
  })
})
