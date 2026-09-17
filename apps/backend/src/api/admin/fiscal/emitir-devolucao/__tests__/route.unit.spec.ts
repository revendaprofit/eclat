// Achado I8/5.3: a validação de quantidade da NFD aceitava `typeof === "number"`, o que deixa
// passar NaN (NaN < 1 e NaN > vendida são ambas falsas — as travas seguintes não pegam) e fração
// (1.5 vira "12.34.5" em reais(), NaN vira "NaN.NaN"). Com previa:true isso seria transmitido ao
// fornecedor. Teste direto na função da rota (não via HTTP) porque NaN não é representável em
// JSON — um cliente de verdade não consegue mandar isso pela rede, mas um chamador interno ou um
// corpo montado à mão pode, e a validação precisa recusar de qualquer forma antes de tocar no banco.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res
}

function mockReq(body: Record<string, unknown>): MedusaRequest {
  return {
    body,
    scope: { resolve: () => ({ warn: () => undefined, info: () => undefined, error: () => undefined }) },
  } as unknown as MedusaRequest
}

describe("POST /admin/fiscal/emitir-devolucao — validação de quantidade", () => {
  const casos: Array<[string, number]> = [
    ["NaN", NaN],
    ["fracionária (1.5)", 1.5],
    ["zero", 0],
  ]

  it.each(casos)("quantidade %s responde 400 sem tocar no banco", async (_nome, quantidade) => {
    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade }] })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toMatch(/quantidade/i)
  })

  it("quantidade inteira >= 1 passa da validação (segue adiante, não 400)", async () => {
    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade: 1 }] })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    // Sem mocks de fiscal-db/fiscal-pedido, a chamada real vai falhar mais adiante (rede/env) e
    // cair no catch -> 422/500, nunca 400 de validação de entrada.
    expect(res.statusCode).not.toBe(400)
  })
})
