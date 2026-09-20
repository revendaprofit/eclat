import { createHmac } from "node:crypto"
import MercadoPagoProviderService from "../service"

function criarLoggerFalso() {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }
}

function criarServico(opcoes: Partial<{ webhookSecret: string; maxParcelas: number }> = {}) {
  const logger = criarLoggerFalso()
  const servico = new MercadoPagoProviderService(
    // @ts-expect-error — em teste não montamos o container completo do Medusa, só o `logger`
    // que o service de fato usa (mesmo padrão de teste do resto do backend: mocka a borda de
    // I/O — aqui `fetch` — não o framework inteiro).
    { logger },
    { accessToken: "APP_USR-token-de-teste", webhookSecret: "segredo-webhook", maxParcelas: 4, ...opcoes }
  )
  return { servico, logger }
}

function mockFetchSequencial(...respostas: { status: number; corpo: unknown }[]) {
  const spy = jest.fn()
  for (const { status, corpo } of respostas) {
    spy.mockResolvedValueOnce({ ok: status >= 200 && status < 300, status, json: async () => corpo })
  }
  global.fetch = spy as unknown as typeof fetch
  return spy
}

const orderPix = {
  id: "ORDTST_PIX_1",
  external_reference: "payses_1",
  status: "action_required",
  status_detail: "waiting_transfer",
  total_amount: "199.90",
  transactions: {
    payments: [
      {
        id: "PAY_PIX_1",
        amount: "199.90",
        status: "action_required",
        status_detail: "waiting_transfer",
        payment_method: { id: "pix", type: "bank_transfer", qr_code: "00020...", qr_code_base64: "aGVsbG8=", ticket_url: "https://mp/ticket" },
      },
    ],
  },
}

const orderCartaoAprovada = {
  id: "ORDTST_CARD_1",
  external_reference: "payses_2",
  status: "processed",
  status_detail: "accredited",
  total_amount: "199.90",
  transactions: {
    payments: [
      {
        id: "PAY_CARD_1",
        amount: "199.90",
        status: "processed",
        status_detail: "accredited",
        payment_method: { id: "master", type: "credit_card", installments: 1 },
      },
    ],
  },
}

describe("MercadoPagoProviderService", () => {
  afterEach(() => jest.restoreAllMocks())

  describe("initiatePayment", () => {
    it("exige data.session_id e data.metodo — nunca adivinha (Invariante 6)", async () => {
      const { servico } = criarServico()
      await expect(
        servico.initiatePayment({ amount: 199.9, currency_code: "brl", data: {}, context: {} })
      ).rejects.toThrow(/session_id.*metodo|metodo.*session_id/)
    })

    it("Pix: cria a order com payment_method bank_transfer e devolve o QR", async () => {
      mockFetchSequencial({ status: 201, corpo: orderPix })
      const { servico } = criarServico()

      const resultado = await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", cpf: "12345678909" },
        context: { customer: { id: "cus_1", email: "cliente@teste.com" } },
      })

      expect(resultado.status).toBe("pending")
      expect(resultado.data?.metodo).toBe("pix")
      expect(resultado.data?.qr_code).toBe("00020...")
      expect(resultado.data?.mp_order_id).toBe("ORDTST_PIX_1")

      const corpoEnviado = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body)
      expect(corpoEnviado.external_reference).toBe("payses_1")
      expect(corpoEnviado.processing_mode).toBe("automatic")
      expect(corpoEnviado.transactions.payments[0].payment_method).toEqual({ id: "pix", type: "bank_transfer" })
      expect(corpoEnviado.transactions.payments[0].expiration_time).toBe("PT30M") // spec §6: Pix vale 30 min
    })

    it("Pix pago: o QR não vai para os dados do pagamento (só ids, método e tarifa)", async () => {
      const pixPago = { ...orderPix, status: "processed", status_detail: "accredited" }
      mockFetchSequencial({ status: 200, corpo: pixPago }, { status: 200, corpo: { results: [{ id: 1, fee_details: [{ amount: 1.98, fee_payer: "collector", type: "mercadopago_fee" }] }] } })
      const { servico } = criarServico()

      const resultado = await servico.getPaymentStatus({ data: { mp_order_id: "ORDTST_PIX_1" } })

      expect(resultado.status).toBe("captured")
      expect(resultado.data?.metodo).toBe("pix")
      expect(resultado.data?.qr_code_base64).toBeUndefined()
      expect(resultado.data?.qr_code).toBeUndefined()
      expect(resultado.data?.tarifa_centavos).toBe(198)
    })

    it("Pix: sem CPF, lança em vez de mandar a order sem identificação", async () => {
      const { servico } = criarServico()
      await expect(
        servico.initiatePayment({
          amount: 199.9,
          currency_code: "brl",
          data: { session_id: "payses_1", metodo: "pix" },
          context: {},
        })
      ).rejects.toThrow(/CPF/)
    })

    it("Cartão aprovado: busca a tarifa real depois de confirmar accredited", async () => {
      mockFetchSequencial(
        { status: 201, corpo: orderCartaoAprovada },
        { status: 200, corpo: { results: [{ id: 1, fee_details: [{ amount: 9.96, fee_payer: "collector", type: "mercadopago_fee" }] }] } }
      )
      const { servico } = criarServico()

      const resultado = await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_2", metodo: "cartao", cpf: "12345678909", token: "tok_1", bandeira: "master", parcelas: 1 },
        context: {},
      })

      expect(resultado.status).toBe("captured")
      expect(resultado.data?.tarifa_centavos).toBe(996)
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(2)
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain("/v1/payments/search?external_reference=payses_2")
    })

    it("Cartão recusado (HTTP 402): devolve status error com mensagem em pt-BR e sem tentar buscar tarifa", async () => {
      mockFetchSequencial({
        status: 402,
        corpo: {
          errors: [{ code: "failed", details: ["PAY_X: rejected_by_issuer"] }],
          data: { ...orderCartaoAprovada, id: "ORDTST_CARD_2", status: "failed", status_detail: "failed" },
        },
      })
      const { servico } = criarServico()

      const resultado = await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_3", metodo: "cartao", cpf: "12345678909", token: "tok_2", bandeira: "master" },
        context: {},
      })

      expect(resultado.status).toBe("error")
      expect(resultado.data?.mp_order_id).toBe("ORDTST_CARD_2")
      expect(resultado.data?.mensagem_recusa).toMatch(/banco emissor/)
      expect((global.fetch as jest.Mock).mock.calls).toHaveLength(1) // não buscou tarifa (não foi aprovado)
    })

    it("guarda só os 4 últimos dígitos do cartão, e só se forem 4 dígitos", async () => {
      mockFetchSequencial({ status: 201, corpo: orderCartaoAprovada }, { status: 200, corpo: { results: [] } })
      const { servico } = criarServico()
      const base = { session_id: "payses_2", metodo: "cartao", cpf: "12345678909", token: "tok_1", bandeira: "master" }

      const ok = await servico.initiatePayment({ amount: 199.9, currency_code: "brl", data: { ...base, final_cartao: "3311" }, context: {} })
      expect(ok.data?.final_cartao).toBe("3311")
      expect(ok.data?.token).toBeUndefined() // o token nunca volta nos dados do provider

      mockFetchSequencial({ status: 201, corpo: orderCartaoAprovada }, { status: 200, corpo: { results: [] } })
      const ruim = await servico.initiatePayment({ amount: 199.9, currency_code: "brl", data: { ...base, final_cartao: "5480832801033311" }, context: {} })
      expect(ruim.data?.final_cartao).toBeUndefined()
    })

    // Achado de 2026-09-19 em produção: três cartões recusados com `cc_rejected_high_risk`. No painel do
    // Mercado Pago as cobranças de cartão chegavam SEM pagador (e-mail/CPF/nome nulos) e com
    // `security:none` (sem o identificador do aparelho). Quanto menos dado, maior a nota de risco.
    it("Cartão: manda pagador completo, itens e o identificador do aparelho no header", async () => {
      const spy = mockFetchSequencial({ status: 201, corpo: orderCartaoAprovada }, { status: 200, corpo: { results: [] } })
      const { servico } = criarServico()

      await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: {
          session_id: "payses_2",
          metodo: "cartao",
          cpf: "12345678909",
          token: "tok_1",
          bandeira: "master",
          email: "cliente@exemplo.com",
          nomeTitular: "Maria",
          sobrenome: "Silva",
          telefone: "31991032698",
          device_id: "arm_xyz123",
          endereco: { rua: "Rua Norte", numero: "180", bairro: "Centro", cidade: "Betim", estado: "MG", cep: "32604182" },
          itens: [{ titulo: "Macaquinho Solaris", quantidade: 2, preco_unitario: 259, sku: "ECL-MS-TEL-M" }],
        },
        context: {},
      })

      const [, opcoes] = spy.mock.calls[0]
      const corpo = JSON.parse(opcoes.body)
      expect(opcoes.headers["x-meli-session-id"]).toBe("arm_xyz123")
      expect(corpo.payer).toEqual({
        email: "cliente@exemplo.com",
        first_name: "Maria",
        last_name: "Silva",
        identification: { type: "CPF", number: "12345678909" },
        phone: { area_code: "31", number: "991032698" },
        address: { street_name: "Rua Norte", street_number: "180", neighborhood: "Centro", city: "Betim", state: "MG", zip_code: "32604182", country: "BR" },
      })
      expect(corpo.items).toEqual([
        { title: "Macaquinho Solaris", quantity: 2, unit_price: "259.00", external_code: "ECL-MS-TEL-M", type: "product", unit_measure: "unit" },
      ])
    })

    it("sem os dados extras, o pagador continua com o mínimo e nenhum campo vazio é inventado", async () => {
      const spy = mockFetchSequencial({ status: 201, corpo: orderPix })
      const { servico } = criarServico()

      await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", cpf: "12345678909", email: "cliente@exemplo.com" },
        context: {},
      })

      const [, opcoes] = spy.mock.calls[0]
      const corpo = JSON.parse(opcoes.body)
      expect(corpo.payer).toEqual({ email: "cliente@exemplo.com", first_name: "Comprador", identification: { type: "CPF", number: "12345678909" } })
      expect(corpo.items).toBeUndefined()
      expect(opcoes.headers["x-meli-session-id"]).toBeUndefined()
    })

    it("telefone só vira area_code + number quando tem DDD; lixo é descartado", async () => {
      const spy = mockFetchSequencial({ status: 201, corpo: orderPix })
      const { servico } = criarServico()

      await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", cpf: "12345678909", email: "c@e.com", telefone: "+55 (31) 9 9103-2698" },
        context: {},
      })
      expect(JSON.parse(spy.mock.calls[0][1].body).payer.phone).toEqual({ area_code: "31", number: "991032698" })

      const spy2 = mockFetchSequencial({ status: 201, corpo: orderPix })
      await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", cpf: "12345678909", email: "c@e.com", telefone: "123" },
        context: {},
      })
      expect(JSON.parse(spy2.mock.calls[0][1].body).payer.phone).toBeUndefined()
    })

    it("respeita o teto de parcelas configurado (maxParcelas)", async () => {
      const spy = mockFetchSequencial({ status: 201, corpo: orderCartaoAprovada }, { status: 200, corpo: { results: [] } })
      const { servico } = criarServico({ maxParcelas: 4 })

      await servico.initiatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_2", metodo: "cartao", cpf: "12345678909", token: "tok_1", bandeira: "master", parcelas: 12 },
        context: {},
      })

      const corpoEnviado = JSON.parse(spy.mock.calls[0][1].body)
      expect(corpoEnviado.transactions.payments[0].payment_method.installments).toBe(4)
    })
  })

  describe("capturePayment", () => {
    it("é um no-op — a Orders API captura sozinha em modo automático (achado da F0)", async () => {
      const spy = mockFetchSequencial()
      const { servico } = criarServico()
      const dados = { mp_order_id: "ORDTST_1" }

      const resultado = await servico.capturePayment({ data: dados })

      expect(resultado.data).toBe(dados)
      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("refundPayment", () => {
    it("estorno total (mesmo valor) manda corpo vazio", async () => {
      const spy = mockFetchSequencial({ status: 200, corpo: { ...orderCartaoAprovada, status: "refunded" } })
      const { servico } = criarServico()

      await servico.refundPayment({
        amount: 199.9,
        data: { mp_order_id: "ORDTST_CARD_1", mp_payment_id: "PAY_CARD_1", valor_total: "199.90" },
      })

      const corpoEnviado = JSON.parse(spy.mock.calls[0][1].body)
      expect(corpoEnviado).toEqual({})
    })

    it("estorno parcial (valor menor) manda amount e transaction_id", async () => {
      const spy = mockFetchSequencial({ status: 200, corpo: orderCartaoAprovada })
      const { servico } = criarServico()

      await servico.refundPayment({
        amount: 50,
        data: { mp_order_id: "ORDTST_CARD_1", mp_payment_id: "PAY_CARD_1", valor_total: "199.90" },
      })

      const corpoEnviado = JSON.parse(spy.mock.calls[0][1].body)
      expect(corpoEnviado).toEqual({ amount: "50.00", transaction_id: "PAY_CARD_1" })
    })
  })

  describe("updatePayment", () => {
    it("Pix com valor mudado: cria order nova, não tenta cancelar a antiga (achado da F0: /cancel dá 422)", async () => {
      const novaOrder = { ...orderPix, id: "ORDTST_PIX_2", total_amount: "249.90" }
      const spy = mockFetchSequencial({ status: 201, corpo: novaOrder })
      const { servico } = criarServico()

      const resultado = await servico.updatePayment({
        amount: 249.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", cpf: "12345678909", valor_total: "199.90", mp_order_id: "ORDTST_PIX_1" },
        context: {},
      })

      expect(resultado.data?.mp_order_id).toBe("ORDTST_PIX_2")
      expect(spy.mock.calls).toHaveLength(1) // só criou; nenhuma chamada a /cancel
      expect(spy.mock.calls[0][0]).toBe("https://api.mercadopago.com/v1/orders")
    })

    it("Cartão com valor mudado: recusa (nunca recobra por baixo do pano)", async () => {
      const { servico } = criarServico()
      await expect(
        servico.updatePayment({
          amount: 249.9,
          currency_code: "brl",
          data: { session_id: "payses_2", metodo: "cartao", valor_total: "199.90", mp_order_id: "ORDTST_CARD_1" },
          context: {},
        })
      ).rejects.toThrow(/nova sessão/)
    })

    it("valor igual: não cria nada de novo", async () => {
      const spy = mockFetchSequencial()
      const { servico } = criarServico()

      await servico.updatePayment({
        amount: 199.9,
        currency_code: "brl",
        data: { session_id: "payses_1", metodo: "pix", valor_total: "199.90", mp_order_id: "ORDTST_PIX_1" },
        context: {},
      })

      expect(spy).not.toHaveBeenCalled()
    })
  })

  describe("getWebhookActionAndData", () => {
    function assinar(dataId: string, segredo: string, xRequestId = "req-1", ts = "1742505638683") {
      const manifesto = `id:${dataId.toLowerCase()};request-id:${xRequestId};ts:${ts};`
      const v1 = createHmac("sha256", segredo).update(manifesto).digest("hex")
      return { "x-signature": `ts=${ts},v1=${v1}`, "x-request-id": xRequestId }
    }

    it("assinatura inválida: not_supported, sem consultar a order (nunca confia no corpo)", async () => {
      const spy = mockFetchSequencial()
      const { servico, logger } = criarServico()

      const resultado = await servico.getWebhookActionAndData({
        data: { data: { id: "ORDTST_1" } },
        rawData: "",
        headers: { "x-signature": "ts=1,v1=invalida", "x-request-id": "req-1" },
      })

      expect(resultado).toEqual({ action: "not_supported" })
      expect(spy).not.toHaveBeenCalled()
      expect(logger.warn).toHaveBeenCalled()
    })

    it("order aprovada: devolve captured com o session_id da order (nunca do corpo cru)", async () => {
      const headers = assinar("ORDTST_CARD_1", "segredo-webhook")
      mockFetchSequencial({ status: 200, corpo: orderCartaoAprovada })
      const { servico } = criarServico()

      const resultado = await servico.getWebhookActionAndData({
        data: { data: { id: "ORDTST_CARD_1" } },
        rawData: "",
        headers,
      })

      expect(resultado).toEqual({ action: "captured", data: { session_id: "payses_2", amount: 199.9 } })
    })

    it("chargeback: not_supported (o Medusa não reage sozinho — achado da F0) e regista aviso", async () => {
      const headers = assinar("ORDTST_CB_1", "segredo-webhook")
      mockFetchSequencial({
        status: 200,
        corpo: { ...orderCartaoAprovada, id: "ORDTST_CB_1", status: "charged_back", status_detail: "in_process" },
      })
      const { servico, logger } = criarServico()

      const resultado = await servico.getWebhookActionAndData({
        data: { data: { id: "ORDTST_CB_1" } },
        rawData: "",
        headers,
      })

      expect(resultado.action).toBe("not_supported")
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("contestação"))
    })
  })
})
