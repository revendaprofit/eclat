import { describe, expect, it } from "vitest"
import { AVISO_PAGAMENTO, PAGAMENTOS_CONFIRMADOS, pagamentoConfirmado, pedeConfirmacaoDePagamento } from "./pagamento-despacho"

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
  // Trava de regressão: é este o conjunto que o despacho usa para a guarda de pagamento
  // (app/api/orders/[id]/dispatch/route.ts e a tela de pedidos) e que o dashboard e o DRE importam
  // para somar receita (app/api/dashboard/route.ts, app/api/finance/dre/route.ts). Se alguém
  // afrouxar aqui, o teste quebra.
  it("tem exatamente os três status pagos (despacho, dashboard e DRE)", () => {
    expect([...PAGAMENTOS_CONFIRMADOS].sort()).toEqual(["authorized", "captured", "partially_captured"])
  })
})

describe("AVISO_PAGAMENTO", () => {
  it("avisa que o pedido não consta como pago e que a etiqueta gasta saldo", () => {
    expect(AVISO_PAGAMENTO).toContain("não consta como pago")
    expect(AVISO_PAGAMENTO).toContain("saldo")
  })
})

describe("pedeConfirmacaoDePagamento (o aviso vermelho e a caixa de confirmação na tela)", () => {
  // A rota só exige `pagamento_conferido` no caminho da ETIQUETA (use_carrier && não pago). A tela
  // mostra o aviso só onde a etiqueta pode ser gerada: pedido não pago e que não é entrega por app
  // (esse não tem etiqueta — o botão fica desligado).
  const correios = [{ shipping_option: { provider_id: "superfrete_superfrete" }, data: {} }]
  const porApp = [{ data: { tipo: "entrega_app" } }]

  it("não pago, com etiqueta possível → pede", () => {
    expect(pedeConfirmacaoDePagamento({ payment_status: "not_paid", shipping_methods: correios })).toBe(true)
    expect(pedeConfirmacaoDePagamento({ payment_status: "awaiting", shipping_methods: [] })).toBe(true)
  })

  it("pago → não pede", () => {
    expect(pedeConfirmacaoDePagamento({ payment_status: "captured", shipping_methods: correios })).toBe(false)
  })

  it("entrega por aplicativo (sem etiqueta) → não pede, mesmo sem pagamento", () => {
    expect(pedeConfirmacaoDePagamento({ payment_status: "not_paid", shipping_methods: porApp })).toBe(false)
  })
})
