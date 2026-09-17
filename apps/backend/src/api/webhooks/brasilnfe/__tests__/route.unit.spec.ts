// I2 (achado importante da revisão final de 2026-09-17): a rota do webhook não tinha teste
// nenhum. fiscal-webhook.ts (assinaturaValida/chavesDoLote) NÃO é mockado aqui de propósito —
// os testes assinam de verdade com HMAC-SHA256 sobre os bytes crus, provando a integração real
// entre a rota e a verificação de assinatura.
import { createHmac } from "node:crypto"

const SEGREDO = "segredo-de-teste"
const CHAVE_1 = "3".repeat(44)
const CHAVE_2 = "4".repeat(44)

function assinar(corpoBruto: Buffer, segredo: string): string {
  return "sha256=" + createHmac("sha256", segredo).update(corpoBruto).digest("hex")
}

function fakeRes() {
  const res: any = { statusCode: 200, body: undefined as unknown }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: unknown) => { res.body = b; return res }
  return res
}

function fakeReq(opts: { body: unknown; rawBody?: Buffer; signature?: string }) {
  return {
    headers: opts.signature !== undefined ? { "x-webhook-signature": opts.signature } : {},
    rawBody: opts.rawBody,
    body: opts.body,
    scope: { resolve: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) },
  } as any
}

function mocks() {
  const documentoPorChave = jest.fn()
  const reconciliarDocumento = jest.fn()
  jest.doMock("../../../../lib/fiscal/fiscal-db", () => ({ documentoPorChave }))
  jest.doMock("../../../../lib/fiscal/fiscal-reconciliar", () => ({
    reconciliarDocumento,
    STATUS_TERMINAIS: new Set(["verificado", "rejeitado", "denegado"]),
  }))
  return { documentoPorChave, reconciliarDocumento }
}

describe("POST /webhooks/brasilnfe", () => {
  beforeEach(() => {
    jest.resetModules()
    process.env.BRASILNFE_WEBHOOK_SECRET = SEGREDO
  })
  afterEach(() => {
    jest.restoreAllMocks()
    delete process.env.BRASILNFE_WEBHOOK_SECRET
  })

  it("assinatura válida de um test.ping responde 200 sem tocar no banco", async () => {
    const { documentoPorChave, reconciliarDocumento } = mocks()
    const body = { event: "test.ping", deliveryId: "d1", data: {} }
    const raw = Buffer.from(JSON.stringify(body), "utf8")
    const { POST } = await import("../route.js")

    const res = fakeRes()
    await POST(fakeReq({ body, rawBody: raw, signature: assinar(raw, SEGREDO) }), res)

    expect(res.statusCode).toBe(200)
    expect(documentoPorChave).not.toHaveBeenCalled()
    expect(reconciliarDocumento).not.toHaveBeenCalled()
  })

  it("mesmo corpo com 1 byte alterado: 401, e documentoPorChave/reconciliarDocumento NÃO chamados", async () => {
    const { documentoPorChave, reconciliarDocumento } = mocks()
    const body = { event: "test.ping", deliveryId: "d1", data: {} }
    const rawOriginal = Buffer.from(JSON.stringify(body), "utf8")
    const sig = assinar(rawOriginal, SEGREDO)
    const rawAlterado = Buffer.from(rawOriginal)
    rawAlterado[0] = rawAlterado[0] ^ 0x01 // 1 byte diferente do que assinou
    const { POST } = await import("../route.js")

    const res = fakeRes()
    await POST(fakeReq({ body, rawBody: rawAlterado, signature: sig }), res)

    expect(res.statusCode).toBe(401)
    expect(documentoPorChave).not.toHaveBeenCalled()
    expect(reconciliarDocumento).not.toHaveBeenCalled()
  })

  it("rawBody ausente: 401", async () => {
    mocks()
    const body = { event: "test.ping" }
    const raw = Buffer.from(JSON.stringify(body), "utf8")
    const { POST } = await import("../route.js")

    const res = fakeRes()
    // header presente e "correto" para um corpo que a rota nunca recebeu como bytes crus —
    // sem rawBody, assinaturaValida recusa antes de comparar.
    await POST(fakeReq({ body, rawBody: undefined, signature: assinar(raw, SEGREDO) }), res)

    expect(res.statusCode).toBe(401)
  })

  it("nfe.lote.finalizado com chave autorizado_nao_verificado: chama reconciliarDocumento com o id", async () => {
    const { documentoPorChave, reconciliarDocumento } = mocks()
    documentoPorChave.mockResolvedValue({ id: "doc_1", status: "autorizado_nao_verificado" })
    reconciliarDocumento.mockResolvedValue({ verificado: true, divergencias: [] })
    const body = { event: "nfe.lote.finalizado", deliveryId: "d2", data: { notas: [{ chaveAcesso: CHAVE_1 }] } }
    const raw = Buffer.from(JSON.stringify(body), "utf8")
    const { POST } = await import("../route.js")

    const res = fakeRes()
    await POST(fakeReq({ body, rawBody: raw, signature: assinar(raw, SEGREDO) }), res)

    expect(res.statusCode).toBe(200)
    expect(documentoPorChave).toHaveBeenCalledWith(CHAVE_1)
    expect(reconciliarDocumento).toHaveBeenCalledWith("doc_1")
  })

  it("nfe.lote.finalizado com chave já verificado: NÃO chama reconciliarDocumento", async () => {
    const { documentoPorChave, reconciliarDocumento } = mocks()
    documentoPorChave.mockResolvedValue({ id: "doc_2", status: "verificado" })
    const body = { event: "nfe.lote.finalizado", deliveryId: "d3", data: { notas: [{ chaveAcesso: CHAVE_2 }] } }
    const raw = Buffer.from(JSON.stringify(body), "utf8")
    const { POST } = await import("../route.js")

    const res = fakeRes()
    await POST(fakeReq({ body, rawBody: raw, signature: assinar(raw, SEGREDO) }), res)

    expect(res.statusCode).toBe(200)
    expect(reconciliarDocumento).not.toHaveBeenCalled()
  })

  it("reconciliarDocumento lançando: a rota ainda responde 200 (autenticado e recebido)", async () => {
    const { documentoPorChave, reconciliarDocumento } = mocks()
    documentoPorChave.mockResolvedValue({ id: "doc_3", status: "autorizado_nao_verificado" })
    reconciliarDocumento.mockRejectedValue(new Error("boom"))
    const body = { event: "nfe.lote.finalizado", deliveryId: "d4", data: { notas: [{ chaveAcesso: CHAVE_1 }] } }
    const raw = Buffer.from(JSON.stringify(body), "utf8")
    const { POST } = await import("../route.js")

    const res = fakeRes()
    await POST(fakeReq({ body, rawBody: raw, signature: assinar(raw, SEGREDO) }), res)

    expect(res.statusCode).toBe(200)
  })
})
