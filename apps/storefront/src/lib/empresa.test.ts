import { describe, expect, it } from "vitest"
import { EMPRESA, cnpjSoDigitos, enderecoEmUmaLinha } from "./empresa"

describe("identificação da empresa", () => {
  it("é o mesmo CNPJ da conta Mercado Pago que recebe o dinheiro", () => {
    // Lido da API do Mercado Pago em 2026-09-20 (`/users/me`, campo company.identification).
    // O nome que a cliente lê no site tem que ser o mesmo que aparece no extrato dela.
    expect(cnpjSoDigitos()).toBe("68673407000113")
  })

  it("tem tudo que o Decreto 7.962/2013 exige mostrar", () => {
    expect(EMPRESA.razaoSocial.trim()).not.toBe("")
    expect(EMPRESA.email).toMatch(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)
    expect(EMPRESA.endereco.cep).toMatch(/^\d{5}-\d{3}$/)
    expect(EMPRESA.endereco.uf).toHaveLength(2)
  })

  it("escreve o endereço numa linha só, do jeito que se lê", () => {
    expect(enderecoEmUmaLinha()).toBe("Rua Norte, 180 — Angola, Betim/MG, CEP 32604-182")
  })
})
