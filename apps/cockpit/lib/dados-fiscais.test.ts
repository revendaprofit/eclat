import { describe, it, expect } from "vitest"
import { lerDadosFiscais, faltamDadosFiscaisPedido } from "./dados-fiscais"

const completo = {
  metadata: { cpf: "52998224725" },
  shipping_address: { metadata: { numero: "180", bairro: "Angola", municipio_ibge: "3106705" } },
}

describe("lerDadosFiscais", () => {
  it("lê das duas fontes que o backend fiscal usa", () => {
    expect(lerDadosFiscais(completo)).toEqual({
      cpf: "52998224725",
      numero: "180",
      bairro: "Angola",
      municipio_ibge: "3106705",
    })
  })

  it("devolve strings vazias em vez de undefined quando não há nada", () => {
    expect(lerDadosFiscais({})).toEqual({ cpf: "", numero: "", bairro: "", municipio_ibge: "" })
    expect(lerDadosFiscais(null)).toEqual({ cpf: "", numero: "", bairro: "", municipio_ibge: "" })
  })

  it("normaliza o CPF, tirando a máscara", () => {
    expect(lerDadosFiscais({ metadata: { cpf: "529.982.247-25" } }).cpf).toBe("52998224725")
  })
})

describe("faltamDadosFiscaisPedido", () => {
  it("não acusa nada quando está completo", () => {
    expect(faltamDadosFiscaisPedido(lerDadosFiscais(completo))).toEqual([])
  })

  it("acusa CPF inválido, não só ausente", () => {
    const d = lerDadosFiscais({ ...completo, metadata: { cpf: "111.111.111-11" } })
    expect(faltamDadosFiscaisPedido(d)).toEqual(["CPF"])
  })

  it("acusa IBGE com formato errado", () => {
    const d = lerDadosFiscais({
      ...completo,
      shipping_address: { metadata: { numero: "180", bairro: "Angola", municipio_ibge: "310670" } },
    })
    expect(faltamDadosFiscaisPedido(d)).toEqual(["município (código IBGE)"])
  })

  it("acusa tudo num pedido antigo, sem nada preenchido", () => {
    expect(faltamDadosFiscaisPedido(lerDadosFiscais({}))).toEqual([
      "CPF",
      "número",
      "bairro",
      "município (código IBGE)",
    ])
  })
})
