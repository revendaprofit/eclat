import { describe, expect, it } from "vitest"
import { AVISO_PAGAMENTO, PAGAMENTOS_CONFIRMADOS, pagamentoConfirmado } from "./pagamento-despacho"

describe("pagamentoConfirmado", () => {
  it("é true para cada status de pagamento confirmado", () => {
    expect(pagamentoConfirmado("captured")).toBe(true)
    expect(pagamentoConfirmado("authorized")).toBe(true)
    expect(pagamentoConfirmado("partially_captured")).toBe(true)
  })

  it("é false para pedido não pago, aguardando, cancelado ou estornado", () => {
    expect(pagamentoConfirmado("not_paid")).toBe(false)
    expect(pagamentoConfirmado("awaiting")).toBe(false)
    expect(pagamentoConfirmado("canceled")).toBe(false)
    expect(pagamentoConfirmado("refunded")).toBe(false)
  })

  it("é false para vazio, null, undefined e status desconhecido", () => {
    expect(pagamentoConfirmado("")).toBe(false)
    expect(pagamentoConfirmado(null)).toBe(false)
    expect(pagamentoConfirmado(undefined)).toBe(false)
    expect(pagamentoConfirmado("pago")).toBe(false)
  })
})

describe("PAGAMENTOS_CONFIRMADOS", () => {
  // Trava de regressão: o conjunto é o mesmo que o DRE/dashboard trata como pago
  // (app/api/dashboard/route.ts, PAGOS). Se alguém afrouxar aqui, o teste quebra.
  it("tem exatamente os três status pagos do dashboard", () => {
    expect([...PAGAMENTOS_CONFIRMADOS].sort()).toEqual(["authorized", "captured", "partially_captured"])
  })
})

describe("AVISO_PAGAMENTO", () => {
  it("avisa que o pedido não consta como pago e que a etiqueta gasta saldo", () => {
    expect(AVISO_PAGAMENTO).toContain("não consta como pago")
    expect(AVISO_PAGAMENTO).toContain("saldo")
  })
})
