describe("GET /admin/fiscal/documentos/:id/danfe", () => {
  const UUID = "3f2b8c1e-5a4d-4e6f-9a7b-1c2d3e4f5a6b"
  const CHAVE = "31260968673407000113550010000000011000000017"

  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  function fakeRes() {
    const res: any = { statusCode: 200, headers: {} as Record<string, string>, body: undefined as unknown }
    res.status = (c: number) => { res.statusCode = c; return res }
    res.json = (b: unknown) => { res.body = b; return res }
    res.setHeader = (k: string, v: string) => { res.headers[k] = v; return res }
    res.send = (b: unknown) => { res.body = b; return res }
    return res
  }
  function fakeReq(id: string) {
    return { params: { id }, scope: { resolve: () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn() }) } } as any
  }

  function mocks(doc: unknown, baixarArquivo = jest.fn().mockResolvedValue(Buffer.from("%PDF-1.4"))) {
    jest.doMock("../../../../../../../lib/fiscal/fiscal-db", () => ({
      ehUuidValido: (v: string) => /^[0-9a-f-]{36}$/i.test(v),
      lerDocumento: jest.fn(async () => {
        if (!doc) throw new Error("Documento fiscal x não encontrado.")
        return doc
      }),
    }))
    jest.doMock("../../../../../../../lib/fiscal/fiscal-client", () => ({ baixarArquivo }))
    return { baixarArquivo }
  }

  it("id que não é uuid: 400, sem tocar no banco nem no fornecedor", async () => {
    const { baixarArquivo } = mocks({ id: UUID, chave_acesso: CHAVE })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq("../../customers"), res)
    expect(res.statusCode).toBe(400)
    expect(baixarArquivo).not.toHaveBeenCalled()
  })

  it("documento sem chave de acesso: 422 com mensagem legível", async () => {
    mocks({ id: UUID, chave_acesso: null, status: "rejeitado" })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(res.statusCode).toBe(422)
    expect(res.body.error).toMatch(/não foi autorizada/i)
  })

  it("documento autorizado: devolve o PDF com o Content-Type certo", async () => {
    const { baixarArquivo } = mocks({ id: UUID, chave_acesso: CHAVE, status: "verificado" })
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(baixarArquivo).toHaveBeenCalledWith(CHAVE, "danfe")
    expect(res.statusCode).toBe(200)
    expect(res.headers["Content-Type"]).toBe("application/pdf")
    expect(Buffer.isBuffer(res.body)).toBe(true)
  })

  it("documento inexistente: 422, não 500", async () => {
    mocks(null)
    const { GET } = await import("../route.js")
    const res = fakeRes()
    await GET(fakeReq(UUID), res)
    expect(res.statusCode).toBe(422)
  })
})
