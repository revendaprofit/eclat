import { describe, expect, it } from "vitest"
import {
  colorStock,
  isLowStock,
  isNew,
  isProductAvailable,
  isVariantAvailable,
  optionValue,
  variantsOfColor,
} from "./availability"

const OPTS = [
  { id: "opt_tam", title: "Tamanho" },
  { id: "opt_cor", title: "Cor" },
]
const v = (id: string, tam: string, cor: string, qty: number, extra = {}) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: qty,
  options: [
    { option_id: "opt_tam", value: tam },
    { option_id: "opt_cor", value: cor },
  ],
  ...extra,
})
const PRODUCT = {
  options: OPTS,
  variants: [
    v("v1", "P", "Verde Exército", 2),
    v("v2", "M", "Verde Exército", 0),
    v("v3", "P", "Licor", 5),
    v("v4", "M", "Licor", 0, { allow_backorder: true }),
  ],
}

describe("isVariantAvailable", () => {
  it("disponível quando não gerencia estoque", () => {
    expect(isVariantAvailable({ manage_inventory: false, inventory_quantity: 0 })).toBe(true)
  })
  it("disponível com backorder mesmo sem estoque", () => {
    expect(isVariantAvailable({ manage_inventory: true, allow_backorder: true, inventory_quantity: 0 })).toBe(true)
  })
  it("indisponível com estoque zero", () => {
    expect(isVariantAvailable({ manage_inventory: true, inventory_quantity: 0 })).toBe(false)
  })
  it("disponível com estoque positivo", () => {
    expect(isVariantAvailable({ manage_inventory: true, inventory_quantity: 1 })).toBe(true)
  })
})

describe("isProductAvailable", () => {
  it("true se alguma variante está disponível", () => {
    expect(isProductAvailable(PRODUCT.variants)).toBe(true)
  })
  it("false sem variantes ou todas esgotadas", () => {
    expect(isProductAvailable([])).toBe(false)
    expect(isProductAvailable(null)).toBe(false)
    expect(isProductAvailable([v("x", "P", "Licor", 0)])).toBe(false)
  })
})

describe("optionValue / variantsOfColor", () => {
  it("lê o valor pelo título da opção", () => {
    expect(optionValue(OPTS, PRODUCT.variants[0], "Cor")).toBe("Verde Exército")
    expect(optionValue(OPTS, PRODUCT.variants[0], "Tamanho")).toBe("P")
    expect(optionValue(OPTS, PRODUCT.variants[0], "Inexistente")).toBeNull()
  })
  it("filtra variantes de uma cor", () => {
    expect(variantsOfColor(PRODUCT, "Licor").map((x) => x.id)).toEqual(["v3", "v4"])
  })
  it("filtra variantes de uma cor ignorando acento/caixa (normalizeColorName)", () => {
    const PRODUTO_SEM_ACENTO = {
      options: OPTS,
      variants: [v("w1", "P", "Verde Exercito", 4)],
    }
    expect(variantsOfColor(PRODUTO_SEM_ACENTO, "Verde Exército").map((x) => x.id)).toEqual(["w1"])
  })
})

describe("colorStock / isLowStock", () => {
  it("soma só o estoque numérico das variantes disponíveis da cor", () => {
    expect(colorStock(PRODUCT, "Verde Exército")).toBe(2)
    expect(colorStock(PRODUCT, "Licor")).toBe(5) // backorder sem quantidade não soma
  })
  it("últimas peças com 3 ou menos", () => {
    expect(isLowStock(PRODUCT, "Verde Exército")).toBe(true)
    expect(isLowStock(PRODUCT, "Licor")).toBe(false)
    expect(isLowStock(PRODUCT, "Licor", 5)).toBe(true)
  })
  it("cor totalmente esgotada não é 'últimas peças'", () => {
    expect(isLowStock({ options: OPTS, variants: [v("z", "P", "Preto", 0)] }, "Preto")).toBe(false)
  })
})

describe("isNew", () => {
  const now = Date.parse("2026-09-07T12:00:00Z")
  it("novo se criado há menos de 30 dias", () => {
    expect(isNew({ created_at: "2026-08-20T00:00:00Z" }, now)).toBe(true)
    expect(isNew({ created_at: "2026-07-01T00:00:00Z" }, now)).toBe(false)
  })
  it("novo se tem a tag 'novo', em qualquer caixa", () => {
    expect(isNew({ created_at: "2026-01-01T00:00:00Z", tags: [{ value: "Novo" }] }, now)).toBe(true)
  })
  it("sem data e sem tag não é novo", () => {
    expect(isNew({}, now)).toBe(false)
  })
})
