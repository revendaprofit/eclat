import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { badgeFor, buildProductCardData } from "./product-card-data"

const OPTS = [
  { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
  { id: "o_c", title: "Cor", values: [{ value: "Verde Exercito" }, { value: "Licor" }] },
]
const v = (id: string, tam: string, cor: string, qty: number, imgs: string[] = []) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty,
  options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
  images: imgs.map((url, i) => ({ id: `${id}-${i}`, url })),
  calculated_price: { calculated_amount: 219, original_amount: 259, currency_code: "brl", calculated_price: { price_list_type: "sale" } },
})
const P = {
  id: "p1", handle: "legging-vertice", title: "Legging Vértice", created_at: "2026-09-01T00:00:00Z", thumbnail: "t.jpg",
  images: [{ id: "i1", url: "a.jpg" }, { id: "i2", url: "b.jpg" }], options: OPTS,
  variants: [v("v1", "M", "Verde Exercito", 2, ["verde1.jpg", "verde2.jpg"]), v("v2", "P", "Verde Exercito", 0), v("v3", "P", "Licor", 0), v("v4", "M", "Licor", 0)],
} as unknown as HttpTypes.StoreProduct
const MAP = { "Verde Exército": { hex: "#3B4A2F", swatch_url: null } }
const NOW = Date.parse("2026-09-08T00:00:00Z")

describe("buildProductCardData", () => {
  const d = buildProductCardData(P, MAP, NOW)
  it("cores na ordem da opção, resolvidas pelo mapa", () => {
    expect(d.colors.map((c) => c.name)).toEqual(["Verde Exército", "Licor"])
    expect(d.colors[0].hex).toBe("#3B4A2F")
    expect(d.colors[1].known).toBe(false)
  })
  it("imagens por cor da primeira variante com fotos; fallback do produto", () => {
    expect(d.colors[0].images).toEqual(["verde1.jpg", "verde2.jpg"])
    expect(d.colors[1].images).toEqual(["t.jpg", "a.jpg", "b.jpg"])
  })
  it("tamanhos ordenados, disponibilidade por variante e por cor", () => {
    expect(d.colors[0].variants).toEqual([{ id: "v2", size: "P", available: false }, { id: "v1", size: "M", available: true }])
    expect(d.colors[0].available).toBe(true)
    expect(d.colors[0].lowStock).toBe(true)
    expect(d.colors[0].firstAvailableVariantId).toBe("v1")
    expect(d.colors[1].available).toBe(false)
    expect(d.colors[1].firstAvailableVariantId).toBeNull()
  })
  it("preço, promoção, novo e disponibilidade do produto", () => {
    expect(d.price?.price_type).toBe("sale")
    expect(d.onSale).toBe(true)
    expect(d.isNew).toBe(true)
    expect(d.available).toBe(true)
  })
  it("produto sem opção Cor vira uma cor única sem nome", () => {
    const semCor = { ...P, options: [OPTS[0]], variants: P.variants!.map((x) => ({ ...x, options: [x.options![0]] })) } as unknown as HttpTypes.StoreProduct
    const s = buildProductCardData(semCor, MAP, NOW)
    expect(s.colors.length).toBe(1)
    expect(s.colors[0].name).toBe("")
    expect(s.colors[0].variants.length).toBe(4)
    // v1=M, v2=P, v3=P, v4=M (ordem original) -> tamanhos distintos ordenados [P, M]; dentro de cada
    // tamanho mantém a ordem original das variantes: P -> v2,v3; M -> v1,v4.
    expect(s.colors[0].variants.map((v) => v.id)).toEqual(["v2", "v3", "v1", "v4"])
  })
  it("duas variantes do mesmo tamanho numa cor: nenhuma some, disponibilidade correta", () => {
    const dup = {
      ...P,
      variants: [
        v("va", "M", "Verde Exercito", 0),
        v("vb", "M", "Verde Exercito", 5),
      ],
    } as unknown as HttpTypes.StoreProduct
    const s = buildProductCardData(dup, MAP, NOW)
    const cor = s.colors.find((c) => c.name === "Verde Exército")!
    expect(cor.variants.map((x) => x.id)).toEqual(["va", "vb"])
    expect(cor.variants.map((x) => x.available)).toEqual([false, true])
    expect(cor.available).toBe(true)
    expect(cor.firstAvailableVariantId).toBe("vb")
  })
  it("formaConjunto: false por padrão, true quando o chamador passa (selo do card)", () => {
    expect(d.formaConjunto).toBe(false)
    const comSelo = buildProductCardData(P, MAP, NOW, true)
    expect(comSelo.formaConjunto).toBe(true)
  })
  it("lowStock do bucket sem cor segue isLowStock (estoque total <= 3)", () => {
    const semCorBaixo = {
      ...P,
      options: [OPTS[0]],
      variants: [v("v1", "M", "Verde Exercito", 2, []), v("v2", "P", "Licor", 1, [])].map((x) => ({
        ...x,
        options: [x.options![0]],
      })),
    } as unknown as HttpTypes.StoreProduct
    const s = buildProductCardData(semCorBaixo, MAP, NOW)
    expect(s.colors[0].name).toBe("")
    expect(s.colors[0].lowStock).toBe(true)
  })
})

describe("badgeFor", () => {
  const d = buildProductCardData(P, MAP, NOW)
  it("prioridade esgotado › ultimas › promo › novo", () => {
    expect(badgeFor(d, 1)).toBe("esgotado")
    expect(badgeFor(d, 0)).toBe("ultimas")
    expect(badgeFor({ ...d, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBe("promo")
    expect(badgeFor({ ...d, onSale: false, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBe("novo")
    expect(badgeFor({ ...d, onSale: false, isNew: false, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBeNull()
  })
})
