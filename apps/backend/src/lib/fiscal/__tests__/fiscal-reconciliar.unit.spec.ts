const XML_OK = `<nfeProc>
  <protNFe><infProt><chNFe>31260968673407000113550010000000011000000017</chNFe></infProt></protNFe>
  <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
  <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
</nfeProc>`

// A SEFAZ devolveu nItem invertido em relação à ordem que enviamos.
const XML_DIVERGENTE = `<nfeProc>
  <protNFe><infProt><chNFe>31260968673407000113550010000000011000000017</chNFe></infProt></protNFe>
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
      { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: null, ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
      { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: null, ncm: "61046200", quantidade: 1, valor_unitario_centavos: 24900 },
    ]),
    lerDocumento: jest.fn().mockResolvedValue({
      id: "doc_1", chave_acesso: "31260968673407000113550010000000011000000017",
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

    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
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

    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
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
    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/quantidade de itens/i)
  })

  it("não reconcilia documento sem chave de acesso", async () => {
    mockDb({ lerDocumento: jest.fn().mockResolvedValue({ id: "doc_1", chave_acesso: null, status: "montado" }) })
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn() }))
    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/chave de acesso/i)
  })

  it("XML com chave divergente da chave_acesso do documento lança ErroFiscal e não grava nada", async () => {
    const { atualizarNItem, atualizarDocumento } = mockDb()
    // chNFe deste XML não bate com a chave_acesso ("...0017") gravada no documento mockado.
    const XML_CHAVE_ERRADA = `<nfeProc>
      <protNFe><infProt><chNFe>${"9".repeat(44)}</chNFe></infProt></protNFe>
      <det nItem="1"><prod><cProd>TOP-P</cProd><NCM>61091000</NCM></prod></det>
      <det nItem="2"><prod><cProd>LEG-M</cProd><NCM>61046200</NCM></prod></det>
    </nfeProc>`
    jest.doMock("../fiscal-client", () => ({ baixarXml: jest.fn().mockResolvedValue(XML_CHAVE_ERRADA) }))

    const { reconciliarDocumento } = await import("../fiscal-reconciliar")
    await expect(reconciliarDocumento("doc_1")).rejects.toThrow(/chave/i)

    expect(atualizarNItem).not.toHaveBeenCalled()
    expect(atualizarDocumento).not.toHaveBeenCalled()
  })
})
