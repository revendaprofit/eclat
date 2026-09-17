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
    const { fiscalDbConfigured } = await import("../fiscal-db.js")
    expect(fiscalDbConfigured()).toBe(true)
  })

  it("acharPorIdempotencia devolve null quando não há linha", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("[]", { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db.js")
    expect(await acharPorIdempotencia("order_1:venda:homologacao")).toBeNull()
  })

  it("acharPorIdempotencia devolve o documento existente", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify([{ id: "doc_1", status: "verificado" }]), { status: 200 })
    ) as unknown as typeof fetch
    const { acharPorIdempotencia } = await import("../fiscal-db.js")
    const doc = await acharPorIdempotencia("order_1:venda:homologacao")
    expect(doc?.id).toBe("doc_1")
  })

  it("listarDevolucoesDoDocumento devolve as devoluções do documento de origem", async () => {
    let urlChamada = ""
    global.fetch = jest.fn().mockImplementation((url: string) => {
      urlChamada = url
      return Promise.resolve(
        new Response(JSON.stringify([{ id: "dev_1", tipo: "devolucao", documento_origem_id: "doc_1" }]), {
          status: 200,
        })
      )
    }) as unknown as typeof fetch
    const { listarDevolucoesDoDocumento } = await import("../fiscal-db.js")
    const devolucoes = await listarDevolucoesDoDocumento("doc_1")
    expect(devolucoes).toHaveLength(1)
    expect(devolucoes[0].id).toBe("dev_1")
    // encodeURIComponent no id — padrão obrigatório de todo identificador interpolado.
    expect(urlChamada).toContain("documento_origem_id=eq.doc_1")
    expect(urlChamada).toContain("tipo=eq.devolucao")
  })

  it("listarDevolucoesDoDocumento escapa o id via encodeURIComponent", async () => {
    let urlChamada = ""
    global.fetch = jest.fn().mockImplementation((url: string) => {
      urlChamada = url
      return Promise.resolve(new Response("[]", { status: 200 }))
    }) as unknown as typeof fetch
    const { listarDevolucoesDoDocumento } = await import("../fiscal-db.js")
    await listarDevolucoesDoDocumento("doc com espaço")
    expect(urlChamada).toContain(encodeURIComponent("doc com espaço"))
    expect(urlChamada).not.toContain("doc com espaço")
  })

  it("propaga erro legível quando o Supabase responde erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    await expect(getConfig()).rejects.toThrow(/Supabase/)
  })

  it("nunca põe o service key na mensagem de erro", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response("boom", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    // Valida que a chave real definida no teste não vaza na mensagem de erro.
    await expect(getConfig()).rejects.not.toThrow(new RegExp(process.env.SUPABASE_SERVICE_ROLE_KEY!))
  })

  it("redaciona o service key do corpo de erro se vazasse", async () => {
    // Se o servidor retorna um erro contendo a chave literal, ela deve ser redacionada.
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response("erro: chave k inválida", { status: 500 }))
      .mockResolvedValueOnce(new Response("erro: chave k inválida", { status: 500 }))
    const { getConfig } = await import("../fiscal-db.js")
    await expect(getConfig()).rejects.toThrow(/\*\*\*/)
    // Prova que a chave literal não vaza: segunda chamada não reutiliza corpo.
    await expect(getConfig()).rejects.not.toThrow(/\bk\b/)
  })

  it("redaciona chave com metacaracteres sem lançar SyntaxError", async () => {
    // Testa que escaparRegex() permite redacionar chaves com metacaracteres (ex: a+b, a.b*c).
    process.env = {
      ...process.env,
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "ab+cd",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: chave ab+cd usada", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    // Não deve lançar SyntaxError de regex inválida durante redação — redaciona corretamente.
    await expect(getConfig()).rejects.toThrow(/\*\*\*/)
  })

  it("redaciona chave com metacaracteres sem vazar o valor literal", async () => {
    // Prova que escaparRegex() funciona: valor com metacaracteres não vaza.
    process.env = {
      ...process.env,
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "ab+cd",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: chave ab+cd usada", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    // A chave literal não deve aparecer: foi redacionada.
    await expect(getConfig()).rejects.not.toThrow(/ab\+cd/)
  })

  it("redaciona chave com quantificador líder sem lançar SyntaxError", async () => {
    // Testa que escaparRegex() trata quantificadores líderes (+abc, *abc, ?abc).
    // Sem escape, new RegExp("+abc", "g") lança SyntaxError: Nothing to repeat.
    process.env = {
      ...process.env,
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "+abc",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: chave +abc inválida", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    // Não deve lançar SyntaxError durante redação — helper escapa corretamente.
    await expect(getConfig()).rejects.toThrow(/\*\*\*/)
  })

  it("redaciona chave com quantificador líder sem vazar", async () => {
    // Prova que escaparRegex() funciona: quantificador líder não causa crash e valor vaza redacionado.
    process.env = {
      ...process.env,
      SUPABASE_URL: "https://x.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "+abc",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: chave +abc inválida", { status: 500 })
    ) as unknown as typeof fetch
    const { getConfig } = await import("../fiscal-db.js")
    // O quantificador líder não vaza: foi redacionado.
    await expect(getConfig()).rejects.not.toThrow(/\+abc/)
  })
})
