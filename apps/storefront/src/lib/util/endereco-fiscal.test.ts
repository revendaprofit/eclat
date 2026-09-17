import { describe, it, expect } from "vitest"
import { montarMetadataFiscal } from "./endereco-fiscal"

describe("montarMetadataFiscal", () => {
  it("produz exatamente as chaves que o backend fiscal lê", () => {
    const m = montarMetadataFiscal({ numero: "180", bairro: "Angola", ibge: "3106705" })
    expect(m).toEqual({ numero: "180", bairro: "Angola", municipio_ibge: "3106705" })
    expect(Object.keys(m).sort()).toEqual(["bairro", "municipio_ibge", "numero"])
  })

  it("apara espaços", () => {
    const m = montarMetadataFiscal({ numero: " 180 ", bairro: " Angola ", ibge: " 3106705 " })
    expect(m).toEqual({ numero: "180", bairro: "Angola", municipio_ibge: "3106705" })
  })

  it("aceita número sem valor como S/N — imóvel sem número existe", () => {
    expect(montarMetadataFiscal({ numero: "", bairro: "Angola", ibge: "3106705" }).numero).toBe("S/N")
  })
})

describe("montarMetadataFiscal — o contrato com o backend", () => {
  it("não inventa chave nenhuma além das três que fiscal-pedido.ts lê", () => {
    const m = montarMetadataFiscal({ numero: "180", bairro: "Angola", ibge: "3106705" })
    // Chave a mais é inofensiva; chave a MENOS ou com nome diferente quebra a emissão
    // sem quebrar teste nenhum do checkout. Por isso a asserção é exata.
    expect(Object.keys(m)).toHaveLength(3)
  })
})
