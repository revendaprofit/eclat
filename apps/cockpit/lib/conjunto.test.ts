import { describe, expect, it } from "vitest"
import type { Par, Regra } from "./conjunto"
import {
  alertaEstoque,
  entradaParaValor,
  formatarReais,
  motivoSemConjunto,
  previaBeneficio,
  raizDeCategoria,
  slugConjunto,
  validarCurado,
  validarRegra,
  valorParaEntrada,
} from "./conjunto"

describe("conversão de entrada", () => {
  it("percentual: inteiro 1–100", () => {
    expect(entradaParaValor("total_percentual", "15")).toBe(15)
    expect(entradaParaValor("total_percentual", "15,5")).toBeNull()
    expect(entradaParaValor("total_percentual", "0")).toBeNull()
    expect(entradaParaValor("total_percentual", "101")).toBeNull()
    expect(valorParaEntrada("menor_peca_percentual", 20)).toBe("20")
  })
  it("valor: reais com vírgula ou ponto → centavos", () => {
    expect(entradaParaValor("total_valor", "45,90")).toBe(4590)
    expect(entradaParaValor("menor_peca_valor", "45.9")).toBe(4590)
    expect(entradaParaValor("total_valor", "R$ 1.234,56")).toBe(123456)
    expect(entradaParaValor("total_valor", "0")).toBeNull()
    expect(entradaParaValor("total_valor", "abc")).toBeNull()
    expect(valorParaEntrada("total_valor", 4590)).toBe("45,90")
    expect(formatarReais(123456)).toBe("R$ 1.234,56")
  })
})

describe("validação", () => {
  it("regra: nome, valor", () => {
    expect(validarRegra({ nome: "", tipo_desconto: "total_percentual", valorTexto: "10" })).toMatch(/nome/i)
    expect(validarRegra({ nome: "Padrão", tipo_desconto: "total_percentual", valorTexto: "x" })).toMatch(/valor/i)
    expect(validarRegra({ nome: "Padrão", tipo_desconto: "total_percentual", valorTexto: "10" })).toBeNull()
  })
  it("curado: nome, ≥2 produtos distintos, valor", () => {
    expect(validarCurado({ nome: "Look", product_ids: ["a"], tipo_desconto: "total_valor", valorTexto: "40" })).toMatch(/2 produtos/i)
    expect(validarCurado({ nome: "Look", product_ids: ["a", "a"], tipo_desconto: "total_valor", valorTexto: "40" })).toMatch(/2 produtos/i)
    expect(validarCurado({ nome: "Look", product_ids: ["a", "b"], tipo_desconto: "total_valor", valorTexto: "40" })).toBeNull()
  })
})

describe("previaBeneficio (mesma regra do backend)", () => {
  const P = [18900, 25900]
  it("menor peça % / R$", () => {
    expect(previaBeneficio("menor_peca_percentual", 20, P)).toEqual({ descontos: [3780, 0], total: 44800, economia: 3780, final: 41020 })
    expect(previaBeneficio("menor_peca_valor", 5000, P).descontos).toEqual([5000, 0])
    expect(previaBeneficio("menor_peca_valor", 99900, P).descontos).toEqual([18900, 0])
  })
  it("total % / R$ (repartido e arredondado por unidade)", () => {
    expect(previaBeneficio("total_percentual", 10, P).descontos).toEqual([1890, 2590])
    expect(previaBeneficio("total_valor", 4500, P).descontos).toEqual([2250, 2250])
    expect(previaBeneficio("total_valor", 4501, P).descontos).toEqual([2251, 2251])
  })
})

describe("alertaEstoque / slug", () => {
  it("rascunho, sem estoque, baixo, ok", () => {
    expect(alertaEstoque({ status: "draft", variants: [{ stock: 10 }] })).toBe("rascunho")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 0 }, { stock: null }] })).toBe("sem_estoque")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 2 }, { stock: 1 }] })).toBe("estoque_baixo")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 4 }] })).toBeNull()
  })
  it("slug sem acento, minúsculo, hífens", () => {
    expect(slugConjunto("Look Blackout — Verão")).toBe("look-blackout-verao")
  })
})

describe("raizDeCategoria", () => {
  const cats = [
    { id: "raiz-1", handle: "vestidos", parent_id: null },
    { id: "filha-1", handle: "vestidos-longos", parent_id: "raiz-1" },
  ]
  it("categoria filha resolve para a raiz", () => {
    expect(raizDeCategoria(cats, ["filha-1"])).toBe("vestidos")
  })
  it("categoria já raiz resolve para si mesma", () => {
    expect(raizDeCategoria(cats, ["raiz-1"])).toBe("vestidos")
  })
  it("sem categorias ou categoria desconhecida → null", () => {
    expect(raizDeCategoria(cats, [])).toBeNull()
    expect(raizDeCategoria(cats, ["inexistente"])).toBeNull()
  })
})

describe("motivoSemConjunto (espelha regraEfetiva do backend)", () => {
  const padraoAtiva: Regra = { id: "r-padrao", nome: "Padrão", escopo: "padrao", collection_id: null, tipo_desconto: "total_percentual", valor: 10, ativa: true, promotion_id: null }
  const padraoInativa: Regra = { ...padraoAtiva, ativa: false }
  const excecaoInativa: Regra = { id: "r-excecao", nome: "Exceção", escopo: "colecao", collection_id: "col-1", tipo_desconto: "total_percentual", valor: 10, ativa: false, promotion_id: null }
  const pares: Par[] = [{ id: "p-1", categoria_a: "vestidos", categoria_b: "saias", ativo: true }]

  it("sem coleção", () => {
    expect(
      motivoSemConjunto({ collection_id: null, categoria_raiz: "vestidos", regras: [padraoAtiva], pares, temParceiras: false })
    ).toBe("Produto sem coleção: não forma conjunto de coleção")
  })

  it("exceção inativa com padrão ativo → sem benefício (exceção cancela a padrão)", () => {
    expect(
      motivoSemConjunto({ collection_id: "col-1", categoria_raiz: "vestidos", regras: [padraoAtiva, excecaoInativa], pares, temParceiras: false })
    ).toBe("Coleção sem benefício ativo")
  })

  it("padrão inativa sem exceção → sem benefício", () => {
    expect(
      motivoSemConjunto({ collection_id: "col-2", categoria_raiz: "vestidos", regras: [padraoInativa], pares, temParceiras: false })
    ).toBe("Coleção sem benefício ativo")
  })

  it("categoria fora dos pares ativos → mensagem de pares", () => {
    expect(
      motivoSemConjunto({ collection_id: "col-1", categoria_raiz: "calcados", regras: [padraoAtiva], pares, temParceiras: false })
    ).toBe("Categoria não participa dos pares permitidos")
  })

  it("tudo ok sem parceiras → nenhuma peça parceira publicada", () => {
    expect(
      motivoSemConjunto({ collection_id: "col-1", categoria_raiz: "vestidos", regras: [padraoAtiva], pares, temParceiras: false })
    ).toBe("Nenhuma peça parceira publicada nesta coleção")
  })

  it("com parceiras → null", () => {
    expect(
      motivoSemConjunto({ collection_id: "col-1", categoria_raiz: "vestidos", regras: [padraoAtiva], pares, temParceiras: true })
    ).toBeNull()
  })
})
