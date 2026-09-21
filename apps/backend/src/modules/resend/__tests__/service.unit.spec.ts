import ResendNotificationService from "../service"

function mockFetch(status: number, corpo: unknown) {
  const spy = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
    text: async () => JSON.stringify(corpo),
  })
  global.fetch = spy as unknown as typeof fetch
  return spy
}

const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() }
const opcoes = {
  apiKey: "re_segredo",
  from: "use.ÉCLAT <pedidos@useeclat.com.br>",
  replyTo: "contato@useeclat.com.br",
}
const dados = {
  numero: "42",
  primeiroNome: "Ana",
  itens: [],
  subtotal: "R$ 1,00",
  frete: "R$ 24,90",
  desconto: null,
  total: "R$ 25,90",
  endereco: [],
  avisoEnvio: null,
  lojaUrl: "https://l",
  pedidoUrl: "https://l/br/order/o/confirmed",
  whatsapp: "5531991184431",
}

describe("ResendNotificationService", () => {
  afterEach(() => jest.restoreAllMocks())

  it("validateOptions exige apiKey e from", () => {
    expect(() => ResendNotificationService.validateOptions({ from: "a@b.c" })).toThrow(/apiKey/)
    expect(() => ResendNotificationService.validateOptions({ apiKey: "re_x" })).toThrow(/from/)
    expect(() => ResendNotificationService.validateOptions(opcoes)).not.toThrow()
  })

  it("send monta o e-mail pelo template e posta na API do Resend", async () => {
    const spy = mockFetch(200, { id: "email_123" })
    const svc = new ResendNotificationService({ logger } as never, opcoes)

    const r = await svc.send({
      to: "cliente@exemplo.com",
      channel: "email",
      template: "pedido-confirmado",
      data: { ...dados, idempotencia: "pedido-confirmado-order_01" },
    })

    expect(r).toEqual({ id: "email_123" })
    const [url, init] = spy.mock.calls[0]
    expect(url).toBe("https://api.resend.com/emails")
    expect(init.headers.authorization).toBe("Bearer re_segredo")
    expect(init.headers["idempotency-key"]).toBe("pedido-confirmado-order_01")
    const corpo = JSON.parse(init.body)
    expect(corpo.from).toBe(opcoes.from)
    expect(corpo.to).toEqual(["cliente@exemplo.com"])
    expect(corpo.reply_to).toBe("contato@useeclat.com.br")
    expect(corpo.subject).toBe("Pedido #42 confirmado · use.ÉCLAT")
    expect(corpo.html).toContain("Ana, seu pedido está confirmado")
    expect(corpo.text).toContain("Pedido #42")
  })

  it("o template pedido-postado está registrado (é o que a rota do webhook da SuperFrete pede)", async () => {
    const spy = mockFetch(200, { id: "email_456" })
    const svc = new ResendNotificationService({ logger } as never, opcoes)
    await svc.send({
      to: "cliente@exemplo.com",
      channel: "email",
      template: "pedido-postado",
      data: { numero: "42", primeiroNome: "Ana", codigo: "AA123456789BR", link: "https://l/r", lojaUrl: "https://l", whatsapp: "5500000000000", idempotencia: "superfrete-posted-sfid_1" },
    })
    const [, init] = spy.mock.calls[0]
    expect(init.headers["idempotency-key"]).toBe("superfrete-posted-sfid_1")
    const corpo = JSON.parse(init.body)
    expect(corpo.subject).toBe("Seu pedido #42 foi postado · use.ÉCLAT")
    expect(corpo.html).toContain("AA123456789BR")
  })

  it("template desconhecido falha com mensagem clara, sem chamar a API", async () => {
    const spy = mockFetch(200, {})
    const svc = new ResendNotificationService({ logger } as never, opcoes)
    await expect(
      svc.send({ to: "a@b.c", channel: "email", template: "nao-existe", data: {} })
    ).rejects.toThrow(/nao-existe/)
    expect(spy).not.toHaveBeenCalled()
  })

  it("erro do Resend vira exceção com o status e sem vazar a chave", async () => {
    mockFetch(403, { name: "validation_error", message: "domain is not verified" })
    const svc = new ResendNotificationService({ logger } as never, opcoes)
    const erro = await svc
      .send({ to: "a@b.c", channel: "email", template: "pedido-confirmado", data: dados })
      .catch((e) => e)
    expect(erro.message).toMatch(/403/)
    expect(erro.message).toMatch(/domain is not verified/)
    expect(erro.message).not.toContain("re_segredo")
  })
})
