import { avaliarCupomPrimeiraCompra, ehCupomDePrimeiraCompra, mensagemCupomSoPrimeiraCompra, normalizarCpf } from "../regra"

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
  it("sem cupom de primeira compra no carrinho: sempre permitido, mesmo para quem já comprou", () => {
    expect(avaliarCupomPrimeiraCompra(["CLUBE10"], 3)).toEqual({ permitido: true })
    expect(avaliarCupomPrimeiraCompra([], 1)).toEqual({ permitido: true })
  })
  it("CPF sem nenhum pedido: permitido", () => {
    expect(avaliarCupomPrimeiraCompra(["BEMVINDA10"], 0)).toEqual({ permitido: true })
  })
  it("CPF que já comprou — com OU sem cupom — não usa cupom de primeira compra", () => {
    expect(avaliarCupomPrimeiraCompra(["BEMVINDA10"], 1)).toEqual({ permitido: false, codigo: "BEMVINDA10" })
    expect(avaliarCupomPrimeiraCompra(["CLUBE10", "bemvinda15"], 2)).toEqual({ permitido: false, codigo: "BEMVINDA15" })
  })
})

describe("apoio", () => {
  it("CPF só com dígitos; a mensagem fala o código e o que fazer", () => {
    expect(normalizarCpf("123.456.789-09")).toBe("12345678909")
    expect(normalizarCpf(undefined)).toBe("")
    expect(mensagemCupomSoPrimeiraCompra("BEMVINDA10")).toContain("Remova o cupom")
  })
})
