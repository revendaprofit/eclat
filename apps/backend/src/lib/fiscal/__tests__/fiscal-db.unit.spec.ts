describe("fiscal-db", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k" }
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  it("reporta configurado quando as env vars existem", async () => {
    const { fiscalDbConfigured } = await import("../fiscal-db")
    expect(fiscalDbConfigured()).toBe(true)
  })

  it("acharPorIdempotencia devolve null quando não há linha", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("[]", { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db")
    expect(await acharPorIdempotencia("order_1:venda:homologacao")).toBeNull()
  })

  it("acharPorIdempotencia devolve o documento existente", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "doc_1", status: "verificado" }]), { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db")
    const doc = await acharPorIdempotencia("order_1:venda:homologacao")
    expect(doc?.id).toBe("doc_1")
  })

  it("propaga erro legível quando o Supabase responde erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db")
    await expect(getConfig()).rejects.toThrow(/Supabase/)
  })

  it("nunca põe o service key na mensagem de erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db")
    await expect(getConfig()).rejects.not.toThrow(/\bk\b.*service/i)
  })
})
