import { describe, it, expect } from "vitest"
import { montarItensDevolvidos } from "./fiscal-devolucao"

const ITENS = [
  { item_id: "l1", quantidade_pedido: 2 },
  { item_id: "l2", quantidade_pedido: 1 },
]

describe("montarItensDevolvidos", () => {
  it("inclui só os itens com quantidade informada maior que zero", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 1, l2: 0 })
    expect(r).toEqual({ ok: true, itens: [{ line_item_id: "l1", quantidade: 1 }] })
  })

  it("erro quando nenhum item tem quantidade informada", () => {
    const r = montarItensDevolvidos(ITENS, {})
    expect(r.ok).toBe(false)
  })

  it("erro quando todas as quantidades informadas são zero", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 0, l2: 0 })
    expect(r.ok).toBe(false)
  })

  it("erro quando a quantidade excede a quantidade do pedido", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 3 })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.erro).toMatch(/maior que a quantidade do pedido/)
  })

  it("erro quando a quantidade é negativa", () => {
    const r = montarItensDevolvidos(ITENS, { l1: -1 })
    expect(r.ok).toBe(false)
  })

  it("erro quando a quantidade não é um número finito", () => {
    const r = montarItensDevolvidos(ITENS, { l1: NaN })
    expect(r.ok).toBe(false)
  })

  // Achado da revisão: Math.trunc(-0.5) é -0, e -0 === 0 é verdadeiro em JS. Se o sinal fosse
  // checado DEPOIS do trunc, "-0.5" seria descartado em silêncio (linha "continue") em vez de
  // cair no erro de quantidade negativa.
  it("erro quando a quantidade é -0.5 (trunca para -0, mas é negativa)", () => {
    const r = montarItensDevolvidos(ITENS, { l1: -0.5 })
    expect(r.ok).toBe(false)
  })

  it("-0 puro é tratado como zero (não devolver), não como negativo", () => {
    const r = montarItensDevolvidos(ITENS, { l1: -0, l2: 1 })
    expect(r).toEqual({ ok: true, itens: [{ line_item_id: "l2", quantidade: 1 }] })
  })

  it("trunca quantidade fracionária", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 1.9 })
    expect(r).toEqual({ ok: true, itens: [{ line_item_id: "l1", quantidade: 1 }] })
  })

  it("ignora chave que não corresponde a nenhum item do pedido", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 1, l999: 5 })
    expect(r).toEqual({ ok: true, itens: [{ line_item_id: "l1", quantidade: 1 }] })
  })

  it("aceita devolução parcial de vários itens", () => {
    const r = montarItensDevolvidos(ITENS, { l1: 2, l2: 1 })
    expect(r).toEqual({
      ok: true,
      itens: [
        { line_item_id: "l1", quantidade: 2 },
        { line_item_id: "l2", quantidade: 1 },
      ],
    })
  })
})
