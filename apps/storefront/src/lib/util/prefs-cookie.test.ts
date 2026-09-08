import { describe, expect, it } from "vitest"
import { applyPreferredSize, parsePrefsCookie } from "./prefs-cookie"
import { DEFAULT_FILTERS } from "./catalog-filters"

describe("parsePrefsCookie", () => {
  it("lê o cookie espelho codificado (encodeURIComponent) ou cru", () => {
    const raw = encodeURIComponent(JSON.stringify({ tamanho: "m", estilos: ["legging", 3], wizard_done: true, persona_id: "p1" }))
    expect(parsePrefsCookie(raw)).toEqual({ tamanho: "M", estilos: ["legging"], wizard_done: true, persona_id: "p1" })
    expect(parsePrefsCookie('{"tamanho":"GG"}')).toEqual({ tamanho: "GG" })
  })
  it("tamanho fora da grade, JSON inválido ou vazio → sem preferência", () => {
    expect(parsePrefsCookie('{"tamanho":"XXL"}')).toEqual({})
    expect(parsePrefsCookie("%7B")).toEqual({})
    expect(parsePrefsCookie(undefined)).toEqual({})
    expect(parsePrefsCookie("[1]")).toEqual({})
  })
})

describe("applyPreferredSize", () => {
  const prefs = { tamanho: "M" }
  it("URL sem filtro e sem o param tamanho → aplica o tamanho salvo, URL intacta", () => {
    expect(applyPreferredSize(DEFAULT_FILTERS, {}, prefs)).toEqual({ filters: { ...DEFAULT_FILTERS, tamanho: ["M"] }, implicitSize: "M" })
    expect(applyPreferredSize({ ...DEFAULT_FILTERS, pagina: 2, ordenar: "destaques" }, { pagina: "2", ordenar: "destaques" }, prefs).implicitSize).toBe("M")
  })
  it("qualquer filtro explícito, ou `tamanho=` vazio (opt-out), ou sem preferência → não mexe", () => {
    const comCor = { ...DEFAULT_FILTERS, cor: ["Licor"] }
    expect(applyPreferredSize(comCor, { cor: "Licor" }, prefs)).toEqual({ filters: comCor, implicitSize: null })
    expect(applyPreferredSize(DEFAULT_FILTERS, { tamanho: "" }, prefs)).toEqual({ filters: DEFAULT_FILTERS, implicitSize: null })
    expect(applyPreferredSize(DEFAULT_FILTERS, {}, {})).toEqual({ filters: DEFAULT_FILTERS, implicitSize: null })
  })
})
