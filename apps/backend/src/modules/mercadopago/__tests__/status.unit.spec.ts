import { estaAprovada, paraAcaoDoWebhook, paraStatusDaSessao } from "../status"

// Tabela oficial de status/status_detail da Orders API (doc lida em 2026-09-17,
// checkout-api-orders/payment-management/status/order-status) — reproduzida na spec §7.
describe("status (mapa da Orders API pros enums do Medusa)", () => {
  describe("paraStatusDaSessao", () => {
    it.each([
      [{ status: "processed", status_detail: "accredited" }, "captured"],
      [{ status: "processed", status_detail: "partially_refunded" }, "captured"],
      [{ status: "processing", status_detail: "in_process" }, "pending"],
      [{ status: "action_required", status_detail: "waiting_payment" }, "pending"],
      [{ status: "action_required", status_detail: "waiting_capture" }, "pending"],
      [{ status: "action_required", status_detail: "waiting_transfer" }, "pending"],
      [{ status: "action_required", status_detail: "waiting_retry" }, "pending"],
      [{ status: "canceled", status_detail: "canceled" }, "canceled"],
      [{ status: "expired", status_detail: "expired" }, "canceled"],
      [{ status: "failed", status_detail: "failed" }, "error"],
      [{ status: "refunded", status_detail: "refunded" }, "error"],
      [{ status: "charged_back", status_detail: "settled" }, "error"],
      [{ status: "algo_desconhecido" }, "error"],
    ] as const)("%o -> %s", (order, esperado) => {
      expect(paraStatusDaSessao(order)).toBe(esperado)
    })
  })

  describe("paraAcaoDoWebhook", () => {
    it.each([
      [{ status: "processed", status_detail: "accredited" }, "captured"],
      [{ status: "processing", status_detail: "in_process" }, "pending"],
      [{ status: "action_required", status_detail: "waiting_transfer" }, "pending"],
      [{ status: "canceled", status_detail: "canceled" }, "canceled"],
      [{ status: "expired", status_detail: "expired" }, "canceled"],
      [{ status: "failed", status_detail: "failed" }, "failed"],
      [{ status: "refunded", status_detail: "refunded" }, "not_supported"],
      [{ status: "charged_back", status_detail: "in_process" }, "not_supported"],
      [{ status: "charged_back", status_detail: "reimbursed" }, "not_supported"],
      [{ status: "algo_desconhecido" }, "not_supported"],
    ] as const)("%o -> %s", (order, esperado) => {
      expect(paraAcaoDoWebhook(order)).toBe(esperado)
    })
  })

  describe("estaAprovada", () => {
    it("só é true em processed/accredited", () => {
      expect(estaAprovada({ status: "processed", status_detail: "accredited" })).toBe(true)
    })

    it("é false em processed/partially_refunded (parcialmente estornado)", () => {
      expect(estaAprovada({ status: "processed", status_detail: "partially_refunded" })).toBe(false)
    })

    it("é false em qualquer outro status", () => {
      expect(estaAprovada({ status: "processing", status_detail: "in_process" })).toBe(false)
      expect(estaAprovada({ status: "action_required", status_detail: "waiting_transfer" })).toBe(false)
    })
  })
})
