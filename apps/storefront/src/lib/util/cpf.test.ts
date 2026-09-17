import { describe, it, expect } from "vitest"
import { normalizarCpf, cpfValido, formatarCpf } from "./cpf"

describe("normalizarCpf", () => {
  it("tira máscara e espaços", () => {
    expect(normalizarCpf("529.982.247-25")).toBe("52998224725")
    expect(normalizarCpf(" 529 982 247 25 ")).toBe("52998224725")
  })

  it("devolve string vazia para entrada vazia", () => {
    expect(normalizarCpf("")).toBe("")
  })
})

describe("cpfValido", () => {
  it("aceita CPFs válidos conhecidos", () => {
    expect(cpfValido("529.982.247-25")).toBe(true)
    expect(cpfValido("52998224725")).toBe(true)
    expect(cpfValido("111.444.777-35")).toBe(true)
  })

  it("rejeita dígito verificador errado", () => {
    expect(cpfValido("529.982.247-26")).toBe(false)
    expect(cpfValido("111.444.777-30")).toBe(false)
  })

  it("rejeita todos os dígitos iguais, que passam no cálculo mas não são CPF", () => {
    expect(cpfValido("111.111.111-11")).toBe(false)
    expect(cpfValido("00000000000")).toBe(false)
    expect(cpfValido("99999999999")).toBe(false)
  })

  it("rejeita tamanho errado", () => {
    expect(cpfValido("5299822472")).toBe(false)
    expect(cpfValido("529982247250")).toBe(false)
  })

  it("rejeita vazio e lixo", () => {
    expect(cpfValido("")).toBe(false)
    expect(cpfValido("abc.def.ghi-jk")).toBe(false)
  })
})

describe("formatarCpf", () => {
  it("aplica a máscara", () => {
    expect(formatarCpf("52998224725")).toBe("529.982.247-25")
  })

  it("devolve o que recebeu quando não dá para formatar", () => {
    expect(formatarCpf("529")).toBe("529")
  })
})
