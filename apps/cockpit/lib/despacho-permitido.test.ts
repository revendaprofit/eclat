import { describe, expect, it } from "vitest"
import { podeDespachar } from "./despacho-permitido"

describe("decidir despacho", () => {
  it("pedido pago e não despachado pode sair", () => {
    expect(podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "captured" })).toEqual({ pode: true })
  })

  it("pagamento estornado impede o despacho", () => {
    const d = podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "refunded" })
    expect(d.pode).toBe(false)
    expect(d.pode === false && d.motivo).toMatch(/estornado/i)
  })

  it("estorno parcial também para, para a pessoa conferir o valor", () => {
    const d = podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "partially_refunded" })
    expect(d.pode).toBe(false)
  })

  it("pedido não pago ou cancelado não sai", () => {
    expect(podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "not_paid" }).pode).toBe(false)
    expect(podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "canceled" }).pode).toBe(false)
  })

  it("já despachado continua barrado, como antes", () => {
    const d = podeDespachar({ fulfillment_status: "shipped", payment_status: "captured" })
    expect(d.pode === false && d.motivo).toBe("Este pedido já foi despachado.")
  })

  it("estado de pagamento desconhecido não inventa impedimento", () => {
    expect(podeDespachar({ fulfillment_status: "not_fulfilled", payment_status: "authorized" }).pode).toBe(true)
    expect(podeDespachar({ fulfillment_status: "not_fulfilled" }).pode).toBe(true)
  })
})
