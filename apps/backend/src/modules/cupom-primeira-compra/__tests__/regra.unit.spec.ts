import { avaliarCupomPrimeiraCompra, ehCupomDePrimeiraCompra, mensagemCupomJaUsado, normalizarCpf } from "../regra"

describe("ehCupomDePrimeiraCompra", () => {
  afterEach(() => {
    delete process.env.CUPONS_PRIMEIRA_COMPRA
  })
  it("todo código que começa com BEMVINDA é de primeira compra; os outros, não", () => {
    expect(ehCupomDePrimeiraCompra("BEMVINDA10")).toBe(true)
    expect(ehCupomDePrimeiraCompra(" bemvinda15 ")).toBe(true)
    expect(ehCupomDePrimeiraCompra("CLUBE10")).toBe(false)
    expect(ehCupomDePrimeiraCompra("")).toBe(false)
    expect(ehCupomDePrimeiraCompra(null)).toBe(false)
  })
  it("a env acrescenta códigos sem deploy", () => {
    process.env.CUPONS_PRIMEIRA_COMPRA = "estreia, PRIMEIRA5"
    expect(ehCupomDePrimeiraCompra("ESTREIA")).toBe(true)
    expect(ehCupomDePrimeiraCompra("primeira5")).toBe(true)
    expect(ehCupomDePrimeiraCompra("CLUBE10")).toBe(false)
  })
})

describe("avaliarCupomPrimeiraCompra", () => {
  it("sem cupom de primeira compra no carrinho: sempre permitido, mesmo com histórico", () => {
    expect(avaliarCupomPrimeiraCompra(["CLUBE10"], [{ cupons: ["BEMVINDA10"] }])).toEqual({ permitido: true })
    expect(avaliarCupomPrimeiraCompra([], [{ cupons: ["BEMVINDA10"] }])).toEqual({ permitido: true })
  })
  it("CPF sem pedido, ou só com pedidos SEM cupom de primeira compra: permitido", () => {
    expect(avaliarCupomPrimeiraCompra(["BEMVINDA10"], [])).toEqual({ permitido: true })
    expect(avaliarCupomPrimeiraCompra(["BEMVINDA10"], [{ cupons: [] }, { cupons: ["CLUBE10"] }])).toEqual({ permitido: true })
  })
  it("CPF que já usou um cupom de primeira compra: recusado — inclusive trocando de código", () => {
    expect(avaliarCupomPrimeiraCompra(["BEMVINDA10"], [{ cupons: ["BEMVINDA10"] }])).toEqual({ permitido: false, codigo: "BEMVINDA10" })
    expect(avaliarCupomPrimeiraCompra(["bemvinda15"], [{ cupons: [] }, { cupons: ["BEMVINDA10"] }])).toEqual({ permitido: false, codigo: "BEMVINDA15" })
  })
})

describe("apoio", () => {
  it("CPF só com dígitos; a mensagem fala o código e o que fazer", () => {
    expect(normalizarCpf("123.456.789-09")).toBe("12345678909")
    expect(normalizarCpf(undefined)).toBe("")
    expect(mensagemCupomJaUsado("BEMVINDA10")).toContain("Remova o cupom")
  })
})
