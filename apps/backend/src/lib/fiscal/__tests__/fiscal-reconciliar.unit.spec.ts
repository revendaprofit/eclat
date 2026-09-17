const CHAVE = "31260968673407000113550010000000011000000017"

const XML_OK = `<nfeProc>
  <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
  <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
  <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
</nfeProc>`

// A SEFAZ devolveu nItem invertido em relação à ordem que enviamos.
const XML_DIVERGENTE = `<nfeProc>
  <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
  <det nItem="1"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
  <det nItem="2"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
</nfeProc>`

function mockDb(over: Record<string, unknown> = {}) {
  const atualizarNItem = jest.fn().mockResolvedValue(undefined)
  const atualizarDocumento = jest.fn(async (_id: string, patch: any) => ({ id: "doc_1", ...patch }))
  jest.doMock("../fiscal-db", () => ({
    atualizarNItem,
    atualizarDocumento,
    listarItens: jest.fn().mockResolvedValue([
      { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: null, codigo_enviado: "TOP-P", ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
      { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: null, codigo_enviado: "LEG-M", ncm: "61046200", quantidade: 1, valor_unitario_centavos: 24900 },
    ]),
    lerDocumento: jest.fn().mockResolvedValue({
      id: "doc_1", chave_acesso: CHAVE,
      status: "autorizado_nao_verificado", verificado_em: null,
      idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao",
      created_at: "2026-09-17T10:00:00Z", xml_autorizado: null,
    }),
    listarPorStatus: jest.fn().mockResolvedValue([]),
    ...over,
  }))
  return { atualizarNItem, atualizarDocumento }
}

describe("reconciliarDocumento", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("grava o nItem lido do XML e marca verificado_em", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 1)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 2)
    const patch = atualizarDocumento.mock.calls[atualizarDocumento.mock.calls.length - 1][1] as any
    expect(patch.status).toBe("verificado")
    expect(patch.verificado_em).toBeTruthy()
  })

  it("divergência entre ordem enviada e nItem da SEFAZ não é fatal: grava o valor real e alerta", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_DIVERGENTE, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(r.divergencias.length).toBeGreaterThan(0)
    // valor da SEFAZ prevalece: TOP-P saiu como nItem 2
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 2)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 1)
    expect((atualizarDocumento.mock.calls[atualizarDocumento.mock.calls.length - 1][1] as any).status).toBe("verificado")
  })

  it("não marca verificado quando o XML tem menos itens que o documento", async () => {
    mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(
        Buffer.from(
          `<nfeProc><protNFe><infProt><chNFe>${"3".repeat(44)}</chNFe></infProt></protNFe><det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det></nfeProc>`,
          "utf8"
        )
      ),
      localizarPorIdentificador: jest.fn(),
    }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/quantidade de itens/i)
  })

  it("não reconcilia documento sem chave de acesso", async () => {
    mockDb({ lerDocumento: jest.fn().mockResolvedValue({ id: "doc_1", chave_acesso: null, status: "montado" }) })
    jest.doMock("../fiscal-client", () => ({ baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/chave de acesso/i)
  })

  it("XML com chave divergente da chave_acesso do documento lança ErroFiscal e não grava nada", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    // chNFe deste XML não bate com a chave_acesso gravada no documento mockado.
    const XML_CHAVE_ERRADA = `<nfeProc>
      <protNFe><infProt><chNFe>${"9".repeat(44)}</chNFe></infProt></protNFe>
      <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
      <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
    </nfeProc>`
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_CHAVE_ERRADA, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/chave/i)

    expect(atualizarNItem).not.toHaveBeenCalled()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })

  // Caso que motivou o fix round 1: dois itens do MESMO NCM (rotineiro em moda), SKUs diferentes,
  // XML com os produtos em ordem trocada mas os nItem alinhados com a ordem do documento. Um
  // casamento por NCM+posição não veria divergência nenhuma aqui (é exatamente o bug crítico
  // apontado na revisão) — o casamento correto tem que vir do código (SKU), não da posição.
  it("casa por código mesmo com NCM duplicado e produtos trocados de posição no XML", async () => {
    const { atualizarNItem } = mockDb({
      listarItens: jest.fn().mockResolvedValue([
        { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: null, codigo_enviado: "TOP-P", ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
        { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: null, codigo_enviado: "TOP-M", ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
      ]),
    })
    const XML_NCM_DUPLICADO_TROCADO = `<nfeProc>
      <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
      <det nItem="1"><prod><cProd>TOP-M</cProd><NCM>61091000</NCM></prod></det>
      <det nItem="2"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
    </nfeProc>`
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_NCM_DUPLICADO_TROCADO, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    // fi_1 é o SKU TOP-P, que no XML saiu como nItem 2 — NÃO o nItem 1 da sua própria posição.
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 2)
    // fi_2 é o SKU TOP-M, que no XML saiu como nItem 1.
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 1)
  })

  it("item do documento sem par por código no XML lança ErroFiscal e não grava nada", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    const XML_SEM_PAR = `<nfeProc>
      <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
      <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
      <det nItem="2"><prod><cProd>OUTRO-SKU</cProd><NCM>61046200</NCM></prod></det>
    </nfeProc>`
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_SEM_PAR, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/não foi encontrado/i)

    expect(atualizarNItem).not.toHaveBeenCalled()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })

  it("dois itens do documento com o mesmo codigo_enviado lança ErroFiscal", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb({
      listarItens: jest.fn().mockResolvedValue([
        { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: null, codigo_enviado: "TOP-P", ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
        { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: null, codigo_enviado: "TOP-P", ncm: "61046200", quantidade: 1, valor_unitario_centavos: 24900 },
      ]),
    })
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/mais de um item/i)

    expect(atualizarNItem).not.toHaveBeenCalled()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })

  it("par casado por código com NCM divergente registra divergência mas conclui a reconciliação", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    const XML_NCM_MUDOU = `<nfeProc>
      <protNFe><infProt><chNFe>${CHAVE}</chNFe></infProt></protNFe>
      <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>99999999</NCM></prod></det>
      <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
    </nfeProc>`
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_NCM_MUDOU, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(r.divergencias.length).toBeGreaterThan(0)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 1)
    expect((atualizarDocumento.mock.calls[atualizarDocumento.mock.calls.length - 1][1] as any).status).toBe("verificado")
  })
})

describe("reconciliarDocumento — origem do XML", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("com XML em mãos (emissão síncrona) NÃO faz download", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    const baixarArquivo = jest.fn()
    jest.doMock("../fiscal-client", () => ({ baixarArquivo, localizarPorIdentificador: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    const r = await reconciliarDocumento("doc_1", XML_OK)

    expect(r.verificado).toBe(true)
    expect(baixarArquivo).not.toHaveBeenCalled()
    expect(atualizarNItem).toHaveBeenCalledTimes(2)
    // XML em mãos já foi gravado por quem emitiu — a reconciliação não o regrava.
    expect(atualizarDocumento.mock.calls[0][1]).not.toHaveProperty("xml_autorizado")
  })

  it("usa o xml_autorizado já gravado antes de pensar em baixar", async () => {
    mockDb({
      lerDocumento: jest.fn().mockResolvedValue({
        id: "doc_1", chave_acesso: CHAVE, status: "autorizado_nao_verificado", verificado_em: null,
        xml_autorizado: XML_OK,
      }),
    })
    const baixarArquivo = jest.fn()
    jest.doMock("../fiscal-client", () => ({ baixarArquivo, localizarPorIdentificador: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    expect((await reconciliarDocumento("doc_1")).verificado).toBe(true)
    expect(baixarArquivo).not.toHaveBeenCalled()
  })

  it("XML baixado é GRAVADO em xml_autorizado junto com a verificação", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn(),
    }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")

    await reconciliarDocumento("doc_1")

    const patch = atualizarDocumento.mock.calls[0][1]
    expect(patch.status).toBe("verificado")
    expect(patch.xml_autorizado).toBe(XML_OK)
  })
})

describe("localizarNoFornecedor", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  const pendente = {
    id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
    idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao",
    created_at: "2026-09-17T10:00:00Z",
  }

  it("achou autorizada: grava chave/número/série e vai para autorizado_nao_verificado", async () => {
    const { atualizarDocumento } = mockDb()
    const localizarPorIdentificador = jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 })
    jest.doMock("../fiscal-client", () => ({ baixarArquivo: jest.fn(), localizarPorIdentificador }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    const doc = await localizarNoFornecedor(pendente as any)

    expect(localizarPorIdentificador).toHaveBeenCalledWith({
      identificador: "order_1:venda:homologacao", ambiente: 2, desde: "2026-09-17T10:00:00Z",
    })
    expect(atualizarDocumento).toHaveBeenCalledWith("doc_1", {
      status: "autorizado_nao_verificado", chave_acesso: CHAVE, numero: 7, serie: 1,
      rejeicao_codigo: null, rejeicao_motivo: null,
    })
    expect(doc?.chave_acesso).toBe(CHAVE)
  })

  it("NÃO achou: devolve null e não altera NADA — ausência não é prova de que não emitiu", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn().mockResolvedValue(null),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })

  it("achou denegada: grava denegado e devolve null", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 3, numero: 7, serie: 1 }),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento.mock.calls[0][1].status).toBe("denegado")
  })

  it("achou CANCELADA: não adota (a nota não vale mais) e não altera nada", async () => {
    const { atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 2, numero: 7, serie: 1 }),
    }))
    const { localizarNoFornecedor } = await import("../fiscal-reconciliar.js")

    expect(await localizarNoFornecedor(pendente as any)).toBeNull()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })
})

describe("reconciliarPendentes — transmitido_sem_confirmacao sem chave", () => {
  beforeEach(() => jest.resetModules())
  afterEach(() => jest.restoreAllMocks())

  it("localiza no fornecedor e reconcilia, em vez de pular o documento", async () => {
    const semChave = {
      id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
      idempotency_key: "order_1:venda:homologacao", ambiente: "homologacao", created_at: "2026-09-17T10:00:00Z",
    }
    const { atualizarNItem } = mockDb({ listarPorStatus: jest.fn().mockResolvedValue([semChave]) })
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn().mockResolvedValue(Buffer.from(XML_OK, "utf8")),
      localizarPorIdentificador: jest.fn().mockResolvedValue({ chave_acesso: CHAVE, status: 1, numero: 7, serie: 1 }),
    }))
    const { reconciliarPendentes } = await import("../fiscal-reconciliar.js")

    const r = await reconciliarPendentes()

    expect(r).toEqual({ processados: 1, verificados: 1 })
    expect(atualizarNItem).toHaveBeenCalledTimes(2)
  })

  it("não localizado: segue pendente, sem verificar e sem quebrar a varredura", async () => {
    const semChave = {
      id: "doc_1", chave_acesso: null, status: "transmitido_sem_confirmacao",
      idempotency_key: "k", ambiente: "homologacao", created_at: "2026-09-17T10:00:00Z",
    }
    const { atualizarDocumento } = mockDb({ listarPorStatus: jest.fn().mockResolvedValue([semChave]) })
    jest.doMock("../fiscal-client", () => ({
      baixarArquivo: jest.fn(), localizarPorIdentificador: jest.fn().mockResolvedValue(null),
    }))
    const { reconciliarPendentes } = await import("../fiscal-reconciliar.js")

    expect(await reconciliarPendentes()).toEqual({ processados: 1, verificados: 0 })
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })
})
