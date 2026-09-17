// Achado I8/5.3: a validação de quantidade da NFD aceitava `typeof === "number"`, o que deixa
// passar NaN (NaN < 1 e NaN > vendida são ambas falsas — as travas seguintes não pegam) e fração
// (1.5 vira "12.34.5" em reais(), NaN vira "NaN.NaN"). Com previa:true isso seria transmitido ao
// fornecedor. Teste direto na função da rota (não via HTTP) porque NaN não é representável em
// JSON — um cliente de verdade não consegue mandar isso pela rede, mas um chamador interno ou um
// corpo montado à mão pode, e a validação precisa recusar de qualquer forma antes de tocar no banco.
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

describe("POST /admin/fiscal/emitir-devolucao — validação de quantidade", () => {
  // resetModules entre testes: o último teste do arquivo faz jest.doMock em fiscal-db/
  // fiscal-pedido, e sem resetar o registro de módulos o "../route.js" já importado pelos
  // testes anteriores (sem mock) continuaria em cache — o mock nunca entraria em vigor.
  beforeEach(() => {
    jest.resetModules()
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  const casos: Array<[string, number]> = [
    ["NaN", NaN],
    ["fracionária (1.5)", 1.5],
    ["zero", 0],
  ]

  it.each(casos)("quantidade %s responde 400 sem tocar no banco", async (_nome, quantidade) => {
    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade }] })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(res.statusCode).toBe(400)
    expect((res.body as { error: string }).error).toMatch(/quantidade/i)
  })

  // Achado N2 (re-revisão): este teste passava da validação e caía direto em getConfig(), que
  // sem mock faz uma requisição HTTP real para o SUPABASE_URL carregado do .env de teste — que
  // é o projeto de PRODUÇÃO (loadEnv("test", cwd) em jest.config.js). Passava "pelo motivo
  // errado" (a tabela não existe naquele schema → 500) e deixava a suíte unitária dependente de
  // rede e da disponibilidade do Supabase real. Mocka fiscal-db/fiscal-pedido, como os specs de
  // src/lib/fiscal já fazem, para provar a validação de quantidade sem sair da máquina.
  it("quantidade inteira >= 1 passa da validação (segue adiante, não 400) — sem tocar rede", async () => {
    const getConfig = jest.fn().mockResolvedValue({
      id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
      logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
      municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
      ambiente: "homologacao", emissao_ativa: true,
    })
    // documentoDeVendaDoPedido retorna null de propósito: a rota lança ErroFiscal("não tem NF-e
    // de venda emitida") e cai em 422 — prova que passou da validação de entrada (400) sem
    // precisar simular o resto do fluxo de emissão.
    const documentoDeVendaDoPedido = jest.fn().mockResolvedValue(null)
    jest.doMock("../../../../../lib/fiscal/fiscal-db", () => ({
      getConfig,
      documentoDeVendaDoPedido,
      listPerfis: jest.fn(),
      listarDevolucoesDoDocumento: jest.fn(),
      listarItens: jest.fn(),
      acharPorIdempotencia: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    jest.doMock("../../../../../lib/fiscal/fiscal-pedido", () => ({ montarItensDoPedido: jest.fn() }))

    const { POST } = await import("../route.js")
    const req = mockReq({ order_id: "order_1", itens: [{ line_item_id: "li_1", quantidade: 1 }] })
    const res = mockRes()

    await POST(req, res as unknown as MedusaResponse)

    expect(getConfig).toHaveBeenCalledTimes(1)
    expect(documentoDeVendaDoPedido).toHaveBeenCalledTimes(1)
    expect(res.statusCode).not.toBe(400)
    expect(res.statusCode).toBe(422)
    expect((res.body as { error: string }).error).toMatch(/não tem NF-e de venda/i)
  })
})
