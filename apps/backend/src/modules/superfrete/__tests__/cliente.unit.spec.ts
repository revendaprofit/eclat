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
