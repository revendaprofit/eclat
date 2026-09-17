import { ClienteMercadoPago, ErroMercadoPago, extrairMotivoDeRecusa } from "../cliente.js"

function mockFetch(status: number, corpo: unknown) {
  const spy = jest.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => corpo,
  })
  global.fetch = spy as unknown as typeof fetch
  return spy
}

describe("ClienteMercadoPago", () => {
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("criarOrder manda o Access Token e a chave de idempotência nos headers certos", async () => {
    const spy = mockFetch(201, { id: "ORD1", status: "processed" })
    const cliente = new ClienteMercadoPago("APP_USR-token-secreto")

    await cliente.criarOrder({ total_amount: "50.00" }, "chave-123")

    const [url, opcoes] = spy.mock.calls[0]
    expect(url).toBe("https://api.mercadopago.com/v1/orders")
    expect(opcoes.method).toBe("POST")
    expect(opcoes.headers.authorization).toBe("Bearer APP_USR-token-secreto")
    expect(opcoes.headers["x-idempotency-key"]).toBe("chave-123")
    expect(JSON.parse(opcoes.body)).toEqual({ total_amount: "50.00" })
  })

  it("buscarOrder faz GET sem corpo nem chave de idempotência", async () => {
    const spy = mockFetch(200, { id: "ORD1", status: "processed" })
    const cliente = new ClienteMercadoPago("token")

    const order = await cliente.buscarOrder("ORD1")

    expect(order.id).toBe("ORD1")
    const [url, opcoes] = spy.mock.calls[0]
    expect(url).toBe("https://api.mercadopago.com/v1/orders/ORD1")
    expect(opcoes.method).toBe("GET")
    expect(opcoes.body).toBeUndefined()
    expect(opcoes.headers["x-idempotency-key"]).toBeUndefined()
  })

  it("lança ErroMercadoPago com o corpo intacto quando a resposta não é 2xx", async () => {
    mockFetch(402, { errors: [{ code: "failed", details: ["PAY1: rejected_by_issuer"] }], data: { id: "ORD1" } })
    const cliente = new ClienteMercadoPago("token")

    await expect(cliente.criarOrder({}, "chave")).rejects.toMatchObject({
      status: 402,
      corpo: { data: { id: "ORD1" } },
    })
  })

  it("cancelarOrder nunca lança — devolve null quando o Mercado Pago recusa (achado da F0: 422)", async () => {
    mockFetch(422, { errors: [{ code: "unprocessable_content" }] })
    const cliente = new ClienteMercadoPago("token")

    await expect(cliente.cancelarOrder("ORD1", "chave")).resolves.toBeNull()
  })

  it("cancelarOrder devolve a order quando o Mercado Pago aceita", async () => {
    mockFetch(200, { id: "ORD1", status: "canceled" })
    const cliente = new ClienteMercadoPago("token")

    await expect(cliente.cancelarOrder("ORD1", "chave")).resolves.toEqual({ id: "ORD1", status: "canceled" })
  })

  it("estornarOrder total manda corpo vazio", async () => {
    const spy = mockFetch(200, { id: "ORD1", status: "refunded" })
    const cliente = new ClienteMercadoPago("token")

    await cliente.estornarOrder("ORD1", {}, "chave")

    const [, opcoes] = spy.mock.calls[0]
    expect(JSON.parse(opcoes.body)).toEqual({})
  })

  it("estornarOrder parcial manda amount e transaction_id", async () => {
    const spy = mockFetch(200, { id: "ORD1", status: "processed" })
    const cliente = new ClienteMercadoPago("token")

    await cliente.estornarOrder("ORD1", { amount: "50.00", transactionId: "PAY1" }, "chave")

    const [, opcoes] = spy.mock.calls[0]
    expect(JSON.parse(opcoes.body)).toEqual({ amount: "50.00", transaction_id: "PAY1" })
  })

  it("buscarPagamentoPorReferencia consulta a API clássica de Payments por external_reference", async () => {
    const spy = mockFetch(200, { results: [{ id: 123, fee_details: [{ amount: 9.96, fee_payer: "collector", type: "mercadopago_fee" }] }] })
    const cliente = new ClienteMercadoPago("token")

    const pagamento = await cliente.buscarPagamentoPorReferencia("sess_123")

    expect(pagamento?.id).toBe(123)
    const [url] = spy.mock.calls[0]
    expect(url).toBe("https://api.mercadopago.com/v1/payments/search?external_reference=sess_123")
  })

  it("buscarPagamentoPorReferencia devolve undefined quando não há resultado", async () => {
    mockFetch(200, { results: [] })
    const cliente = new ClienteMercadoPago("token")

    await expect(cliente.buscarPagamentoPorReferencia("sess_999")).resolves.toBeUndefined()
  })
})

describe("extrairMotivoDeRecusa", () => {
  it("extrai o motivo do formato \"PAY_ID: motivo\" (confirmado na F0)", () => {
    expect(extrairMotivoDeRecusa({ errors: [{ details: ["PAY01M2RFFZZ9D6EQ1A3WJ2143YDY: rejected_by_issuer"] }] })).toBe(
      "rejected_by_issuer"
    )
  })

  it("devolve undefined quando não há details", () => {
    expect(extrairMotivoDeRecusa({ errors: [{ code: "failed" }] })).toBeUndefined()
    expect(extrairMotivoDeRecusa({})).toBeUndefined()
  })
})
