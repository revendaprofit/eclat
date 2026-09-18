import { describe, expect, it } from "vitest"
import { isProdutoOculto, semOcultos } from "./produto-oculto"

const visivel = { id: "prod_1", handle: "top-aurora", metadata: {} }
const oculto = { id: "prod_2", handle: "produto-teste", metadata: { oculto: true } }

describe("isProdutoOculto", () => {
  it("só considera oculto o metadata.oculto verdadeiro", () => {
    expect(isProdutoOculto(oculto)).toBe(true)
    expect(isProdutoOculto({ metadata: { oculto: "true" } })).toBe(true)
    expect(isProdutoOculto(visivel)).toBe(false)
    expect(isProdutoOculto({ metadata: { oculto: false } })).toBe(false)
    expect(isProdutoOculto({ metadata: { oculto: "false" } })).toBe(false)
    expect(isProdutoOculto({ metadata: null })).toBe(false)
    expect(isProdutoOculto({})).toBe(false)
  })
})

describe("semOcultos", () => {
  it("tira o produto oculto de consultas de listagem e ajusta a contagem", () => {
    const r = semOcultos({ products: [visivel, oculto], count: 2 }, { limit: 12 })
    expect(r.products).toEqual([visivel])
    expect(r.count).toBe(1)
  })

  it("mantém o produto oculto quando a consulta pede um handle (link direto da PDP)", () => {
    const r = semOcultos({ products: [oculto], count: 1 }, { handle: "produto-teste" })
    expect(r.products).toEqual([oculto])
    expect(r.count).toBe(1)
  })

  it("mantém o produto oculto quando a consulta pede ids (hidratação do carrinho/conjunto)", () => {
    const r = semOcultos({ products: [oculto], count: 1 }, { id: ["prod_2"] })
    expect(r.products).toEqual([oculto])
  })

  it("não mexe em nada quando não há produto oculto", () => {
    const entrada = { products: [visivel], count: 7 }
    expect(semOcultos(entrada, undefined)).toEqual(entrada)
  })

  it("nunca deixa a contagem negativa", () => {
    expect(semOcultos({ products: [oculto], count: 0 }, {}).count).toBe(0)
  })
})
