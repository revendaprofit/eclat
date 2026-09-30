import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import {
  colorValues, corDaGaleria, findOption, firstAvailableVariantId, galeriaDaCor, imagesForColor, initialSelection,
  isCompleteSelection, rotuloSelecaoIncompleta, selectedColor, sizeAvailability, sizeValues, variantFor, variantLabel,
} from "./pdp-variants"

const OPTS = [
  { id: "o_t", title: "Tamanho", values: [{ value: "M" }, { value: "P" }, { value: "G" }] },
  { id: "o_c", title: "Cor", values: [{ value: "Verde Exercito" }, { value: "Licor" }] },
]
const v = (id: string, tam: string, cor: string, qty: number, imgs: string[] = []) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty,
  options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
  images: imgs.map((url, i) => ({ id: `${id}-${i}`, url })),
})
const P = {
  id: "p1", options: OPTS,
  images: [{ id: "i1", url: "a.jpg" }, { id: "i2", url: "b.jpg" }],
  variants: [
    v("v1", "P", "Verde Exercito", 0, ["v1a.jpg"]),
    v("v2", "M", "Verde Exercito", 3, ["v2a.jpg", "v2b.jpg"]),
    v("v3", "G", "Verde Exercito", 0),
    v("v4", "P", "Licor", 2),
    v("v5", "M", "Licor", 0),
    v("v6", "G", "Licor", 0),
  ],
} as unknown as HttpTypes.StoreProduct

describe("opções e valores", () => {
  it("acha opção por título ignorando caixa; tamanhos ordenados", () => {
    expect(findOption(P, "cor")?.id).toBe("o_c")
    expect(findOption(P, "Padrão")).toBeNull()
    expect(colorValues(P)).toEqual(["Verde Exercito", "Licor"])
    expect(sizeValues(P)).toEqual(["P", "M", "G"])
  })
})

describe("variantFor / isCompleteSelection", () => {
  it("exige todas as opções; casa por valor", () => {
    expect(variantFor(P, { o_t: "M", o_c: "Verde Exercito" })?.id).toBe("v2")
    expect(variantFor(P, { o_t: "M" })).toBeNull()
    expect(isCompleteSelection(P, { o_t: "M" })).toBe(false)
    expect(isCompleteSelection(P, { o_t: "M", o_c: "Licor" })).toBe(true)
  })
  it("casa cor ignorando acento", () => {
    expect(variantFor(P, { o_t: "M", o_c: "Verde Exército" })?.id).toBe("v2")
  })
})

describe("sizeAvailability", () => {
  it("com cor: só a variante daquela cor conta", () => {
    expect(sizeAvailability(P, "Verde Exercito")).toEqual({ P: false, M: true, G: false })
    expect(sizeAvailability(P, "Licor")).toEqual({ P: true, M: false, G: false })
  })
  it("sem cor: disponível se existe em alguma cor", () => {
    expect(sizeAvailability(P, null)).toEqual({ P: true, M: true, G: false })
  })
})

describe("imagesForColor / firstAvailableVariantId", () => {
  it("primeira variante da cor com fotos; fallback do produto", () => {
    expect(imagesForColor(P, "Verde Exercito").map((i) => i.url)).toEqual(["v1a.jpg"])
    expect(imagesForColor(P, "Licor").map((i) => i.url)).toEqual(["a.jpg", "b.jpg"])
    expect(imagesForColor(P, null).map((i) => i.url)).toEqual(["a.jpg", "b.jpg"])
  })
  it("primeira variante disponível da cor, na ordem dos tamanhos", () => {
    expect(firstAvailableVariantId(P, "Verde Exercito")).toBe("v2")
    expect(firstAvailableVariantId(P, "Licor")).toBe("v4")
    expect(firstAvailableVariantId({ ...P, variants: [v("x", "P", "Licor", 0)] } as any, "Licor")).toBeNull()
  })
})

describe("galeria: cor padrão e teto de fotos", () => {
  it("sem cor escolhida usa a 1ª cor com fotos, não todas as fotos do produto", () => {
    expect(corDaGaleria(P, null)).toBe("Verde Exercito")
    expect(galeriaDaCor(P, null).map((i) => i.url)).toEqual(["v1a.jpg"])
    expect(galeriaDaCor(P, "Licor").map((i) => i.url)).toEqual(["a.jpg", "b.jpg"])
  })
  it("produto de cor única ou sem fotos por cor segue com as fotos do produto", () => {
    const unica = { ...P, options: [OPTS[0], { id: "o_c", title: "Cor", values: [{ value: "Licor" }] }] } as unknown as HttpTypes.StoreProduct
    expect(corDaGaleria(unica, null)).toBeNull()
    expect(galeriaDaCor(unica, null).map((i) => i.url)).toEqual(["a.jpg", "b.jpg"])
  })
  it("no máximo 6 fotos", () => {
    const muitas = { ...P, images: Array.from({ length: 9 }, (_, i) => ({ id: `m${i}`, url: `m${i}.jpg` })) } as unknown as HttpTypes.StoreProduct
    expect(galeriaDaCor(muitas, "Licor")).toHaveLength(6)
    expect(galeriaDaCor(muitas, "Licor", 3).map((i) => i.url)).toEqual(["m0.jpg", "m1.jpg", "m2.jpg"])
  })
})

describe("initialSelection", () => {
  it("a partir de v_id: cor e tamanho da variante", () => {
    expect(initialSelection(P, { variantId: "v4" })).toEqual({ o_t: "P", o_c: "Licor" })
  })
  it("v_id desconhecido é ignorado; cor única é pré-selecionada", () => {
    const umaCor = { ...P, options: [OPTS[0], { ...OPTS[1], values: [{ value: "Licor" }] }], variants: P.variants!.filter((x: any) => x.options[1].value === "Licor") } as any
    expect(initialSelection(umaCor, { variantId: "nope" })).toEqual({ o_c: "Licor" })
  })
  it("preferência de tamanho só entra se disponível na cor escolhida", () => {
    expect(initialSelection(P, { variantId: "v4", prefSize: "M" })).toEqual({ o_t: "P", o_c: "Licor" }) // v_id manda
    // sem cor na entrada: marca a cor da galeria (Verde, tem foto e estoque) e o M dela está disponível
    expect(initialSelection({ ...P, variants: P.variants } as any, { prefSize: "M" })).toEqual({ o_t: "M", o_c: "Verde Exercito" })
    expect(initialSelection(P, { prefSize: "G" })).toEqual({ o_c: "Verde Exercito" })                          // G esgotado: só a cor
  })
  it("produto de variante única: pré-seleciona os valores da variante mesmo sem opção Cor", () => {
    const opts = [{ id: "o_x", title: "Tamanho", values: [{ value: "Único" }] }]
    const unica = {
      id: "p2",
      options: opts,
      variants: [
        { id: "v_only", manage_inventory: true, allow_backorder: false, inventory_quantity: 1, options: [{ option_id: "o_x", value: "Único" }] },
      ],
    } as unknown as HttpTypes.StoreProduct
    expect(initialSelection(unica, {})).toEqual({ o_x: "Único" })
  })
  it("produto de variante única COM v_id: usa o ramo do v_id (mesmo resultado)", () => {
    const opts = [{ id: "o_x", title: "Tamanho", values: [{ value: "Único" }] }]
    const unica = {
      id: "p2",
      options: opts,
      variants: [
        { id: "v_only", manage_inventory: true, allow_backorder: false, inventory_quantity: 1, options: [{ option_id: "o_x", value: "Único" }] },
      ],
    } as unknown as HttpTypes.StoreProduct
    expect(initialSelection(unica, { variantId: "v_only" })).toEqual({ o_x: "Único" })
  })
})

describe("initialSelection com cor da URL do card", () => {
  it("cor reconhecida pré-seleciona com a grafia do catálogo; nunca o tamanho", () => {
    expect(initialSelection(P, { color: "verde exército" })).toEqual({ o_c: "Verde Exercito" })
  })
  it("cor não reconhecida cai na cor padrão da galeria (a cor que as fotos já mostram)", () => {
    expect(initialSelection(P, { color: "Azul" })).toEqual({ o_c: "Verde Exercito" })
  })
  it("sem ?cor=: cor da galeria; se ela estiver esgotada, a primeira cor com estoque", () => {
    expect(initialSelection(P, {})).toEqual({ o_c: "Verde Exercito" })
    const verdeEsgotado = { ...P, variants: (P.variants as any[]).map((x) => (x.options[1].value === "Verde Exercito" ? { ...x, inventory_quantity: 0 } : x)) } as any
    expect(initialSelection(verdeEsgotado, {})).toEqual({ o_c: "Licor" })
  })
  it("variantId vence sobre color", () => {
    expect(initialSelection(P, { variantId: "v4", color: "Verde Exercito" })).toEqual({ o_t: "P", o_c: "Licor" })
  })
})

describe("variantLabel / selectedColor", () => {
  it("rótulo cor / tamanho e cor selecionada", () => {
    expect(variantLabel(P, P.variants![1] as any)).toBe("Verde Exercito / M")
    expect(selectedColor(P, { o_c: "Licor" })).toBe("Licor")
    expect(selectedColor(P, {})).toBeNull()
  })
})

describe("imagesForColor: produto de uma cor so", () => {
  const OPTS1 = [
    { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
    { id: "o_c", title: "Cor", values: [{ value: "Telha" }] },
  ]
  const P1 = {
    id: "p2", options: OPTS1,
    images: [{ id: "i1", url: "telha-01.jpg" }, { id: "i2", url: "telha-07.jpg" }, { id: "i3", url: "telha-11.jpg" }],
    variants: [v("t1", "P", "Telha", 2, ["telha-01.jpg"]), v("t2", "M", "Telha", 2, ["telha-01.jpg"])],
  } as any
  it("ignora o vinculo parcial foto-variante e usa todas as fotos do produto", () => {
    expect(imagesForColor(P1, "Telha").map((i) => i.url)).toEqual(["telha-01.jpg", "telha-07.jpg", "telha-11.jpg"])
    expect(imagesForColor(P1, null).map((i) => i.url)).toEqual(["telha-01.jpg", "telha-07.jpg", "telha-11.jpg"])
  })
  it("com mais de uma cor, a foto da variante da cor continua valendo", () => {
    expect(imagesForColor(P, "Verde Exercito").map((i) => i.url)).toEqual(["v1a.jpg"])
  })
})

describe("rotuloSelecaoIncompleta", () => {
  it("com a cor marcada pede o tamanho; sem nada, o genérico", () => {
    expect(rotuloSelecaoIncompleta(P, { o_c: "Licor" })).toBe("Escolha o tamanho")
    expect(rotuloSelecaoIncompleta(P, {})).toBe("Escolha as opções")
    expect(rotuloSelecaoIncompleta(P, { o_t: "P" })).toBe("Escolha as opções")
  })
})
