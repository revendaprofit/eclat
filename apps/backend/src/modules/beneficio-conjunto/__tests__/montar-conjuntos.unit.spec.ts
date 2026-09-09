import { descontoDoConjunto, montarConjuntos, regraEfetiva } from "../utils/montar-conjuntos"
import type { Curado, Linha, Par, Regra } from "../utils/tipos"

const R = (p: Partial<Regra> & Pick<Regra, "id" | "escopo">): Regra =>
  ({ nome: p.id, collection_id: null, tipo_desconto: "total_percentual", valor: 10, ativa: true, promotion_id: null, ...p })
const PADRAO = R({ id: "creg_padrao", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 })
const PARES: Par[] = [{ id: "p1", categoria_a: "leggings", categoria_b: "tops", ativo: true }, { id: "p2", categoria_a: "shorts", categoria_b: "tops", ativo: true }]
const L = (item_id: string, product_id: string, categoria_raiz: string | null, preco: number, quantidade = 1, collection_id: string | null = "col_a"): Linha =>
  ({ item_id, product_id, collection_id, categoria_raiz, preco_unitario: preco, quantidade })

describe("regraEfetiva", () => {
  it("exceção da coleção vence o padrão; exceção inativa = sem benefício; sem padrão ativo = null", () => {
    const exc = R({ id: "creg_a", escopo: "colecao", collection_id: "col_a", valor: 15 })
    expect(regraEfetiva([PADRAO, exc], "col_a")?.id).toBe("creg_a")
    expect(regraEfetiva([PADRAO, exc], "col_b")?.id).toBe("creg_padrao")
    expect(regraEfetiva([PADRAO, { ...exc, ativa: false }], "col_a")).toBeNull()
    expect(regraEfetiva([{ ...PADRAO, ativa: false }], "col_b")).toBeNull()
    expect(regraEfetiva([PADRAO], null)).toBeNull()
  })
})

describe("descontoDoConjunto", () => {
  it("menor peça %: só a mais barata; empate → primeira", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_percentual", valor: 20 }, [18900, 25900])).toEqual([3780, 0])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_percentual", valor: 20 }, [25900, 18900, 18900])).toEqual([0, 3780, 0])
  })
  it("menor peça R$: limitado ao preço da unidade", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_valor", valor: 5000 }, [18900, 25900])).toEqual([5000, 0])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_valor", valor: 99900 }, [18900, 25900])).toEqual([18900, 0])
  })
  it("total %: em cada unidade; total R$: repartido em partes iguais, arredondado, limitado", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_percentual", valor: 10 }, [18900, 25900])).toEqual([1890, 2590])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 4500 }, [18900, 25900])).toEqual([2250, 2250])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 4501 }, [18900, 25900])).toEqual([2251, 2251]) // round(2250.5)
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 100000 }, [18900, 25900])).toEqual([18900, 25900])
  })
})

describe("montarConjuntos — pares de coleção", () => {
  it("1 top + 1 legging → 1 conjunto, desconto na menor peça", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_leg", "p_leg", "leggings", 25900)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(1)
    expect(r.conjuntos[0]).toMatchObject({ tipo: "colecao", regra_id: "creg_padrao" })
    expect(r.conjuntos[0].unidades).toEqual([
      { item_id: "i_leg", product_id: "p_leg", preco_unitario: 25900, desconto_unitario: 0 },
      { item_id: "i_top", product_id: "p_top", preco_unitario: 18900, desconto_unitario: 3780 },
    ])
    expect(r.oportunidades).toEqual([])
  })
  it("2 tops + 1 legging + 1 short → 2 conjuntos; nada sobra", () => {
    const r = montarConjuntos([L("i_t1", "p_t", "tops", 18900, 2), L("i_leg", "p_leg", "leggings", 25900), L("i_sh", "p_sh", "shorts", 15900)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(2)
    expect(r.oportunidades).toEqual([])
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(3780 + 3180) // menor de (top, legging) = top 189; menor de (top, short) = short 159
  })
  it("1 top + 2 leggings → 1 conjunto + oportunidade de top", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_leg", "p_leg", "leggings", 25900, 2)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(1)
    expect(r.oportunidades).toEqual([{ collection_id: "col_a", categoria_faltante: "tops", a_partir_do_item_id: "i_leg" }])
  })
  it("pareamento favorece a cliente: 2 tops (100, 300) + 2 leggings (200, 400), menor peça 10%", () => {
    const r = montarConjuntos([L("t1", "pt1", "tops", 10000), L("t2", "pt2", "tops", 30000), L("l1", "pl1", "leggings", 20000), L("l2", "pl2", "leggings", 40000)], [{ ...PADRAO, valor: 10 }], PARES, [])
    // (300,400) e (100,200): mínimos 300+100 = 400 → desconto 4000. Alternativa (300,200)+(100,400): 200+100 = 300 → 3000.
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(4000)
  })
  it("coleções diferentes não pareiam; categoria fora dos pares não pareia; sem coleção não pareia", () => {
    expect(montarConjuntos([L("a", "pa", "tops", 100, 1, "col_a"), L("b", "pb", "leggings", 100, 1, "col_b")], [PADRAO], PARES, []).conjuntos).toEqual([])
    expect(montarConjuntos([L("a", "pa", "tops", 100), L("b", "pb", "macaquinhos", 100)], [PADRAO], PARES, []).conjuntos).toEqual([])
    expect(montarConjuntos([L("a", "pa", "tops", 100, 1, null), L("b", "pb", "leggings", 100, 1, null)], [PADRAO], PARES, []).conjuntos).toEqual([])
  })
  it("exceção inativa da coleção → nada e sem oportunidade", () => {
    const exc = R({ id: "creg_a", escopo: "colecao", collection_id: "col_a", ativa: false })
    const r = montarConjuntos([L("a", "pa", "tops", 100), L("b", "pb", "leggings", 100)], [PADRAO, exc], PARES, [])
    expect(r.conjuntos).toEqual([])
    expect(r.oportunidades).toEqual([])
  })
})

describe("montarConjuntos — curados", () => {
  const RC = R({ id: "creg_cur", escopo: "curado", tipo_desconto: "total_valor", valor: 5000 })
  const CUR: Curado = { id: "ccur_1", nome: "Look", handle: "look", capa_url: null, product_ids: ["p_top", "p_leg_b"], regra_id: "creg_cur", ativo: true, ordem: 0 }
  it("curado cruza coleções e consome unidades antes do par de coleção", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_legb", "p_leg_b", "leggings", 25900, 1, "col_b"), L("i_lega", "p_leg_a", "leggings", 25900)], [PADRAO, RC], PARES, [CUR])
    expect(r.conjuntos.map((c) => c.tipo)).toEqual(["curado"])
    expect(r.conjuntos[0].unidades.map((u) => u.desconto_unitario)).toEqual([2500, 2500])
    expect(r.oportunidades).toEqual([{ collection_id: "col_a", categoria_faltante: "tops", a_partir_do_item_id: "i_lega" }])
  })
  it("curado precisa de todos os produtos; forma quantos couberem", () => {
    expect(montarConjuntos([L("i_top", "p_top", "tops", 18900, 2)], [RC], [], [CUR]).conjuntos).toEqual([])
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900, 2), L("i_legb", "p_leg_b", "leggings", 25900, 3, "col_b")], [RC], [], [CUR])
    expect(r.conjuntos).toHaveLength(2)
  })
  it("curado inativo ou com regra inativa é ignorado", () => {
    expect(montarConjuntos([L("i_top", "p_top", "tops", 1), L("i_legb", "p_leg_b", "leggings", 1, 1, "col_b")], [RC], [], [{ ...CUR, ativo: false }]).conjuntos).toEqual([])
    expect(montarConjuntos([L("i_top", "p_top", "tops", 1), L("i_legb", "p_leg_b", "leggings", 1, 1, "col_b")], [{ ...RC, ativa: false }], [], [CUR]).conjuntos).toEqual([])
  })
})
