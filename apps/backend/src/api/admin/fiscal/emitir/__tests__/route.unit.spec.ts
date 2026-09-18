// Achado N1 (re-revisão da onda de correção do Bloco 1): a rota chamava montarItensDoPedido
// ANTES de saber se emissao_ativa estava ligada. montarItensDoPedido lança ErroFiscal quando
// falta CPF ou municipio_ibge no pedido — o que é TODO pedido real hoje, porque o checkout ainda
// não coleta esses dados. Resultado: com o interruptor desligado (padrão de fábrica), um pedido
// sem CPF nunca chegava a saber disso — abortava com 422 antes, no exato cenário que o Bloco 1 se
// propôs a corrigir. Estes testes provam a ORDEM: o interruptor precisa ser lido antes de montar
// os itens, e o caminho de erro por CPF ausente com o interruptor LIGADO não pode ter sido
// afrouxado no processo.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      res.statusCode = code
      return res
    },
    json(payload: unknown) {
      res.body = payload
      return res
    },
  }
  return res
}

function mockReq(body: Record<string, unknown>): MedusaRequest {
  return {
    body,
    scope: { resolve: () => ({ warn: () => undefined, info: () => undefined, error: () => undefined }) },
  } as unknown as MedusaRequest
}

const configDesligada = {
  id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
  logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
  municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
  ambiente: "homologacao" as const, emissao_ativa: false,
}
const configLigada = { ...configDesligada, emissao_ativa: true }

describe("POST /admin/fiscal/emitir — ordem do interruptor mestre (achado N1)", () => {
  beforeEach(() => {
    jest.resetModules()
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("emissao_ativa=false: responde 200 com emissao_desligada, SEM chamar montarItensDoPedido — mesmo com pedido sem CPF", async () => {
    const montarItensDoPedido = jest.fn(async () => {
      throw new Error("montarItensDoPedido não deveria ter sido chamado com o interruptor desligado")
    })
    const emitirVenda = jest.fn()
    jest.doMock("../../../../../lib/fiscal/fiscal-pedido", () => ({ montarItensDoPedido }))
    jest.doMock("../../../../../lib/fiscal/fiscal-db", () => ({
      getConfig: jest.fn().mockResolvedValue(configDesligada),
      listPerfis: jest.fn(),
    }))
    jest.doMock("../../../../../lib/fiscal/fiscal-emissao", () => ({ emitirVenda }))
    jest.doMock("../../../../../lib/fiscal/fiscal-client", () => ({ previsualizar: jest.fn() }))

    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1" })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(montarItensDoPedido).not.toHaveBeenCalled()
    expect(emitirVenda).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.body).toMatchObject({ documento: null, emissao_desligada: true })
  })

  it("emissao_ativa=true e pedido sem CPF: continua respondendo 422 — não afrouxa este caminho", async () => {
    const { ErroFiscal } = await import("../../../../../lib/fiscal/tipos.js")
    const montarItensDoPedido = jest.fn(async () => {
      throw new ErroFiscal("Pedido sem CPF do destinatário — obrigatório para emitir a NF-e.")
    })
    const emitirVenda = jest.fn()
    jest.doMock("../../../../../lib/fiscal/fiscal-pedido", () => ({ montarItensDoPedido }))
    jest.doMock("../../../../../lib/fiscal/fiscal-db", () => ({
      getConfig: jest.fn().mockResolvedValue(configLigada),
      listPerfis: jest.fn(),
    }))
    jest.doMock("../../../../../lib/fiscal/fiscal-emissao", () => ({ emitirVenda }))
    jest.doMock("../../../../../lib/fiscal/fiscal-client", () => ({ previsualizar: jest.fn() }))

    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1" })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(montarItensDoPedido).toHaveBeenCalledTimes(1)
    expect(emitirVenda).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(422)
    expect((res.body as { error: string }).error).toMatch(/CPF/i)
  })

  it("previa=true roda independente do interruptor (emissao_ativa=false não bloqueia a prévia)", async () => {
    const montarItensDoPedido = jest.fn().mockResolvedValue({
      itens: [], destinatario: { uf: "MG" }, frete_centavos: 0,
      pagamento: { forma: "99", descricao: "Pagamento online" },
    })
    const previsualizar = jest.fn().mockResolvedValue({ xml: "<NFe/>" })
    jest.doMock("../../../../../lib/fiscal/fiscal-pedido", () => ({ montarItensDoPedido }))
    jest.doMock("../../../../../lib/fiscal/fiscal-db", () => ({
      getConfig: jest.fn().mockResolvedValue(configDesligada),
      listPerfis: jest.fn().mockResolvedValue([]),
    }))
    jest.doMock("../../../../../lib/fiscal/fiscal-emissao", () => ({ emitirVenda: jest.fn() }))
    jest.doMock("../../../../../lib/fiscal/fiscal-client", () => ({ previsualizar }))
    jest.doMock("../../../../../lib/fiscal/fiscal-payload", () => ({
      montarPayloadVenda: jest.fn().mockReturnValue({ payload: {}, itens_ordenados: [] }),
    }))

    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1", previa: true })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(montarItensDoPedido).toHaveBeenCalledTimes(1)
    expect(previsualizar).toHaveBeenCalledTimes(1)
    expect(res.statusCode).toBe(200)
    expect(res.body).not.toMatchObject({ emissao_desligada: true })
  })
})
