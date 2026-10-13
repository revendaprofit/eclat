import { describe, expect, it } from "vitest"
import { enderecoEmLinha } from "./endereco"

describe("enderecoEmLinha", () => {
  it("mostra número, complemento e bairro quando existem", () => {
    expect(
      enderecoEmLinha({ address_1: "Rua Presidente Vargas", address_2: "Casa", city: "Betim", province: "MG", postal_code: "32603-205", metadata: { numero: "555", bairro: "Guarujá" } })
    ).toBe("Rua Presidente Vargas, 555 · Casa · Guarujá · Betim · MG · 32603-205")
  })
  it("não deixa buraco quando falta número ou metadata", () => {
    expect(enderecoEmLinha({ address_1: "Rua 1", city: "betim", province: "MG", postal_code: "32604182", metadata: null })).toBe("Rua 1 · betim · MG · 32604182")
    expect(enderecoEmLinha(null)).toBe("")
  })
})
