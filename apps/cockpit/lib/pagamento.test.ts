import { describe, expect, it } from "vitest"
import { resumoDoPagamento, taxasDePagamento } from "./pagamento"

const MP = "pp_mercadopago_mercadopago"

describe("resumoDoPagamento", () => {
  it("cartão do Mercado Pago: método, final, parcelas, bandeira e tarifa em centavos", () => {
    expect(
      resumoDoPagamento([
        { provider_id: MP, amount: 213.9, data: { metodo: "cartao", bandeira: "master", parcelas: 3, final_cartao: "3311", tarifa_centavos: 960, liquido_centavos: 20430, mp_order_id: "ORD1", mp_payment_id: "PAY1" } },
      ])
    ).toEqual({
      metodo: "Cartão de crédito",
      detalhe: "final 3311 · 3x · master",
      tarifa_centavos: 960,
      liquido_centavos: 20430,
      mp_order_id: "ORD1",
      mp_payment_id: "PAY1",
      ehMercadoPago: true,
    })
  })

  it("Pix: sem parcelas nem final; tarifa ausente vira null (nunca zero)", () => {
    const r = resumoDoPagamento([{ provider_id: MP, amount: 100, data: { metodo: "pix", mp_order_id: "ORD2" } }])
    expect(r?.metodo).toBe("Pix")
    expect(r?.detalhe).toBe("")
    expect(r?.tarifa_centavos).toBeNull()
  })

  it("provider manual vira 'Pix pelo WhatsApp', sem tarifa", () => {
    const r = resumoDoPagamento([{ provider_id: "pp_system_default", amount: 100, data: {} }])
    expect(r).toMatchObject({ metodo: "Pix pelo WhatsApp", ehMercadoPago: false, tarifa_centavos: null })
  })

  it("ignora pagamento cancelado quando há outro válido", () => {
    const r = resumoDoPagamento([
      { provider_id: MP, amount: 100, canceled_at: "2026-09-17", data: { metodo: "cartao" } },
      { provider_id: MP, amount: 100, data: { metodo: "pix" } },
    ])
    expect(r?.metodo).toBe("Pix")
  })

  it("sem pagamentos devolve null", () => {
    expect(resumoDoPagamento([])).toBeNull()
    expect(resumoDoPagamento(undefined)).toBeNull()
  })

  it("tarifa só conta se for inteiro (centavos) — nunca aceita float", () => {
    const r = resumoDoPagamento([{ provider_id: MP, amount: 100, data: { metodo: "pix", tarifa_centavos: 9.96 } }])
    expect(r?.tarifa_centavos).toBeNull()
  })
})

describe("taxasDePagamento (linha do DRE)", () => {
  it("soma a tarifa real dos pagamentos do Mercado Pago e conta os sem tarifa", () => {
    expect(
      taxasDePagamento([
        { payment_collections: [{ payments: [{ provider_id: MP, amount: 1, data: { tarifa_centavos: 996 } }] }] },
        { payment_collections: [{ payments: [{ provider_id: MP, amount: 1, data: { tarifa_centavos: 198 } }] }] },
        { payment_collections: [{ payments: [{ provider_id: MP, amount: 1, data: { metodo: "pix" } }] }] },
        { payment_collections: [{ payments: [{ provider_id: "pp_system_default", amount: 1, data: {} }] }] },
        { payment_collections: null },
      ])
    ).toEqual({ total_centavos: 1194, sem_tarifa: 1 })
  })

  it("pagamento cancelado não entra", () => {
    expect(
      taxasDePagamento([{ payment_collections: [{ payments: [{ provider_id: MP, amount: 1, canceled_at: "x", data: { tarifa_centavos: 500 } }] }] }])
    ).toEqual({ total_centavos: 0, sem_tarifa: 0 })
  })
})
