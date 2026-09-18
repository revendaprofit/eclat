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

  const pagamento = { forma: "99", descricao: "Pagamento online" }

  it("não reemite quando já existe documento autorizado (JA_RESOLVIDO) para o pedido", async () => {
    const existente = { id: "doc_1", status: "verificado", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([existente]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
      lerDocumento: jest.fn(async (id: string) => ({ id, status: "verificado" })),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })),
      localizarNoFornecedor: jest.fn(async () => null),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc?.id).toBe("doc_1")
    expect(transmitir).not.toHaveBeenCalled()
  })

  // Achado N1 (re-revisão): a checagem de emissao_ativa saiu de emitirVenda e virou
  // responsabilidade exclusiva do chamador (admin/fiscal/emitir/route.ts), que precisa decidir
  // isso ANTES de montar os itens do pedido — ver os testes de ordem em
  // src/api/admin/fiscal/emitir/__tests__/route.unit.spec.ts. emitirVenda não recebe mais
  // emissao_ativa=false como entrada válida a tratar; ela assume que quem a chamou já checou.

  // Bloco 2 / achado crítico C3: `rejeitado` não é beco sem saída permanente. A nova tentativa
  // precisa de uma chave DIFERENTE da anterior (senão bate no índice único idempotency_key_key).
  // A barreira agora consulta o fornecedor antes: mockado para não achar nada, segue emitindo.
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
      lerDocumento: jest.fn(async (id: string) => ({ id, status: "autorizado_nao_verificado" })),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => ({
        desfecho: "autorizado", chave_acesso: "3".repeat(44), numero: 2, serie: 1,
        codigo_sefaz: "100", motivo: null, xml: "<nfeProc/>", ambiente_divergente: false, bruto: {},
      })),
    }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })),
      localizarNoFornecedor: jest.fn(async () => null),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc?.id).toBe("doc_2")
    expect(chaveUsada).toBe("order_1:venda:homologacao:r1")
    expect(chaveUsada).not.toBe(rejeitado.idempotency_key)
  })

  // Ruling F3 mantido: transmitido_sem_confirmacao continua exigindo resolução manual — este não
  // é o mesmo estado que `rejeitado` (achado C3 não reabre F3). A mensagem nova cita
  // "reemitir criaria nota duplicada", que é a parte que este teste afirma.
  it("transmitido_sem_confirmacao: continua recusando com a mensagem atual", async () => {
    const pendente = { id: "doc_pendente", status: "transmitido_sem_confirmacao", idempotency_key: "order_1:venda:homologacao" }
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([pendente]),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn(),
      criarDocumento: jest.fn(),
      criarItens: jest.fn(),
      atualizarDocumento: jest.fn(),
      lerDocumento: jest.fn(async (id: string) => ({ id, status: "transmitido_sem_confirmacao" })),
    }))
    const transmitir = jest.fn()
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })),
      localizarNoFornecedor: jest.fn(async () => null),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento }))
      .rejects.toThrow(/reemitir criaria nota duplicada/i)
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
      lerDocumento: jest.fn(async (id: string) => ({ id, status: "autorizado_nao_verificado" })),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => {
        ordem.push("transmitir")
        return {
          desfecho: "autorizado", chave_acesso: "3".repeat(44), numero: 1, serie: 1,
          codigo_sefaz: "100", motivo: null, xml: "<nfeProc/>", ambiente_divergente: false, bruto: {},
        }
      }),
    }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })),
      localizarNoFornecedor: jest.fn(async () => null),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

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
      lerDocumento: jest.fn(async (id: string) => ({ id, status: "verificado" })),
    }))
    jest.doMock("../fiscal-client", () => ({
      brasilNfeConfigured: () => true,
      previsualizar: jest.fn(),
      transmitir: jest.fn(async () => { throw new Error("fetch failed: ECONNREFUSED") }),
    }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(async () => ({ verificado: true, divergencias: [] })),
      localizarNoFornecedor: jest.fn(async () => null),
    }))

    const { emitirVenda } = await import("../fiscal-emissao.js")
    const { ErroFiscal } = await import("../tipos.js")
    let capturado: unknown
    try {
      await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })
    } catch (e) {
      capturado = e
    }
    expect(capturado).toBeInstanceOf(Error)
    expect(capturado).not.toBeInstanceOf(ErroFiscal)
  })

  const AUTORIZADA = {
    desfecho: "autorizado", chave_acesso: "3".repeat(44), numero: 7, serie: 1,
    codigo_sefaz: "100", motivo: null, xml: "<nfeProc>x</nfeProc>", ambiente_divergente: false, bruto: { ReturnNF: {} },
  }

  // Monta os três mocks (db, client, reconciliar) e devolve os espiões que os testes inspecionam.
  function preparar(opts: {
    documentos?: any[]
    transmitir?: jest.Mock
    localizarNoFornecedor?: jest.Mock
    reconciliarDocumento?: jest.Mock
  } = {}) {
    const estado: Record<string, any> = {}
    const criarDocumento = jest.fn(async (d: any) => { Object.assign(estado, d, { id: "doc_novo" }); return { ...estado } })
    const atualizarDocumento = jest.fn(async (_id: string, patch: any) => { Object.assign(estado, patch); return { ...estado } })
    const transmitir = opts.transmitir ?? jest.fn(async () => AUTORIZADA)
    const reconciliarDocumento = opts.reconciliarDocumento ?? jest.fn(async () => { estado.status = "verificado"; return { verificado: true, divergencias: [] } })
    const localizarNoFornecedor = opts.localizarNoFornecedor ?? jest.fn(async () => null)
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue(opts.documentos ?? []),
      getConfig: jest.fn().mockResolvedValue(configBase),
      listPerfis: jest.fn().mockResolvedValue(perfilPadrao),
      criarDocumento,
      criarItens: jest.fn(async () => []),
      atualizarDocumento,
      lerDocumento: jest.fn(async (id: string) => (id === "doc_novo" ? { ...estado } : { id, status: "verificado" })),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir, previsualizar: jest.fn(), brasilNfeConfigured: () => true }))
    jest.doMock("../fiscal-reconciliar", () => ({ reconciliarDocumento, localizarNoFornecedor }))
    return { estado, criarDocumento, atualizarDocumento, transmitir, reconciliarDocumento, localizarNoFornecedor }
  }

  it("autorizada: grava chave, número, série e xml_autorizado, e reconcilia NA HORA com o XML da resposta", async () => {
    const m = preparar()
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    const gravacao = m.atualizarDocumento.mock.calls.find(([, p]) => p.status === "autorizado_nao_verificado")![1]
    expect(gravacao.chave_acesso).toBe("3".repeat(44))
    expect(gravacao.numero).toBe(7)
    expect(gravacao.xml_autorizado).toBe("<nfeProc>x</nfeProc>")
    expect(m.reconciliarDocumento).toHaveBeenCalledWith("doc_novo", "<nfeProc>x</nfeProc>")
    expect(doc.status).toBe("verificado")
  })

  it("o IdentificadorInterno do payload É a chave de idempotência gravada", async () => {
    const m = preparar()
    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    const criado = m.criarDocumento.mock.calls[0][0]
    expect(criado.idempotency_key).toBe("order_1:venda:homologacao")
    expect(criado.payload_enviado.IdentificadorInterno).toBe("order_1:venda:homologacao")
    expect(m.transmitir.mock.calls[0][0].IdentificadorInterno).toBe("order_1:venda:homologacao")
  })

  it("falha na reconciliação NÃO desfaz a emissão: a nota está autorizada, o despacho segue", async () => {
    const avisar = jest.fn()
    const m = preparar({ reconciliarDocumento: jest.fn(async () => { throw new Error("XML sem det") }) })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento, avisar })

    expect(doc.status).toBe("autorizado_nao_verificado")
    expect(doc.chave_acesso).toBe("3".repeat(44))
    expect(avisar).toHaveBeenCalledWith(expect.stringContaining("XML sem det"))
    expect(m.estado.status).not.toBe("rejeitado")
  })

  it("rejeitada: grava código e motivo, não reconcilia", async () => {
    const m = preparar({
      transmitir: jest.fn(async () => ({
        desfecho: "rejeitado", chave_acesso: null, numero: null, serie: null,
        codigo_sefaz: "225", motivo: "Falha no Schema XML", xml: null, ambiente_divergente: false, bruto: {},
      })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc.status).toBe("rejeitado")
    expect(doc.rejeicao_codigo).toBe("225")
    expect(doc.rejeicao_motivo).toBe("Falha no Schema XML")
    expect(m.reconciliarDocumento).not.toHaveBeenCalled()
  })

  it("resposta INDEFINIDA: lança Error comum e o documento FICA em transmitido_sem_confirmacao", async () => {
    const m = preparar({
      transmitir: jest.fn(async () => ({
        desfecho: "indefinido", chave_acesso: null, numero: null, serie: null,
        codigo_sefaz: null, motivo: null, xml: null, ambiente_divergente: false, bruto: { estranho: true },
      })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const { ErroFiscal } = await import("../tipos.js")
    const erro = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento }).catch((e) => e)

    expect(erro).toBeInstanceOf(Error)
    expect(erro).not.toBeInstanceOf(ErroFiscal)
    expect(m.estado.status).toBe("transmitido_sem_confirmacao")
    expect(m.estado.resposta_bruta).toEqual({ estranho: true })
  })

  it("ambiente divergente: grava o alerta e avisa, sem perder a autorização", async () => {
    const avisar = jest.fn()
    const m = preparar({ transmitir: jest.fn(async () => ({ ...AUTORIZADA, ambiente_divergente: true })) })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento, avisar })

    const gravacao = m.atualizarDocumento.mock.calls.find(([, p]) => p.status === "autorizado_nao_verificado")![1]
    expect(gravacao.rejeicao_motivo).toMatch(/ambiente/i)
    expect(avisar).toHaveBeenCalledWith(expect.stringMatching(/ambiente/i))
  })

  it("BARREIRA: tentativa anterior gravada como rejeitada, mas AUTORIZADA no fornecedor — adota, não reemite", async () => {
    const rejeitado = { id: "doc_antigo", status: "rejeitado", idempotency_key: "order_1:venda:homologacao" }
    const adotado = { ...rejeitado, status: "autorizado_nao_verificado", chave_acesso: "5".repeat(44) }
    const m = preparar({
      documentos: [rejeitado],
      localizarNoFornecedor: jest.fn(async () => adotado),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(m.localizarNoFornecedor).toHaveBeenCalledWith(rejeitado)
    expect(m.transmitir).not.toHaveBeenCalled()
    expect(m.criarDocumento).not.toHaveBeenCalled()
    expect(m.reconciliarDocumento).toHaveBeenCalledWith("doc_antigo")
    expect(doc.id).toBe("doc_antigo")
  })

  it("BARREIRA: consulta ao fornecedor falhou — a emissão NÃO acontece (sem verificar, não arrisca duplicata)", async () => {
    const rejeitado = { id: "doc_antigo", status: "rejeitado", idempotency_key: "order_1:venda:homologacao" }
    const m = preparar({
      documentos: [rejeitado],
      localizarNoFornecedor: jest.fn(async () => { throw new Error("Brasil NFe ObterNotasFiscais: 503") }),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")

    await expect(emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })).rejects.toThrow(/503/)
    expect(m.transmitir).not.toHaveBeenCalled()
  })

  it("transmitido_sem_confirmacao que o fornecedor conhece é adotado em vez de recusado", async () => {
    const pendente = { id: "doc_pend", status: "transmitido_sem_confirmacao", idempotency_key: "order_1:venda:homologacao" }
    const m = preparar({
      documentos: [pendente],
      localizarNoFornecedor: jest.fn(async () => ({ ...pendente, status: "autorizado_nao_verificado", chave_acesso: "5".repeat(44) })),
    })
    const { emitirVenda } = await import("../fiscal-emissao.js")
    const doc = await emitirVenda({ orderId: "order_1", itens, destinatario, frete_centavos: 0, pagamento })

    expect(doc.id).toBe("doc_pend")
    expect(m.transmitir).not.toHaveBeenCalled()
  })
})

describe("prepararTentativa — devolução", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("só considera documentos do MESMO conjunto devolvido, e dá sufixo :rN na nova tentativa", async () => {
    const base = "order_1:devolucao:homologacao:aaaa"
    jest.doMock("../fiscal-db", () => ({
      documentosDoPedido: jest.fn().mockResolvedValue([
        { id: "d1", status: "rejeitado", idempotency_key: base },
        { id: "d2", status: "verificado", idempotency_key: "order_1:devolucao:homologacao:bbbb" }, // OUTRA remessa
      ]),
      lerDocumento: jest.fn(),
    }))
    jest.doMock("../fiscal-client", () => ({ transmitir: jest.fn() }))
    jest.doMock("../fiscal-reconciliar", () => ({
      reconciliarDocumento: jest.fn(), localizarNoFornecedor: jest.fn(async () => null),
    }))
    const { prepararTentativa } = await import("../fiscal-emissao.js")

    const r = await prepararTentativa({ orderId: "order_1", tipo: "devolucao", ambiente: "homologacao", baseKey: base })

    // d2 é de outro conjunto: não pode ser devolvido como "existente" desta remessa.
    expect(r).toEqual({ key: `${base}:r1` })
  })
})
