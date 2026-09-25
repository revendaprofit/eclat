import { describe, expect, it } from "vitest"
import { avisoPermitidoNaRota, lerConfigBoasVindas, mascararCelular } from "./boas-vindas"

describe("lerConfigBoasVindas", () => {
  it("só liga com ativa=true, cupom e percentual válidos", () => {
    expect(lerConfigBoasVindas({ ativa: true, cupom: " bemvinda10 ", percentual: 10 })).toEqual({ ativa: true, cupom: "BEMVINDA10", percentual: 10 })
    expect(lerConfigBoasVindas({ ativa: false, cupom: "X", percentual: 10 })).toBeNull()
    expect(lerConfigBoasVindas({ ativa: true, cupom: "", percentual: 10 })).toBeNull()
    expect(lerConfigBoasVindas({ ativa: true, cupom: "X", percentual: 0 })).toBeNull()
    expect(lerConfigBoasVindas(null)).toBeNull()
  })
})

describe("avisoPermitidoNaRota", () => {
  it("abre na vitrine; nunca em produto, conjunto (destinos do anúncio), sacola, checkout, pedido ou conta", () => {
    expect(avisoPermitidoNaRota("/br")).toBe(true)
    expect(avisoPermitidoNaRota("/br/categories/conjuntos")).toBe(true)
    expect(avisoPermitidoNaRota("/br/cartola")).toBe(true) // começa com "cart" mas não é a sacola
    expect(avisoPermitidoNaRota("/br/conjuntos/conjunto-aurora")).toBe(false)
    expect(avisoPermitidoNaRota("/br/products/macaquinho-solaris")).toBe(false)
    expect(avisoPermitidoNaRota("/br/cart")).toBe(false)
    expect(avisoPermitidoNaRota("/br/checkout")).toBe(false)
    expect(avisoPermitidoNaRota("/br/order/x/confirmed")).toBe(false)
    expect(avisoPermitidoNaRota("/br/account/orders")).toBe(false)
  })
})

describe("mascararCelular", () => {
  it("formata enquanto digita e ignora o 55 colado", () => {
    expect(mascararCelular("31")).toBe("31")
    expect(mascararCelular("31991")).toBe("(31) 991")
    expect(mascararCelular("3133334444")).toBe("(31) 3333-4444")
    expect(mascararCelular("31991184431")).toBe("(31) 99118-4431")
    expect(mascararCelular("+55 31 99118-4431")).toBe("(31) 99118-4431")
  })
})
