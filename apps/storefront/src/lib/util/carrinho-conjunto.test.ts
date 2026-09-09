import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import {
  agruparDescontos,
  avisoCupom,
  cuponsVisiveis,
  ehAjusteConjunto,
  etiquetaDoPedido,
  etiquetasDoCarrinho,
  montarGatilhos,
  slotGatilho,
  tituloGatilho,
  type ConjuntoFormadoStore,
  type Gatilho,
} from "./carrinho-conjunto"

const conj = (id: string, itens: string[]): ConjuntoFormadoStore => ({
  id,
  tipo: "colecao",
  regra_id: "creg_1",
  unidades: itens.map((item_id) => ({ item_id, product_id: "p", preco_unitario: 18900, desconto_unitario: 0 })),
})

const produto = (id: string, disponivel = true): HttpTypes.StoreProduct =>
  ({
    id,
    title: `Produto ${id}`,
    handle: id,
    variants: [
      {
        id: `v-${id}`,
        manage_inventory: true,
        inventory_quantity: disponivel ? 3 : 0,
        allow_backorder: false,
        calculated_price: { calculated_amount: 189 },
      },
    ],
  }) as unknown as HttpTypes.StoreProduct

describe("ehAjusteConjunto", () => {
  it("reconhece o prefixo CONJUNTO-", () => {
    expect(ehAjusteConjunto("CONJUNTO-creg_1")).toBe(true)
    expect(ehAjusteConjunto("CUPOM10")).toBe(false)
    expect(ehAjusteConjunto(undefined)).toBe(false)
    expect(ehAjusteConjunto(null)).toBe(false)
  })
})

describe("agruparDescontos", () => {
  it("separa conjunto de cupom, em centavos, sem erro de ponto flutuante", () => {
    const g = agruparDescontos([
      { id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] },
      { id: "b", quantity: 1, adjustments: [{ code: "CUPOM10", amount: 25.9 }, { code: "CONJUNTO-creg_1", amount: 0.1 }] },
    ])
    expect(g).toEqual({ conjunto: 1900, cupom: 2590 })
  })
  it("tolera itens sem ajustes e lista vazia", () => {
    expect(agruparDescontos([{ id: "a", quantity: 1 }])).toEqual({ conjunto: 0, cupom: 0 })
    expect(agruparDescontos(undefined)).toEqual({ conjunto: 0, cupom: 0 })
  })
})

describe("etiquetasDoCarrinho", () => {
  const itens = [
    { id: "top", quantity: 2 },
    { id: "legging", quantity: 1 },
    { id: "short", quantity: 1 },
    { id: "meia", quantity: 1 },
  ]
  it("um conjunto → 'Conjunto' nas linhas dele, nada nas outras", () => {
    const e = etiquetasDoCarrinho([conj("c1", ["top", "legging"])], itens)
    expect(e.legging).toBe("Conjunto")
    expect(e.top).toBe("Conjunto (1 de 2)")
    expect(e.short).toBeUndefined()
    expect(e.meia).toBeUndefined()
  })
  it("dois conjuntos → numerados; linha em ambos lista os dois", () => {
    const e = etiquetasDoCarrinho([conj("c1", ["top", "legging"]), conj("c2", ["top", "short"])], itens)
    expect(e.legging).toBe("Conjunto 1/2")
    expect(e.short).toBe("Conjunto 2/2")
    expect(e.top).toBe("Conjunto 1/2 · Conjunto 2/2")
  })
  it("sem conjuntos → objeto vazio", () => {
    expect(etiquetasDoCarrinho([], itens)).toEqual({})
  })
})

describe("etiquetaDoPedido", () => {
  it("por ajuste CONJUNTO- ou por conjunto_slot; senão null", () => {
    expect(etiquetaDoPedido({ id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-x", amount: 1 }] })).toBe("Conjunto")
    expect(etiquetaDoPedido({ id: "b", quantity: 1, metadata: { conjunto_slot: "look#0#1" } })).toBe("Conjunto")
    expect(etiquetaDoPedido({ id: "c", quantity: 1, adjustments: [{ code: "CUPOM10", amount: 1 }] })).toBeNull()
    expect(etiquetaDoPedido({ id: "d", quantity: 1 })).toBeNull()
  })
})

describe("cuponsVisiveis / avisoCupom", () => {
  const promos = [{ code: "CONJUNTO-creg_1" }, { code: "CUPOM10" }]
  it("esconde promoções CONJUNTO-", () => {
    expect(cuponsVisiveis(promos).map((p) => p.code)).toEqual(["CUPOM10"])
    expect(cuponsVisiveis(undefined)).toEqual([])
  })
  it("aviso só com cupom visível E benefício no carrinho", () => {
    const comConjunto = [{ id: "a", quantity: 1, adjustments: [{ code: "CONJUNTO-creg_1", amount: 18.9 }] }]
    expect(avisoCupom({ promotions: promos, items: comConjunto })).toBe(true)
    expect(avisoCupom({ promotions: [{ code: "CONJUNTO-creg_1" }], items: comConjunto })).toBe(false)
    expect(avisoCupom({ promotions: promos, items: [{ id: "a", quantity: 1 }] })).toBe(false)
  })
})

describe("montarGatilhos / tituloGatilho / slotGatilho", () => {
  const colecoes = [{ collection_id: "col_1", regra: { tipo_desconto: "menor_peca_percentual" as const, valor: 20 }, pares: [] }]
  const produtos = new Map<string, HttpTypes.StoreProduct>([
    ["p1", produto("p1")],
    ["p2", produto("p2", false)],
    ["p3", produto("p3")],
  ])
  const oportunidade = { collection_id: "col_1", categoria_faltante: "tops", a_partir_do_item_id: "legging", candidatos: ["p1", "p2", "p3", "p-fantasma"] }
  it("hidrata candidatas disponíveis na ordem, com nomes de coleção e categoria", () => {
    const g = montarGatilhos([oportunidade], produtos, colecoes, new Map([["col_1", "Família Blackout"]]), new Map([["tops", "Tops"]]))
    expect(g).toHaveLength(1)
    expect(g[0].candidatas.map((p) => p.id)).toEqual(["p1", "p3"])
    expect(g[0].colecaoNome).toBe("Família Blackout")
    expect(g[0].categoriaNome).toBe("Tops")
    expect(g[0].regra.valor).toBe(20)
  })
  it("descarta oportunidade sem candidata disponível ou sem regra da coleção", () => {
    expect(montarGatilhos([{ ...oportunidade, candidatos: ["p2"] }], produtos, colecoes, new Map(), new Map())).toEqual([])
    expect(montarGatilhos([{ ...oportunidade, collection_id: "col_x" }], produtos, colecoes, new Map(), new Map())).toEqual([])
  })
  it("cai para o handle quando não há nome de categoria", () => {
    const g = montarGatilhos([oportunidade], produtos, colecoes, new Map(), new Map())
    expect(g[0].categoriaNome).toBe("tops")
    expect(g[0].colecaoNome).toBe("")
  })
  it("título nomeia categoria, coleção e a regra", () => {
    const g: Gatilho = { collection_id: "col_1", colecaoNome: "Família Blackout", categoria_faltante: "tops", categoriaNome: "Tops", regra: colecoes[0].regra, candidatas: [] }
    const t = tituloGatilho(g)
    expect(t).toContain("Mais uma peça de Tops da coleção Família Blackout fecha outro conjunto")
    expect(tituloGatilho({ ...g, colecaoNome: "" })).not.toContain("da coleção")
  })
  it("slotGatilho gera conjunto_slot próprio e único por instante", () => {
    expect(slotGatilho("tops", 123)).toEqual({ conjunto_slot: "gatilho-tops#0#123" })
  })
})
