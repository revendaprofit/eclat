import { ClienteSuperfrete, ErroSuperfrete } from "../cliente"

const PACOTE = { pecas: 1, largura: 15, altura: 4, comprimento: 15, peso_kg: 0.21 }
const opcoes = { token: "tok-teste", contato: "teste@example.com", cepOrigem: "01001000" }

function respostaFetch(status: number, corpo: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => corpo, text: async () => JSON.stringify(corpo) }
}

describe("ClienteSuperfrete.cotar", () => {
  const fetchOriginal = global.fetch
  afterEach(() => {
    global.fetch = fetchOriginal
  })

  it("chama o calculator do ambiente certo com os headers exigidos e o pacote em cm/kg", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, []))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete({ ...opcoes, sandbox: true }).cotar("30130-010", PACOTE)

    const [url, init] = chamado.mock.calls[0]
    expect(url).toBe("https://sandbox.superfrete.com/api/v0/calculator")
    expect(init.headers.Authorization).toBe("Bearer tok-teste")
    expect(init.headers["User-Agent"]).toBe("use.ECLAT (teste@example.com)")
    expect(JSON.parse(init.body)).toEqual({
      from: { postal_code: "01001000" },
      to: { postal_code: "30130010" },
      services: "1,2,17",
      options: { own_hand: false, receipt: false, insurance_value: 0, use_insurance_value: false },
      package: { width: 15, height: 4, length: 15, weight: 0.21 },
    })
  })

  it("produção é o padrão", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, []))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)
    expect(chamado.mock.calls[0][0]).toBe("https://api.superfrete.com/api/v0/calculator")
  })

  it("converte preço para centavos, lê o prazo e descarta serviço com erro ou desconhecido", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respostaFetch(200, [
        { id: 1, name: "PAC", price: 17.43, delivery_time: 6, delivery_range: { min: 5, max: 6 }, has_error: false },
        { id: 2, name: "SEDEX", price: "22.1", delivery_time: 2, has_error: false },
        { id: 17, name: "Mini Envios", has_error: true, error: "Dimensões inválidas" },
        { id: 3, name: "Jadlog", price: 30, delivery_time: 4, has_error: false },
      ])
    ) as unknown as typeof fetch

    expect(await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)).toEqual([
      { servico: "pac", centavos: 1743, prazoMin: 5, prazoMax: 6 },
      { servico: "sedex", centavos: 2210, prazoMin: 2, prazoMax: 2 },
    ])
  })

  it("HTTP de erro vira ErroSuperfrete sem vazar o token", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(401, { message: "Unauthenticated." })) as unknown as typeof fetch
    const erro = await new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE).catch((e) => e)
    expect(erro).toBeInstanceOf(ErroSuperfrete)
    expect(erro.message).toContain("401")
    expect(erro.message).not.toContain("tok-teste")
  })

  it("resposta que não é lista vira ErroSuperfrete", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(200, { message: "ok" })) as unknown as typeof fetch
    await expect(new ClienteSuperfrete(opcoes).cotar("30130010", PACOTE)).rejects.toBeInstanceOf(ErroSuperfrete)
  })

  it("timeout aborta a chamada", async () => {
    global.fetch = jest.fn((_u: string, init: RequestInit) =>
      new Promise((_r, rejeita) => init.signal?.addEventListener("abort", () => rejeita(new Error("aborted"))))
    ) as unknown as typeof fetch
    await expect(new ClienteSuperfrete({ ...opcoes, timeoutMs: 20 }).cotar("30130010", PACOTE)).rejects.toBeInstanceOf(ErroSuperfrete)
  })
})

describe("ClienteSuperfrete.consultarEtiqueta", () => {
  const fetchOriginal = global.fetch
  afterEach(() => {
    global.fetch = fetchOriginal
  })

  it("faz GET em /api/v0/order/info/{id} com os mesmos headers da cotação", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, { status: "released", tracking: "AA123456789BR", tags: [{ tag: "21" }] }))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete({ ...opcoes, sandbox: true }).consultarEtiqueta("ord_1")

    const [url, init] = chamado.mock.calls[0]
    expect(url).toBe("https://sandbox.superfrete.com/api/v0/order/info/ord_1")
    expect(init.method).toBe("GET")
    expect(init.headers.Authorization).toBe("Bearer tok-teste")
    expect(init.headers["User-Agent"]).toBe("use.ECLAT (teste@example.com)")
    expect(init.signal).toBeDefined()
  })

  it("o id vai codificado na URL (vem do metadata, não é confiável)", async () => {
    const chamado = jest.fn().mockResolvedValue(respostaFetch(200, {}))
    global.fetch = chamado as unknown as typeof fetch
    await new ClienteSuperfrete(opcoes).consultarEtiqueta("a/../b?x=1")
    expect(chamado.mock.calls[0][0]).toBe("https://api.superfrete.com/api/v0/order/info/a%2F..%2Fb%3Fx%3D1")
  })

  it("devolve só status, código e tags (como texto)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      respostaFetch(200, { id: "ord_1", status: "released", tracking: "AA123456789BR", tags: [{ tag: "21", url: null }, { tag: 7 }], price: 17.4 })
    ) as unknown as typeof fetch
    expect(await new ClienteSuperfrete(opcoes).consultarEtiqueta("ord_1")).toEqual({ status: "released", tracking: "AA123456789BR", tags: ["21", "7"] })
  })

  it("campos ausentes ou estranhos viram null / lista vazia; código vazio vira null", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(200, { tracking: "", tags: "21" })) as unknown as typeof fetch
    expect(await new ClienteSuperfrete(opcoes).consultarEtiqueta("ord_1")).toEqual({ status: "", tracking: null, tags: [] })
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(200, null)) as unknown as typeof fetch
    expect(await new ClienteSuperfrete(opcoes).consultarEtiqueta("ord_1")).toEqual({ status: "", tracking: null, tags: [] })
  })

  it("HTTP de erro vira ErroSuperfrete com o status, SEM o corpo da resposta nem o token", async () => {
    global.fetch = jest.fn().mockResolvedValue(respostaFetch(404, { message: "order not found", destinatario: "Fulana de Tal" })) as unknown as typeof fetch
    const erro = await new ClienteSuperfrete(opcoes).consultarEtiqueta("ord_1").catch((e) => e)
    expect(erro).toBeInstanceOf(ErroSuperfrete)
    expect(erro.message).toContain("404")
    expect(erro.message).not.toContain("Fulana")
    expect(erro.message).not.toContain("not found")
    expect(erro.message).not.toContain("tok-teste")
  })

  it("timeout aborta a chamada (padrão 8 s, configurável)", async () => {
    global.fetch = jest.fn((_u: string, init: RequestInit) =>
      new Promise((_r, rejeita) => init.signal?.addEventListener("abort", () => rejeita(new Error("aborted"))))
    ) as unknown as typeof fetch
    await expect(new ClienteSuperfrete({ ...opcoes, timeoutMs: 20 }).consultarEtiqueta("ord_1")).rejects.toBeInstanceOf(ErroSuperfrete)
  })
})
