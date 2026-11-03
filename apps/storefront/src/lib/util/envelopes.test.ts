import { describe, expect, it } from "vitest"
import { ENVELOPES, envelopesPermitidos, lerConfigEnvelopes, lerEnvelopeId } from "./envelopes"

describe("lerConfigEnvelopes", () => {
  it("liga só com modo envelopes e cupom válido", () => {
    expect(lerConfigEnvelopes({ ativa: true, modo: "envelopes", cupom: "bemvinda10", percentual: 10 })).toEqual({ cupom: "BEMVINDA10", percentual: 10 })
  })
  it("fica desligado no modo atual, sem cupom ou desativado", () => {
    expect(lerConfigEnvelopes({ ativa: true, modo: "presente" })).toBe(null)
    expect(lerConfigEnvelopes({ ativa: true, modo: "envelopes", cupom: "", percentual: 10 })).toBe(null)
    expect(lerConfigEnvelopes({ ativa: false, modo: "envelopes", cupom: "X", percentual: 10 })).toBe(null)
    expect(lerConfigEnvelopes(null)).toBe(null)
  })
})

describe("envelopes", () => {
  it("são os três escolhidos pela sócia", () => {
    expect(ENVELOPES.map((e) => e.id)).toEqual(["voucher", "consultoria", "presente"])
  })
  it("só aceita escolha conhecida", () => {
    expect(lerEnvelopeId("presente")).toBe("presente")
    expect(lerEnvelopeId("qualquer")).toBe(null)
    expect(lerEnvelopeId(undefined)).toBe(null)
  })
  it("abre na página de produto e não interrompe quem está comprando", () => {
    expect(envelopesPermitidos("/br/products/short-orvalho")).toBe(true)
    expect(envelopesPermitidos("/br")).toBe(true)
    for (const r of ["/br/cart", "/br/checkout", "/br/order/1/confirmed", "/br/account"]) expect(envelopesPermitidos(r)).toBe(false)
  })
})
