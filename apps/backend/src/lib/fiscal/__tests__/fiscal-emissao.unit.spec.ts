import { chaveIdempotencia, digestDevolvidos } from "../fiscal-emissao"

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

// Achado crítico da revisão de 2026-09-17: a idempotência da devolução precisa ser por CONJUNTO
// devolvido, não só por pedido — senão a segunda remessa colide com a primeira e devolve o
// documento errado em silêncio. Este digest é o que diferencia um conjunto do outro na chave
// (emitir-devolucao/route.ts).
describe("digestDevolvidos", () => {
  it("é determinístico: o mesmo conjunto sempre gera o mesmo digest", () => {
    const itens = [{ line_item_id: "li_a", quantidade: 1 }, { line_item_id: "li_b", quantidade: 2 }]
    expect(digestDevolvidos(itens)).toBe(digestDevolvidos(itens))
  })

  it("é independente da ordem de entrada (mesma requisição, itens em outra ordem)", () => {
    const a = [{ line_item_id: "li_a", quantidade: 1 }, { line_item_id: "li_b", quantidade: 2 }]
    const b = [{ line_item_id: "li_b", quantidade: 2 }, { line_item_id: "li_a", quantidade: 1 }]
    expect(digestDevolvidos(a)).toBe(digestDevolvidos(b))
  })

  it("muda quando o conjunto de itens devolvidos muda (duas remessas diferentes)", () => {
    const remessa1 = [{ line_item_id: "li_a", quantidade: 1 }]
    const remessa2 = [{ line_item_id: "li_b", quantidade: 1 }]
    expect(digestDevolvidos(remessa1)).not.toBe(digestDevolvidos(remessa2))
  })

  it("muda quando só a quantidade do mesmo item muda", () => {
    const um = [{ line_item_id: "li_a", quantidade: 1 }]
    const dois = [{ line_item_id: "li_a", quantidade: 2 }]
    expect(digestDevolvidos(um)).not.toBe(digestDevolvidos(dois))
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
    { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900, desconto_centavos: 0 },
  ]
  const destinatario = {
    cpf: "12345678909", nome: "Maria", logradouro: "Rua A", numero: "10", complemento: null,
    bairro: "Centro", municipio: "Belo Horizonte", municipio_ibge: "3106200", uf: "MG", cep: "30110000",
  }

  const configBase = {
    id: 1, cnpj: "68673407000113", razao_social: "X", nome_fantasia: null, ie: "1", im: null, crt: 1,
    logradouro: "R", numero: "1", complemento: null, bairro: "B", municipio: "BETIM",
    municipio_ibge: "3106705", uf: "MG", cep: "32604182", serie_nfe: 1,
    ambiente: "homologacao" as const, emissao_ativa: true,
  }
  const perfilPadrao = [
    { id: "p", escopo: "padrao", alvo_id: null, csosn: "102", cfop_dentro_uf: "5102",
      cfop_fora_uf: "6108", cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
      origem_padrao: 0, ativo: true },
  ]

  it("não reemite quando já existe documento autorizado (JA_RESOLVIDO) para o pedido", async () => {
    const existente = { id: "doc_1", status: "verificado", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([existente]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(doc?.id).toBe("doc_1")
    expect(transmitir).not.toHaveBeenCalled()
  })

  // Bloco 1 / achados C1+C2: emissao_ativa=false (padrão de fábrica) não é mais uma trava que
  // aborta o despacho — é o interruptor mestre da spec §6.1. Não toca no banco, não lança: retorna
  // null, e quem chama (admin/fiscal/emitir/route.ts) decide o que fazer.
  it("emissao_ativa desligada: retorna null sem tocar no banco nem lançar", async () => {
    const documentosDoPedido = jest.fn()
    const criarDocumento = jest.fn()
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido,
      getConfig: jest.fn().mockResolvedValue({ ...configBase, emissao_ativa: false }),
      listPerfis: jest.fn().mockResolvedValue([]),
      criarDocumento,
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir: jest.fn(), previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const resultado = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(resultado).toBeNull()
    expect(documentosDoPedido).not.toHaveBeenCalled()
    expect(criarDocumento).not.toHaveBeenCalled()
  })

  // Bloco 2 / achado crítico C3: `rejeitado` não é beco sem saída permanente. A nova tentativa
  // precisa de uma chave DIFERENTE da anterior (senão bate no índice único idempotency_key_key).
  it("documento rejeitado: nova emissão cria documento novo, com chave diferente", async () => {
    const rejeitado = { id: "doc_rejeitado", status: "rejeitado", idempotency_key: "order_1:venda:homologacao" }
    let chaveUsada: string | undefined
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([rejeitado]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn().mockResolvedValue(perfilPadrao),
      criarDocumento: jest.fn(async (d: any) => { chaveUsada = d.idempotency_key; return { ...d, id: "doc_2" } }),
      criarItens: jest.fn(async () => []),
      atualizarDocumento: jest.fn(async (_id: string, patch: any) => ({ id: "doc_2", ...patch })),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => ({
        autorizado: true, chave_acesso: "3".repeat(44), numero: 2, serie: 1,
        status_sefaz: "100", motivo: null, xml_url: null, danfe_url: null, bruto: {},
      })),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(doc?.id).toBe("doc_2")
    expect(chaveUsada).toBe("order_1:venda:homologacao:r1")
    expect(chaveUsada).not.toBe(rejeitado.idempotency_key)
  })

  // Ruling F3 mantido: transmitido_sem_confirmacao continua exigindo /admin/fiscal/resolver —
  // este não é o mesmo estado que `rejeitado` (achado C3 não reabre F3).
  it("transmitido_sem_confirmacao: continua recusando com a mensagem atual", async () => {
    const pendente = { id: "doc_pendente", status: "transmitido_sem_confirmacao", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([pendente]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 }))
      .rejects.toThrow(/transmissão sem confirmação/i)
    expect(transmitir).not.toHaveBeenCalled()
  })

  it("grava o documento ANTES de transmitir", async () => {
    const ordem: string[] = []
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn().mockResolvedValue(perfilPadrao),
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

    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })

    expect(ordem.indexOf("criarDocumento")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem.indexOf("criarItens")).toBeLessThan(ordem.indexOf("transmitir"))
    expect(ordem[ordem.length - 1]).toBe("atualizarDocumento")
  })

  // Achado I2/5.1: falha de transmissão por queda de INFRA (Error comum) não pode virar ErroFiscal
  // — senão a rota responde 422 (erro do operador) em vez de 500 (infra, dispara alerta).
  it("falha de rede/infra ao transmitir preserva Error comum (não vira ErroFiscal)", async () => {
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn().mockResolvedValue(perfilPadrao),
      criarDocumento: jest.fn(async (d: any) => ({ ...d, id: "doc_1" })),
      criarItens: jest.fn(async () => []),
      atualizarDocumento: jest.fn(async (_id: string, patch: any) => ({ id: "doc_1", ...patch })),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => { throw new Error("fetch failed: ECONNREFUSED") }),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const { ErroFiscal } = await import("../tipos.js")
    let capturado: unknown
    try {
      await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0 })
    } catch (e) {
      capturado = e
    }
    expect(capturado).toBeInstanceOf(Error)
    expect(capturado).not.toBeInstanceOf(ErroFiscal)
  })
})
