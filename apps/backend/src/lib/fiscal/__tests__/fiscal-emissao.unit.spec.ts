import { chaveIdempotencia } from "../fiscal-emissao"

describe("chaveIdempotencia", () => {
  it("compõe pedido + tipo + ambiente", () => {
    expect(chaveIdempotencia("order_1", "venda", "homologacao")).toBe("order_1:venda:homologacao")
  })

  it("separa homologação de produção", () => {
    expect(chaveIdempotencia("order_1", "venda", "homologacao")).not.toBe(
      chaveIdempotencia("order_1", "venda", "producao")
    )
  })

  it("separa venda de devolução", () => {
    expect(chaveIdempotencia("order_1", "venda", "producao")).not.toBe(
      chaveIdempotencia("order_1", "devolucao", "producao")
    )
  })
})

describe("emitirVenda", () => {
  const OLD = process.env
  beforeEach(() => {
    jest.resetModules()
    process.env = { ...OLD, SUPABASE_URL: "https://x.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "k", BRASILNFE_USER_TOKEN: "u", BRASILNFE_COMPANY_TOKEN: "c" }
  })
  afterEach(() => {
    process.env = OLD
    jest.restoreAllMocks()
  })

  const itens = [
    { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900 },
  ]
  const destinatario = {
    cpf: "12345678909", nome: "Maria", logradouro: "Rua A", numero: "10", complemento: null,
    bairro: "Centro", municipio: "Belo Horizonte", municipio_ibge: "3106200", uf: "MG", cep: "30110000",
  }

  it("não reemite quando já existe documento autorizado para a mesma chave", async () => {
    const existente = { id: "doc_1", status: "verificado", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(existente),
      getConfig: jest.fn().mockResolvedValue({
        id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
        logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
        municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
        ambiente: "homologacao", emissao_ativa: true,
      }),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(doc.id).toBe("doc_1")
    expect(transmitir).not.toHaveBeenCalled()
  })

  it("recusa emitir quando emissao_ativa está desligada", async () => {
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue({
        id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
        logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
        municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
        ambiente: "homologacao", emissao_ativa: false,
      }),
      listPerfis: jest.fn().mockResolvedValue([]),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir: jest.fn(), previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao")
    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 }))
      .rejects.toThrow(/emissão está desligada/i)
  })

  it("grava o documento ANTES de transmitir", async () => {
    const ordem: string[] = []
    jest.doMock("../fiscal-db", () => ({
      acharPorIdempotencia: jest.fn().mockResolvedValue(null),
      getConfig: jest.fn().mockResolvedValue({
        id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
        logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
        municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
        ambiente: "homologacao", emissao_ativa: true,
      }),
      listPerfis: jest.fn().mockResolvedValue([
        { id: "p", escopo: "padrao", alvo_id: null, csosn: "102", cfop_dentro_uf: "5102",
          cfop_fora_uf: "6108", cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
          origem_padrao: 0, ativo: true },
      ]),
      criarDocumento: jest.fn(async (d: any) => { ordem.push("criarDocumento"); return { ...d, id: "doc_1" } }),
      criarItens: jest.fn(async () => { ordem.push("criarItens"); return [] }),
      atualizarDocumento: jest.fn(async (_id: string, patch: any) => { ordem.push("atualizarDocumento"); return { id: "doc_1", ...patch } }),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => {
        ordem.push("transmitir")
        return { autorizado: true, chave_acesso: "3".repeat(44), numero: 1, serie: 1, status_sefaz: "100", motivo: null, xml_url: null, danfe_url: null, bruto: {} }
      }),
    }))

    const { emitirVenda } = await import("../fiscal-emissao")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(ordem.indexOf("criarDocumento")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem.indexOf("criarItens")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem[ordem.length - 1]).toBe("atualizarDocumento")
  })
})
