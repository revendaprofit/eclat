import { describe, expect, it } from "vitest"
import { estoqueUtil, necessidade, normalizarAlmoxarifado, valorEstoque } from "./almoxarifado"

const a = normalizarAlmoxarifado({
  reserva_pct: 5,
  itens: [
    { id: "a", grupo: "Termocolante off white", nome: "Monograma", quantidade: 291, custo_unitario_centavos: 55, chave: "monograma" },
    { id: "b", grupo: "Termocolante caramelo", nome: "Monograma", quantidade: 349, custo_unitario_centavos: 55, chave: "monograma" },
    { id: "c", grupo: "Tiras 3D", nome: "Tira 3D silicone", quantidade: 250, custo_unitario_centavos: 114, chave: "tira 3d" },
    { id: "d", grupo: "DTF do cós", nome: "P fundo branco", quantidade: 16, custo_unitario_centavos: null, chave: null },
  ],
})

describe("almoxarifado", () => {
  it("normaliza e calcula estoque útil e valor", () => {
    expect(a.itens).toHaveLength(4)
    expect(estoqueUtil(a.itens[0], 5)).toBe(276)
    expect(valorEstoque(a)).toBe(276 * 55 + 331 * 55 + 237 * 114)
  })
  it("necessidade da próxima produção pelas fichas, somando cores da mesma chave", () => {
    const fichas = [
      { id: "f1", name: "Short Aurora", itens: [{ name: "Etiqueta 3D pequena · monograma", consumption: 1 }, { name: "Tira 3D 'Éclat' alto relevo (gripfit)", consumption: 4 }] },
      { id: "f2", name: "Solaris", itens: [{ name: "Etiqueta 3D pequena · monograma", consumption: 2 }] },
    ]
    const n = necessidade(a, fichas, { f1: 100, f2: 200 })
    const mono = n.find((x) => x.chave === "monograma")!
    expect([mono.precisa, mono.estoque, mono.falta]).toEqual([500, 276 + 331, 0])
    const tira = n.find((x) => x.chave === "tira 3d")!
    expect([tira.precisa, tira.estoque, tira.falta]).toEqual([400, 237, 163])
  })
})
