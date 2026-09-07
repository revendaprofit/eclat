import { describe, expect, it } from "vitest"
import { isMeasureTable, pickMeasurements } from "./measurements"

const T = (c: string[]) => ({ columns: c, rows: [["P", ...c.map(() => "1")], ["M", ...c.map(() => "2")]] })
const MAP = {
  leggings: T(["Cintura", "Quadril"]),
  masculino: T(["Cintura", "Quadril"]),
  "masculino/camisetas-regatas": T(["Tórax", "Comprimento"]),
}

describe("pickMeasurements", () => {
  it("acha pelo caminho completo", () => {
    expect(pickMeasurements(MAP, "masculino/camisetas-regatas")?.columns).toEqual(["Tórax", "Comprimento"])
  })
  it("subcategoria sem tabela herda da mãe", () => {
    expect(pickMeasurements(MAP, "masculino/bermudas")?.columns).toEqual(["Cintura", "Quadril"])
  })
  it("sem tabela em nenhum nível devolve null (acessórios)", () => {
    expect(pickMeasurements(MAP, "acessorios/oculos")).toBeNull()
    expect(pickMeasurements(null, "leggings")).toBeNull()
  })
  it("ignora barra inicial/final", () => {
    expect(pickMeasurements(MAP, "/leggings/")).not.toBeNull()
  })
})

describe("isMeasureTable", () => {
  it("valida forma", () => {
    expect(isMeasureTable({ columns: ["a"], rows: [["P", "1"]] })).toBe(true)
    expect(isMeasureTable({ columns: "a", rows: [] })).toBe(false)
    expect(isMeasureTable(null)).toBe(false)
  })
})
