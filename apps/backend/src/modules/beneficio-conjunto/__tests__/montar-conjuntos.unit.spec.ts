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

describe("montarConjuntos — competição entre pares por coleção (spec §2.6, ruling P3)", () => {
  it("competição entre pares favorece a cliente", () => {
    const cart: Linha[] = [L("i_top", "p_top", "tops", 30000), L("i_leg", "p_leg", "leggings", 20000), L("i_sh", "p_sh", "shorts", 25000)]
    const regra = { ...PADRAO, tipo_desconto: "menor_peca_percentual" as const, valor: 10 }

    // Só cabe 1 conjunto: o top (30000) só pode ir para a legging OU para o short, nunca os dois.
    // A legging (20000) daria desconto 2000; o short (25000) dá 2500 → deve ficar com o short.
    const r = montarConjuntos(cart, [regra], PARES, [])
    expect(r.conjuntos).toHaveLength(1)
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(2500)
    expect(r.conjuntos[0].unidades.some((u) => u.item_id === "i_sh")).toBe(true)
    expect(r.conjuntos[0].unidades.some((u) => u.item_id === "i_leg")).toBe(false)

    // Mesmo carrinho, pares na ordem inversa → mesmo resultado (independente da ordem cadastrada).
    const paresInvertidos: Par[] = [PARES[1], PARES[0]]
    const rInvertida = montarConjuntos(cart, [regra], paresInvertidos, [])
    expect(rInvertida.conjuntos).toHaveLength(1)
    const somaDescInvertida = rInvertida.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDescInvertida).toBe(2500)
    expect(rInvertida.conjuntos[0].unidades.some((u) => u.item_id === "i_sh")).toBe(true)
  })

  it("número de conjuntos vence o desconto", () => {
    // Cadeia a-b-c-d (cada categoria com 1 unidade). Processar b+c primeiro forma só 1 conjunto
    // (b,c) — mas com desconto altíssimo, pois b e c são caras. Processar a+b e c+d primeiro forma
    // 2 conjuntos com desconto bem menor cada. O critério "mais conjuntos" deve vencer o desconto maior.
    const cart: Linha[] = [L("i_a", "p_a", "a", 100), L("i_b", "p_b", "b", 100000), L("i_c", "p_c", "c", 100000), L("i_d", "p_d", "d", 100)]
    const pares: Par[] = [
      { id: "pab", categoria_a: "a", categoria_b: "b", ativo: true },
      { id: "pbc", categoria_a: "b", categoria_b: "c", ativo: true },
      { id: "pcd", categoria_a: "c", categoria_b: "d", ativo: true },
    ]
    const r = montarConjuntos(cart, [PADRAO], pares, [])
    expect(r.conjuntos).toHaveLength(2)
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(40) // 20% do menor de (a,b)=100 + 20% do menor de (c,d)=100 = 20+20
  })

  it("embaralhamento não muda o pareamento ótimo", () => {
    // Mesmo cenário de "pareamento favorece a cliente", com as linhas em ordem embaralhada.
    const r = montarConjuntos(
      [L("t2", "pt2", "tops", 30000), L("l2", "pl2", "leggings", 40000), L("t1", "pt1", "tops", 10000), L("l1", "pl1", "leggings", 20000)],
      [{ ...PADRAO, valor: 10 }],
      PARES,
      [],
    )
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(4000)
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
