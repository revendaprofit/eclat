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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_OK) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 1)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 2)
    const patch = atualizarDocumento.mock.calls.at(-1)![1] as any
    expect(patch.status).toBe("verificado")
    expect(patch.verificado_em).toBeTruthy()
  })

  it("divergência entre ordem enviada e nItem da SEFAZ não é fatal: grava o valor real e alerta", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_DIVERGENTE) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(r.divergencias.length).toBeGreaterThan(0)
    // valor da SEFAZ prevalece: TOP-P saiu como nItem 2
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 2)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_2", 1)
    expect((atualizarDocumento.mock.calls.at(-1)![1] as any).status).toBe("verificado")
  })

  it("não marca verificado quando o XML tem menos itens que o documento", async () => {
    mockDb()
    jest.doMock("../fiscal-client", () => ({
      baixarXml: jest.fn().mockResolvedValue(
        `<nfeProc><protNFe><infProt><chNFe>${"3".repeat(44)}</chNFe></infProt></protNFe><det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det></nfeProc>`
      ),
    }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/quantidade de itens/i)
  })

  it("não reconcilia documento sem chave de acesso", async () => {
    mockDb({ lerDocumento: jest.fn().mockResolvedValue({ id: "doc_1", chave_acesso: null, status: "montado" }) })
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn() }))
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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_CHAVE_ERRADA) }))

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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_NCM_DUPLICADO_TROCADO) }))

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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_SEM_PAR) }))

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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_OK) }))

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
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_NCM_MUDOU) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar.js")
    const r = await reconciliarDocumento("doc_1")

    expect(r.verificado).toBe(true)
    expect(r.divergencias.length).toBeGreaterThan(0)
    expect(atualizarNItem).toHaveBeenCalledWith("fi_1", 1)
    expect((atualizarDocumento.mock.calls.at(-1)![1] as any).status).toBe("verificado")
  })
})
