describe("fiscal-client", () => {
  const OLD = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = {
      ...OLD,
      BRASILNFE_USER_TOKEN: "user-token",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
  })

  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  it("envia os dois headers de autenticação", async () => {
    const spy = jest.fn().mockResolvedValue(new Response("{}", { status: 200 }))
    global.fetch = spy as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    await transmitir({ modelo: 55 })
    const headers = spy.mock.calls[0][1].headers as Record<string, string>
    expect(headers.UserToken).toBe("user-token")
    expect(headers.Token).toBe("company-token")
  })

  it("nunca vaza o token na mensagem de erro", async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response("erro interno", { status: 500 }))
      .mockResolvedValueOnce(new Response("erro interno", { status: 500 }))
    const { transmitir } = await import("../fiscal-client.js")
    await expect(transmitir({ modelo: 55 })).rejects.toThrow()
    await expect(transmitir({ modelo: 55 })).rejects.not.toThrow(/user-token|company-token/)
  })

  it("redaciona tokens do corpo de erro se vazassem", async () => {
    // Se o servidor retorna um erro contendo os tokens literais, eles devem ser redacionados.
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response("erro: token user-token rejeitado", { status: 500 }))
      .mockResolvedValueOnce(new Response("erro: token user-token rejeitado", { status: 500 }))
    const { transmitir } = await import("../fiscal-client.js")
    await expect(transmitir({ modelo: 55 })).rejects.toThrow(/\*\*\*/)
    // Prova que o token literal não vaza: segunda chamada não reutiliza corpo.
    await expect(transmitir({ modelo: 55 })).rejects.not.toThrow(/user-token/)
  })

  it("normaliza resposta autorizada", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "autorizado",
          chave: "31260968673407000113550010000000011000000017",
          numero: 1,
          serie: 1,
          xml_url: "https://x/xml",
          danfe_url: "https://x/pdf",
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(true)
    expect(r.chave_acesso).toHaveLength(44)
  })

  it("normaliza resposta rejeitada com código e motivo", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ status: "rejeitado", codigo_status: "539", motivo: "Duplicidade de NF-e" }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(false)
    expect(r.status_sefaz).toBe("539")
    expect(r.motivo).toMatch(/Duplicidade/)
  })

  // Achado I2/5.1: 5xx é queda de INFRA do fornecedor, não recusa de negócio — não pode virar
  // ErroFiscal (que as rotas mapeiam para 422, mascarando a queda como erro do operador).
  it("lança ErroFiscal para 4xx do fornecedor (requisição malformada ou rejeição)", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("payload inválido", { status: 400 }))
    const { transmitir } = await import("../fiscal-client.js")
    const { ErroFiscal } = await import("../tipos.js")
    await expect(transmitir({ modelo: 55 })).rejects.toBeInstanceOf(ErroFiscal)
  })

  it("NÃO lança ErroFiscal para 500 do fornecedor — é infra, deve virar 500 na rota", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("erro interno", { status: 500 }))
    const { transmitir } = await import("../fiscal-client.js")
    const { ErroFiscal } = await import("../tipos.js")
    let capturado: unknown
    try {
      await transmitir({ modelo: 55 })
    } catch (e) {
      capturado = e
    }
    expect(capturado).toBeInstanceOf(Error)
    expect(capturado).not.toBeInstanceOf(ErroFiscal)
  })

  it("NÃO lança ErroFiscal para 502/503 do fornecedor (indisponibilidade)", async () => {
    global.fetch = jest.fn().mockResolvedValue(new Response("bad gateway", { status: 502 }))
    const { transmitir } = await import("../fiscal-client.js")
    const { ErroFiscal } = await import("../tipos.js")
    let capturado: unknown
    try {
      await transmitir({ modelo: 55 })
    } catch (e) {
      capturado = e
    }
    expect(capturado).toBeInstanceOf(Error)
    expect(capturado).not.toBeInstanceOf(ErroFiscal)
  })

  it("reporta não configurado sem tokens", async () => {
    process.env = { ...OLD }
    delete process.env.BRASILNFE_USER_TOKEN
    delete process.env.BRASILNFE_COMPANY_TOKEN
    const { brasilNfeConfigured } = await import("../fiscal-client.js")
    expect(brasilNfeConfigured()).toBe(false)
  })

  it("normaliza 'autorizada' com gênero feminino", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "autorizada",
          chave: "31260968673407000113550010000000011000000017",
          numero: 1,
          serie: 1,
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(true)
  })

  it("normaliza 'Autorizada' com capitalização variada", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: "Autorizada",
          chave: "31260968673407000113550010000000011000000017",
          numero: 1,
          serie: 1,
        }),
        { status: 200 }
      )
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    const r = await transmitir({ modelo: 55 })
    expect(r.autorizado).toBe(true)
  })

  it("redaciona token com metacaracteres sem lançar SyntaxError", async () => {
    // Testa que escaparRegex() permite redacionar tokens com metacaracteres (ex: a+b, a.b*c).
    process.env = {
      ...process.env,
      BRASILNFE_USER_TOKEN: "token.a+b*c",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: token token.a+b*c inválido", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    // Não deve lançar SyntaxError de regex inválida durante redação — redaciona corretamente.
    await expect(transmitir({ modelo: 55 })).rejects.toThrow(/\*\*\*/)
  })

  it("redaciona token com metacaracteres sem vazar o valor literal", async () => {
    // Prova que escaparRegex() funciona: valor com metacaracteres não vaza.
    process.env = {
      ...process.env,
      BRASILNFE_USER_TOKEN: "token.a+b*c",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: token token.a+b*c inválido", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    // O token literal não deve aparecer: foi redacionado.
    await expect(transmitir({ modelo: 55 })).rejects.not.toThrow(/token\.a\+b\*c/)
  })

  it("redaciona token com quantificador líder sem lançar SyntaxError", async () => {
    // Testa que escaparRegex() trata quantificadores líderes (+abc, *abc, ?abc).
    // Sem escape, new RegExp("+abc", "g") lança SyntaxError: Nothing to repeat.
    process.env = {
      ...process.env,
      BRASILNFE_USER_TOKEN: "+abc",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: token +abc inválido", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    // Não deve lançar SyntaxError durante redação — helper escapa corretamente.
    await expect(transmitir({ modelo: 55 })).rejects.toThrow(/\*\*\*/)
  })

  it("redaciona token com quantificador líder sem vazar", async () => {
    // Prova que escaparRegex() funciona: quantificador líder não causa crash e valor vaza redacionado.
    process.env = {
      ...process.env,
      BRASILNFE_USER_TOKEN: "+abc",
      BRASILNFE_COMPANY_TOKEN: "company-token",
    }
    jest.resetModules()
    global.fetch = jest.fn().mockResolvedValue(
      new Response("erro: token +abc inválido", { status: 500 })
    ) as unknown as typeof fetch
    const { transmitir } = await import("../fiscal-client.js")
    // O quantificador líder não vaza: foi redacionado.
    await expect(transmitir({ modelo: 55 })).rejects.not.toThrow(/\+abc/)
  })
})
