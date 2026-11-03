import { describe, expect, it } from "vitest"
import { DIAS_SEM_REPETIR, ehPaginaDaSacola, lerEstadoSacola, podeOferecer, rotaProibida } from "./sacola-guardada"

const DIA = 24 * 60 * 60 * 1000

describe("podeOferecer", () => {
  it("oferece a quem nunca viu", () => {
    expect(podeOferecer(lerEstadoSacola(null), 1000)).toBe(true)
  })
  it("nunca mais pede a quem já guardou", () => {
    expect(podeOferecer(lerEstadoSacola("guardou"), Date.now())).toBe(false)
  })
  it("só repete 7 dias depois de fechar", () => {
    const agora = 100 * DIA
    expect(podeOferecer(lerEstadoSacola(String(agora - DIA)), agora)).toBe(false)
    expect(podeOferecer(lerEstadoSacola(String(agora - DIAS_SEM_REPETIR * DIA)), agora)).toBe(true)
  })
  it("valor estranho no navegador conta como nunca visto", () => {
    expect(lerEstadoSacola("abc")).toBe(null)
  })
})

describe("rotas", () => {
  it("reconhece a sacola", () => {
    expect(ehPaginaDaSacola("/br/cart")).toBe(true)
    expect(ehPaginaDaSacola("/br/products/cart")).toBe(false)
  })
  it("não interrompe pagamento, pedido nem conta", () => {
    expect(rotaProibida("/br/checkout")).toBe(true)
    expect(rotaProibida("/br/order/123/confirmed")).toBe(true)
    expect(rotaProibida("/br/account")).toBe(true)
    expect(rotaProibida("/br/products/short-orvalho")).toBe(false)
    expect(rotaProibida("/br/cart")).toBe(false)
  })
})
