import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import {
  conjuntoDisponivel,
  corParceira,
  descontoConjunto,
  descricaoRegra,
  elegibilidade,
  formatarReais,
  montarCardCurado,
  montarCardPar,
  precoMinDisponivel,
  precosConjunto,
  slotMetadata,
  totalDoConjunto,
  type CuradoStore,
  type ParStore,
  type PecaCard,
  type RegraStore,
  type VitrineStore,
} from "./conjuntos"

// ---------- helpers de fixture ----------
const OPTS = [
  { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }, { value: "G" }] },
  { id: "o_c", title: "Cor", values: [{ value: "Verde Exército" }, { value: "Licor" }] },
]
const variante = (
  id: string,
  tam: string,
  cor: string,
  amount: number | null,
  extra: Partial<{ manage_inventory: boolean; allow_backorder: boolean; inventory_quantity: number }> = {}
) => ({
  id,
  manage_inventory: extra.manage_inventory ?? true,
  allow_backorder: extra.allow_backorder ?? false,
  inventory_quantity: extra.inventory_quantity ?? 5,
  options: [
    { option_id: "o_t", value: tam },
    { option_id: "o_c", value: cor },
  ],
  calculated_price: amount === null ? null : { calculated_amount: amount },
})
const produto = (id: string, title: string, thumbnail: string | null, variants: ReturnType<typeof variante>[], options = OPTS) =>
  ({ id, handle: id, title, thumbnail, options, variants } as unknown as HttpTypes.StoreProduct)

describe("descontoConjunto", () => {
  const precos = [18900, 25900]

  it("menor_peca_percentual: desconta só a peça mais barata", () => {
    const regra: RegraStore = { tipo_desconto: "menor_peca_percentual", valor: 20 }
    expect(descontoConjunto(regra, precos)).toEqual([3780, 0])
  })

  it("menor_peca_valor: desconta valor fixo só na mais barata", () => {
    const regra: RegraStore = { tipo_desconto: "menor_peca_valor", valor: 5000 }
    expect(descontoConjunto(regra, precos)).toEqual([5000, 0])
  })

  it("total_percentual: desconta o percentual em cada peça", () => {
    const regra: RegraStore = { tipo_desconto: "total_percentual", valor: 10 }
    expect(descontoConjunto(regra, precos)).toEqual([1890, 2590])
  })

  it("total_valor: reparte o valor igualmente entre as peças", () => {
    const regra: RegraStore = { tipo_desconto: "total_valor", valor: 4500 }
    expect(descontoConjunto(regra, precos)).toEqual([2250, 2250])
  })

  it("nunca passa do preço da própria unidade", () => {
    const barata = [1000, 25900]
    expect(descontoConjunto({ tipo_desconto: "menor_peca_valor", valor: 5000 }, barata)).toEqual([1000, 0])
    expect(descontoConjunto({ tipo_desconto: "menor_peca_percentual", valor: 200 }, barata)).toEqual([1000, 0])
    expect(descontoConjunto({ tipo_desconto: "total_valor", valor: 100000 }, barata)).toEqual([1000, 25900])
  })

  it("empate no menor preço: fica com a primeira", () => {
    expect(descontoConjunto({ tipo_desconto: "menor_peca_percentual", valor: 20 }, [10000, 10000])).toEqual([2000, 0])
  })
})

describe("precoMinDisponivel", () => {
  it("ignora variante esgotada", () => {
    const p = produto("p1", "Top", null, [
      variante("v1", "P", "Verde Exército", 189, { manage_inventory: true, allow_backorder: false, inventory_quantity: 0 }),
      variante("v2", "M", "Verde Exército", 199, { manage_inventory: true, allow_backorder: false, inventory_quantity: 3 }),
    ])
    expect(precoMinDisponivel(p)).toBe(19900)
  })

  it("manage_inventory: false conta mesmo sem quantidade", () => {
    const p = produto("p1", "Top", null, [
      variante("v1", "P", "Verde Exército", 149, { manage_inventory: false, inventory_quantity: 0 }),
    ])
    expect(precoMinDisponivel(p)).toBe(14900)
  })

  it("sem variante com preço calculado → null", () => {
    const p = produto("p1", "Top", null, [variante("v1", "P", "Verde Exército", null, { manage_inventory: false })])
    expect(precoMinDisponivel(p)).toBeNull()
  })

  it("sem nenhuma variante disponível → null", () => {
    const p = produto("p1", "Top", null, [
      variante("v1", "P", "Verde Exército", 189, { manage_inventory: true, allow_backorder: false, inventory_quantity: 0 }),
    ])
    expect(precoMinDisponivel(p)).toBeNull()
  })
})

describe("precosConjunto", () => {
  it("cheio, com benefício e economia", () => {
    const regra: RegraStore = { tipo_desconto: "menor_peca_percentual", valor: 20 }
    expect(precosConjunto(regra, [18900, 25900])).toEqual({ cheio: 44800, comBeneficio: 41020, economia: 3780 })
  })
})

describe("conjuntoDisponivel", () => {
  it("true só quando todas as peças têm preço", () => {
    const ok: PecaCard[] = [
      { id: "1", handle: "a", title: "A", thumbnail: null, precoMin: 100 },
      { id: "2", handle: "b", title: "B", thumbnail: null, precoMin: 200 },
    ]
    expect(conjuntoDisponivel(ok)).toBe(true)
    expect(conjuntoDisponivel([...ok, { id: "3", handle: "c", title: "C", thumbnail: null, precoMin: null }])).toBe(false)
  })
})

describe("montarCardPar", () => {
  const regra: RegraStore = { tipo_desconto: "menor_peca_percentual", valor: 20 }
  const top = produto("prod_top", "Top Aura", "top.jpg", [variante("v1", "M", "Verde Exército", 189)])
  const legging = produto("prod_leg", "Legging Vértice", "leg.jpg", [variante("v2", "M", "Verde Exército", 259)])
  const par: ParStore = { handle: "top-aura--legging-vertice", categoria_a: "tops", categoria_b: "leggings", product_ids: ["prod_top", "prod_leg"] }

  it("monta nome, fotos e preços do par", () => {
    const produtos = new Map([[top.id, top], [legging.id, legging]])
    const card = montarCardPar(par, "col_1", regra, produtos)
    expect(card).not.toBeNull()
    expect(card!.nome).toBe("Top Aura + Legging Vértice")
    expect(card!.pecas.map((p) => p.thumbnail)).toEqual(["top.jpg", "leg.jpg"])
    expect(card!.precoCheio).toBe(44800)
    expect(card!.precoComBeneficio).toBe(41020)
    expect(card!.economia).toBe(3780)
    expect(card!.collection_id).toBe("col_1")
    expect(card!.tipo).toBe("colecao")
  })

  it("peça esgotada → null", () => {
    const esgotado = produto("prod_top", "Top Aura", "top.jpg", [
      variante("v1", "M", "Verde Exército", 189, { manage_inventory: true, allow_backorder: false, inventory_quantity: 0 }),
    ])
    const produtos = new Map([[esgotado.id, esgotado], [legging.id, legging]])
    expect(montarCardPar(par, "col_1", regra, produtos)).toBeNull()
  })

  it("produto ausente do mapa → null", () => {
    const produtos = new Map([[top.id, top]])
    expect(montarCardPar(par, "col_1", regra, produtos)).toBeNull()
  })
})

describe("montarCardCurado", () => {
  const regra: RegraStore = { tipo_desconto: "total_valor", valor: 4500 }
  const top = produto("prod_top", "Top Aura", "top.jpg", [variante("v1", "M", "Verde Exército", 189)])
  const legging = produto("prod_leg", "Legging Vértice", "leg.jpg", [variante("v2", "M", "Verde Exército", 259)])
  const produtos = new Map([[top.id, top], [legging.id, legging]])

  it("usa a capa do cadastro quando existe", () => {
    const c: CuradoStore = { id: "ccur_1", nome: "Look Blackout", handle: "look-blackout", capa_url: "capa.jpg", product_ids: ["prod_top", "prod_leg"], regra }
    const card = montarCardCurado(c, produtos)
    expect(card).not.toBeNull()
    expect(card!.nome).toBe("Look Blackout")
    expect(card!.capa).toBe("capa.jpg")
    expect(card!.tipo).toBe("curado")
    expect(card!.collection_id).toBeNull()
  })

  it("sem capa cadastrada → capa null e fotos das peças presentes", () => {
    const c: CuradoStore = { id: "ccur_1", nome: "Look Blackout", handle: "look-blackout", capa_url: null, product_ids: ["prod_top", "prod_leg"], regra }
    const card = montarCardCurado(c, produtos)
    expect(card!.capa).toBeNull()
    expect(card!.pecas.map((p) => p.thumbnail)).toEqual(["top.jpg", "leg.jpg"])
  })

  it("produto ausente → null", () => {
    const c: CuradoStore = { id: "ccur_1", nome: "Look Blackout", handle: "look-blackout", capa_url: null, product_ids: ["prod_top", "prod_inexistente"], regra }
    expect(montarCardCurado(c, produtos)).toBeNull()
  })
})

describe("descricaoRegra", () => {
  it("menor_peca_percentual", () => {
    expect(descricaoRegra({ tipo_desconto: "menor_peca_percentual", valor: 20 }, 2)).toBe("20% na peça de menor valor")
    expect(descricaoRegra({ tipo_desconto: "menor_peca_percentual", valor: 20 }, 3)).toBe("20% na peça de menor valor")
  })
  it("menor_peca_valor", () => {
    expect(descricaoRegra({ tipo_desconto: "menor_peca_valor", valor: 5000 }, 2)).toBe("R$ 50,00 na peça de menor valor")
    expect(descricaoRegra({ tipo_desconto: "menor_peca_valor", valor: 5000 }, 3)).toBe("R$ 50,00 na peça de menor valor")
  })
  it("total_percentual", () => {
    expect(descricaoRegra({ tipo_desconto: "total_percentual", valor: 10 }, 2)).toBe("10% sobre o conjunto")
    expect(descricaoRegra({ tipo_desconto: "total_percentual", valor: 10 }, 3)).toBe("10% sobre o conjunto")
  })
  it("total_valor: reparte pelo n informado", () => {
    expect(descricaoRegra({ tipo_desconto: "total_valor", valor: 4500 }, 2)).toBe("R$ 45,00 no conjunto (R$ 22,50 por peça)")
    expect(descricaoRegra({ tipo_desconto: "total_valor", valor: 4500 }, 3)).toBe("R$ 45,00 no conjunto (R$ 15,00 por peça)")
  })
})

describe("corParceira", () => {
  it("cor atual disponível na parceira → grafia canônica da parceira", () => {
    const parceira = produto("p_leg", "Legging", null, [variante("v1", "M", "Verde Exército", 259)])
    expect(corParceira(parceira, "Verde Exercito")).toBe("Verde Exército")
  })

  it("parceira sem a cor atual → primeira cor disponível", () => {
    const parceira = produto("p_leg", "Legging", null, [variante("v1", "M", "Licor", 259)])
    expect(corParceira(parceira, "Verde Exército")).toBe("Licor")
  })

  it("nenhuma cor disponível → null", () => {
    const parceira = produto("p_leg", "Legging", null, [
      variante("v1", "M", "Licor", 259, { manage_inventory: true, allow_backorder: false, inventory_quantity: 0 }),
    ])
    expect(corParceira(parceira, "Verde Exército")).toBeNull()
  })
})

describe("elegibilidade", () => {
  const vitrine: VitrineStore = {
    curados: [
      {
        id: "ccur_1",
        nome: "Look Blackout",
        handle: "look-blackout",
        capa_url: null,
        product_ids: ["prod_top", "prod_leg"],
        regra: { tipo_desconto: "total_valor", valor: 4500 },
      },
    ],
    colecoes: [
      {
        collection_id: "col_1",
        regra: { tipo_desconto: "menor_peca_percentual", valor: 20 },
        pares: [{ handle: "a--b", categoria_a: "tops", categoria_b: "leggings", product_ids: ["a", "b"] }],
      },
    ],
  }
  const raizes = new Map([
    ["cat_top", "tops"],
    ["cat_leg", "leggings"],
    ["cat_short", "shorts"],
  ])

  it("coleção com regra + categoria cuja raiz está num par → true", () => {
    expect(elegibilidade(vitrine, raizes)("a", "col_1", ["cat_top"])).toBe(true)
  })

  it("raiz fora dos pares da coleção → false", () => {
    expect(elegibilidade(vitrine, raizes)("a", "col_1", ["cat_short"])).toBe(false)
  })

  it("sem coleção (null) → false", () => {
    expect(elegibilidade(vitrine, raizes)("a", null, ["cat_top"])).toBe(false)
  })

  it("coleção sem entrada na vitrine → false", () => {
    expect(elegibilidade(vitrine, raizes)("a", "col_desconhecida", ["cat_top"])).toBe(false)
  })

  it("produto em curado ativo, sem par listado da coleção → true (ruling V4)", () => {
    expect(elegibilidade(vitrine, raizes)("prod_leg", null, ["cat_leg"])).toBe(true)
    expect(elegibilidade(vitrine, raizes)("prod_leg", "col_desconhecida", ["cat_short"])).toBe(true)
  })

  it("produto sem par listado e sem curado → false", () => {
    expect(elegibilidade(vitrine, raizes)("prod_inexistente", "col_1", ["cat_short"])).toBe(false)
  })
})

describe("slotMetadata", () => {
  it("formato <handle>#<i>#<ts>", () => {
    expect(slotMetadata("look-blackout", 0, 1700000000000)).toEqual({ conjunto_slot: "look-blackout#0#1700000000000" })
    expect(slotMetadata("look-blackout", 1, 1700000000000)).toEqual({ conjunto_slot: "look-blackout#1#1700000000000" })
  })
})

describe("formatarReais", () => {
  it("formata centavos como reais pt-BR", () => {
    expect(formatarReais(123456)).toBe("R$ 1.234,56")
    expect(formatarReais(5000)).toBe("R$ 50,00")
    expect(formatarReais(0)).toBe("R$ 0,00")
  })
})

describe("pecaCard thumbnail fallback", () => {
  it("fallback para images[0].url quando thumbnail é nulo", () => {
    const regra: RegraStore = { tipo_desconto: "menor_peca_percentual", valor: 20 }
    const top = {
      id: "prod_top",
      handle: "top-aura",
      title: "Top Aura",
      thumbnail: null,
      images: [{ url: "fallback-top.jpg" }],
      options: OPTS,
      variants: [variante("v1", "M", "Verde Exército", 189)],
    } as unknown as HttpTypes.StoreProduct
    const par: ParStore = { handle: "top-aura", categoria_a: "tops", categoria_b: "tops", product_ids: ["prod_top"] }
    const produtos = new Map([[top.id, top]])
    const card = montarCardPar(par, "col_1", regra, produtos)
    expect(card!.pecas[0].thumbnail).toBe("fallback-top.jpg")
  })
})

describe("totalDoConjunto", () => {
  const pecas: PecaCard[] = [
    { id: "p1", handle: "legging", title: "Legging", thumbnail: null, precoMin: 18900 },
    { id: "p2", handle: "top", title: "Top", thumbnail: null, precoMin: 25900 },
  ]
  const regra: RegraStore = { tipo_desconto: "menor_peca_percentual", valor: 20 }

  it("nenhuma peça selecionada: usa o precoMin de cada uma (mesmo total do card)", () => {
    expect(totalDoConjunto([null, null], pecas, regra)).toEqual({ cheio: 44800, comBeneficio: 41020, economia: 3780 })
  })

  it("peça selecionada usa o preço da variante escolhida, não o precoMin", () => {
    expect(totalDoConjunto([19900, null], pecas, regra)).toEqual({ cheio: 45800, comBeneficio: 41820, economia: 3980 })
  })

  it("as duas peças selecionadas: total só com os preços escolhidos", () => {
    expect(totalDoConjunto([19900, 24900], pecas, regra)).toEqual({ cheio: 44800, comBeneficio: 40820, economia: 3980 })
  })

  it("peça sem precoMin (null) e sem seleção conta como 0", () => {
    const semPreco: PecaCard[] = [{ id: "p3", handle: "x", title: "X", thumbnail: null, precoMin: null }]
    expect(totalDoConjunto([null], semPreco, regra)).toEqual({ cheio: 0, comBeneficio: 0, economia: 0 })
  })
})
