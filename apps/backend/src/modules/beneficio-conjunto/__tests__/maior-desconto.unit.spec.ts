import { descontoDoCupomNaUnidade, marcarContexto } from "../avaliar-carrinho"
import { MARCA_EM_CONJUNTO, MARCA_LIVRE } from "../utils/promocao"
import type { ResultadoMontagem } from "../utils/tipos"

// Decisão do dono (2026-09-20): conjunto e cupom nunca somam na mesma peça; por peça vale o maior
// desconto. Aqui só a marcação do contexto — quem aplica o desconto é o motor do Medusa, que lê
// `conjunto_desconto` de cada entrada.

const item = (id: string, precoReais: number, q = 1) => ({ id, quantity: q, subtotal: precoReais * q })

function resultado(unidades: { item_id: string; preco: number; desconto: number }[]): ResultadoMontagem {
  return {
    conjuntos: [
      {
        id: "cj_1",
        tipo: "colecao",
        regra_id: "reg_1",
        unidades: unidades.map((u) => ({
          item_id: u.item_id,
          product_id: "prod_" + u.item_id,
          preco_unitario: u.preco,
          desconto_unitario: u.desconto,
        })),
      },
    ],
    oportunidades: [],
  }
}

const marcas = (saida: Record<string, any>[]) => saida.map((i) => `${i.id}:${i.conjunto_desconto}`)

describe("maior desconto por peça", () => {
  it("cupom percentual: desconto por unidade em centavos, arredondado", () => {
    expect(descontoDoCupomNaUnidade(16900, [{ code: "ERIKA20", percentual: 20 }])).toBe(3380)
    expect(descontoDoCupomNaUnidade(3490, [{ code: "X", percentual: 15 }])).toBe(524) // 523,5 arredonda
    expect(descontoDoCupomNaUnidade(16900, [])).toBe(0)
  })

  it("vale o maior entre os cupons aplicados", () => {
    expect(descontoDoCupomNaUnidade(10000, [{ code: "A", percentual: 10 }, { code: "B", percentual: 25 }])).toBe(2500)
  })

  it("cupom de 20% ganha do conjunto de 10%: a peça sai do conjunto e fica livre para o cupom", () => {
    const saida = marcarContexto([item("li_1", 169), item("li_2", 169)], resultado([
      { item_id: "li_1", preco: 16900, desconto: 1690 },
      { item_id: "li_2", preco: 16900, desconto: 1690 },
    ]), [{ code: "ERIKA20", percentual: 20 }])
    expect(marcas(saida)).toEqual([`li_1:${MARCA_LIVRE}`, `li_2:${MARCA_LIVRE}`])
  })

  it("conjunto de 30% ganha do cupom de 20%: a peça continua no conjunto e o cupom não a alcança", () => {
    const saida = marcarContexto([item("li_1", 169)], resultado([{ item_id: "li_1", preco: 16900, desconto: 5070 }]), [
      { code: "ERIKA20", percentual: 20 },
    ])
    expect(marcas(saida)).toEqual(["li_1:reg_1"])
  })

  it("empate fica com o conjunto (desconto automático, sem depender de digitar código)", () => {
    const saida = marcarContexto([item("li_1", 100)], resultado([{ item_id: "li_1", preco: 10000, desconto: 2000 }]), [
      { code: "ERIKA20", percentual: 20 },
    ])
    expect(marcas(saida)).toEqual(["li_1:reg_1"])
  })

  it("peça sem desconto do conjunto (regra 'menor peça'): com cupom ela fica livre, sem cupom continua bloqueada", () => {
    const semDesconto = resultado([{ item_id: "li_1", preco: 16900, desconto: 0 }])
    expect(marcas(marcarContexto([item("li_1", 169)], semDesconto, [{ code: "ERIKA20", percentual: 20 }]))).toEqual([
      `li_1:${MARCA_LIVRE}`,
    ])
    expect(marcas(marcarContexto([item("li_1", 169)], semDesconto))).toEqual([`li_1:${MARCA_EM_CONJUNTO}`])
  })

  it("sem cupom nada muda: o conjunto segue marcando como antes", () => {
    const saida = marcarContexto([item("li_1", 169)], resultado([{ item_id: "li_1", preco: 16900, desconto: 1690 }]))
    expect(marcas(saida)).toEqual(["li_1:reg_1"])
  })

  it("linha com 2 unidades e só 1 no conjunto: a outra continua livre", () => {
    const saida = marcarContexto([item("li_1", 169, 2)], resultado([{ item_id: "li_1", preco: 16900, desconto: 5070 }]), [
      { code: "ERIKA20", percentual: 20 },
    ])
    expect(marcas(saida)).toEqual(["li_1:reg_1", `li_1:${MARCA_LIVRE}`])
  })
})

describe("cupom de embaixador: base já com o conjunto (dono, 2026-10-08)", () => {
  const top = item("top", 159)
  const short = item("short", 159)
  const res = resultado([
    { item_id: "top", preco: 15900, desconto: 950 },
    { item_id: "short", preco: 15900, desconto: 950 },
  ])

  it("unidade em conjunto chega ao motor sem o desconto do conjunto no subtotal", () => {
    const saida = marcarContexto([top, short], res, [], { baseComConjunto: true })
    expect(marcas(saida)).toEqual(["top:reg_1", "short:reg_1"])
    expect(saida.map((i) => i.subtotal)).toEqual([149.5, 149.5])
    // 20% sobre 149,50 = 29,90; o conjunto (fixo) tira 9,50 → 119,60 por peça, R$ 239,20 no par
    expect(saida.reduce((t, i) => t + 159 - Number(i.subtotal) * 0.2 - 9.5, 0)).toBeCloseTo(239.2, 2)
  })

  it("sem cupom de embaixador o subtotal não muda", () => {
    expect(marcarContexto([top, short], res, []).map((i) => i.subtotal)).toEqual([159, 159])
  })

  it("só as unidades em conjunto: a sobra da linha fica com o preço cheio", () => {
    const tops = item("top", 159, 2)
    const saida = marcarContexto([tops, short], res, [], { baseComConjunto: true })
    expect(saida.map((i) => `${i.id}:${i.conjunto_desconto}:${i.subtotal}`)).toEqual([
      "top:reg_1:149.5",
      `top:${MARCA_LIVRE}:159`,
      "short:reg_1:149.5",
    ])
  })

  it("raw_subtotal acompanha", () => {
    const comRaw = { ...top, raw_subtotal: { value: "159", precision: 20 } }
    const saida = marcarContexto([comRaw, short], res, [], { baseComConjunto: true })
    expect(saida[0].raw_subtotal).toEqual({ value: "149.5", precision: 20 })
  })
})
