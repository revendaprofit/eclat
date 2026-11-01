import { avaliarLimite, limiteDoAmbiente, mensagemDoLimite, unidadesDaVariante, LIMITE_PADRAO_POR_VARIANTE } from "../regra"

describe("limite de unidades por variante (sócia, 01/11/2026)", () => {
  it("o teto padrão é 5 por tamanho", () => {
    expect(LIMITE_PADRAO_POR_VARIANTE).toBe(5)
    expect(limiteDoAmbiente({} as NodeJS.ProcessEnv)).toBe(5)
  })

  it("o ambiente pode mudar o teto sem deploy; valor inválido cai no padrão", () => {
    expect(limiteDoAmbiente({ CARRINHO_MAX_POR_VARIANTE: "3" } as NodeJS.ProcessEnv)).toBe(3)
    expect(limiteDoAmbiente({ CARRINHO_MAX_POR_VARIANTE: "0" } as NodeJS.ProcessEnv)).toBe(5)
    expect(limiteDoAmbiente({ CARRINHO_MAX_POR_VARIANTE: "muitos" } as NodeJS.ProcessEnv)).toBe(5)
  })

  it("soma só as linhas da variante pedida", () => {
    const items = [
      { variant_id: "v1", quantity: 2, unit_price: 159 },
      { variant_id: "v1", quantity: 1, unit_price: 159 },
      { variant_id: "v2", quantity: 4, unit_price: 159 },
    ]
    expect(unidadesDaVariante(items, "v1")).toBe(3)
    expect(unidadesDaVariante(items, "v3")).toBe(0)
    expect(unidadesDaVariante(null, "v1")).toBe(0)
  })

  it("presente (preço zero) não conta no teto", () => {
    expect(unidadesDaVariante([{ variant_id: "v1", quantity: 1, unit_price: 0 }], "v1")).toBe(0)
  })

  it("fecha exatamente no limite e recusa uma unidade a mais", () => {
    expect(avaliarLimite(4, 1)).toEqual({ permitido: true, total: 5, limite: 5 })
    expect(avaliarLimite(5, 1)).toEqual({ permitido: false, total: 6, limite: 5 })
    expect(avaliarLimite(0, 13)).toEqual({ permitido: false, total: 13, limite: 5 })
  })

  it("trocar a quantidade da linha avalia o valor novo, não a soma", () => {
    expect(avaliarLimite(0, 5).permitido).toBe(true)
    expect(avaliarLimite(0, 6).permitido).toBe(false)
  })

  it("quantidade inválida vale zero, não derruba", () => {
    expect(avaliarLimite(Number.NaN, 2).total).toBe(2)
    expect(avaliarLimite(-3, 2).total).toBe(2)
  })

  it("mensagem em pt-BR com o teto", () => {
    expect(mensagemDoLimite(5)).toBe("Máximo de 5 unidades por tamanho na sacola. Para pedidos maiores, fale com a gente no WhatsApp.")
  })
})
