import { describe, expect, it } from "vitest"
import { categoryPath, isAccessoryHandle, validateProductOptions } from "./catalog-rules"

const CORES = ["Verde Exército", "Licor"]
const vest = { isAccessory: false, knownColors: CORES }
const aces = { isAccessory: true, knownColors: CORES }

describe("isAccessoryHandle", () => {
  it("reconhece a raiz e as filhas", () => {
    expect(isAccessoryHandle("acessorios")).toBe(true)
    expect(isAccessoryHandle("acessorios/meias")).toBe(true)
    expect(isAccessoryHandle("tops")).toBe(false)
    expect(isAccessoryHandle("masculino/bermudas")).toBe(false)
  })
})

describe("validateProductOptions — vestuário", () => {
  it("aceita Tamanho P/M/G/GG + Cor conhecida", () => {
    const r = validateProductOptions(
      [{ title: "Tamanho", values: ["P", "M", "G", "GG"] }, { title: "Cor", values: ["Licor"] }],
      vest
    )
    expect(r).toEqual({ errors: [], warnings: [] })
  })
  it("exige as duas opções", () => {
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }], vest).errors).toContain('Vestuário precisa da opção "Tamanho".')
    expect(validateProductOptions([{ title: "Tamanho", values: ["P"] }], vest).errors).toContain('Toda peça precisa da opção "Cor".')
  })
  it("rejeita tamanho fora do padrão e título desconhecido", () => {
    const r = validateProductOptions(
      [{ title: "Tamanho", values: ["P", "XG"] }, { title: "Cor", values: ["Licor"] }, { title: "Padrão", values: ["Único"] }],
      vest
    )
    expect(r.errors).toContain("Tamanho inválido para vestuário: XG. Use P, M, G, GG.")
    expect(r.errors).toContain('Opção não permitida: "Padrão". Só "Tamanho" e "Cor".')
  })
  it("aceita título em caixa diferente mas normaliza no aviso", () => {
    const r = validateProductOptions([{ title: "tamanho", values: ["M"] }, { title: "COR", values: ["Licor"] }], vest)
    expect(r.errors).toEqual([])
    expect(r.warnings).toContain('Título de opção fora do padrão: "tamanho" (use "Tamanho").')
  })
  it("cor fora do mapa é aviso, não erro", () => {
    const r = validateProductOptions([{ title: "Tamanho", values: ["M"] }, { title: "Cor", values: ["Azul"] }], vest)
    expect(r.errors).toEqual([])
    expect(r.warnings).toContain('Cor "Azul" não está no mapa de cores (Vitrine → Cores).')
  })
  it("valores vazios ou duplicados são erro", () => {
    const r = validateProductOptions([{ title: "Tamanho", values: [] }, { title: "Cor", values: ["Licor", "licor"] }], vest)
    expect(r.errors).toContain('Opção "Tamanho" sem valores.')
    expect(r.errors).toContain('Opção "Cor" tem valores repetidos.')
  })
})

describe("validateProductOptions — acessórios", () => {
  it("Cor obrigatória, Tamanho opcional e livre", () => {
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }], aces).errors).toEqual([])
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }, { title: "Tamanho", values: ["34-38", "39-43"] }], aces).errors).toEqual([])
    expect(validateProductOptions([{ title: "Tamanho", values: ["34-38"] }], aces).errors).toContain('Toda peça precisa da opção "Cor".')
  })
})

// categoryPath: resolve o caminho completo (ex.: "acessorios/oculos") a partir da cadeia
// de parent_id — necessário porque, no Medusa, o handle de uma categoria-filha é só o
// handle simples (ex.: "oculos"), não o caminho completo.
describe("categoryPath", () => {
  const acessorios = { id: "cat_acessorios", handle: "acessorios", parent_id: null }
  const oculos = { id: "cat_oculos", handle: "oculos", parent_id: "cat_acessorios" }
  const tops = { id: "cat_tops", handle: "tops", parent_id: null }
  const all = [acessorios, oculos, tops]

  it("categoria raiz retorna o próprio handle", () => {
    expect(categoryPath(acessorios, all)).toBe("acessorios")
    expect(categoryPath(tops, all)).toBe("tops")
  })
  it("categoria filha retorna handle-pai/handle-filho", () => {
    expect(categoryPath(oculos, all)).toBe("acessorios/oculos")
  })
  it("combinado com isAccessoryHandle identifica filha de acessórios", () => {
    expect(isAccessoryHandle(categoryPath(oculos, all))).toBe(true)
    expect(isAccessoryHandle(categoryPath(tops, all))).toBe(false)
  })
})
