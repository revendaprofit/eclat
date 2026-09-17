import { montarPayloadDevolucao } from "../fiscal-payload-devolucao"
import {
  ErroFiscal,
  type FiscalConfig,
  type FiscalDocumento,
  type FiscalDocumentoItem,
  type FiscalPerfil,
  type ItemPedido,
} from "../tipos"

const CHAVE = "31260968673407000113550010000000011000000017"

const config: FiscalConfig = {
  id: 1, cnpj: "68673407000113", razao_social: "CAMILA DE MOURA NOGUEIRA",
  nome_fantasia: "USE ECLAT", ie: "56295050042", im: null, crt: 1,
  logradouro: "R NORTE", numero: "180", complemento: null, bairro: "ANGOLA",
  municipio: "BETIM", municipio_ibge: "3106705", uf: "MG", cep: "32604182",
  serie_nfe: 1, ambiente: "homologacao", emissao_ativa: true,
}

const perfilPadrao: FiscalPerfil = {
  id: "padrao", escopo: "padrao", alvo_id: null, csosn: "102",
  cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
  cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
  origem_padrao: 0, ativo: true,
}

function documento(p: Partial<FiscalDocumento> = {}): FiscalDocumento {
  return {
    id: "doc_1", medusa_order_id: "order_1", tipo: "venda", modelo: 55,
    serie: 1, numero: 1, chave_acesso: CHAVE,
    status: p.status ?? "verificado", ambiente: "homologacao",
    idempotency_key: "order_1:venda:homologacao", payload_enviado: {},
    resposta_bruta: null, rejeicao_codigo: null, rejeicao_motivo: null,
    xml_url: null, danfe_url: null, documento_origem_id: null,
    verificado_em: p.verificado_em !== undefined ? p.verificado_em : "2026-09-16T12:00:00Z",
    ...p,
  }
}

const itensOrigem: FiscalDocumentoItem[] = [
  { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: 1, ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900 },
  { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: 2, ncm: "61046200", quantidade: 2, valor_unitario_centavos: 24900 },
]

const itensPedido: ItemPedido[] = [
  { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-AURA-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900 },
  { line_item_id: "li_b", product_id: "prod_b", categoria_handle: "leggings", titulo: "Legging Vertice", sku: "LEG-VERTICE-M", ncm: "61046200", origem: 0, quantidade: 2, valor_unitario_centavos: 24900 },
]

function chamar(over: Record<string, unknown> = {}) {
  return montarPayloadDevolucao({
    config, perfis: [perfilPadrao], documentoOrigem: documento(), itensOrigem,
    devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
    itensPedido, ufDestinatarioOriginal: "MG",
    ...over,
  } as Parameters<typeof montarPayloadDevolucao>[0])
}

describe("trava de segurança", () => {
  it("recusa quando o documento de origem não está verificado", () => {
    expect(() => chamar({ documentoOrigem: documento({ status: "autorizado_nao_verificado", verificado_em: null }) }))
      .toThrow(/não foi reconciliad|não está verificad/i)
  })

  it("recusa quando falta n_item_verificado em algum item devolvido", () => {
    const semNItem = [itensOrigem[0], { ...itensOrigem[1], n_item_verificado: null }]
    expect(() => chamar({ itensOrigem: semNItem })).toThrow(ErroFiscal)
  })

  it("recusa quando o documento de origem não tem chave de acesso", () => {
    expect(() => chamar({ documentoOrigem: documento({ chave_acesso: null }) })).toThrow(ErroFiscal)
  })
})

describe("montarPayloadDevolucao", () => {
  it("é nota de ENTRADA com finalidade 4 (devolução)", () => {
    const { payload } = chamar()
    expect((payload as any).tipo_nf).toBe(0)
    expect((payload as any).finalidade).toBe(4)
  })

  it("referencia a nota de origem item a item, com chave e nItem", () => {
    const { payload } = chamar()
    const item = (payload as any).itens[0]
    expect(item.documentos_referenciados).toEqual([{ chave_acesso: CHAVE, numero_item: 2 }])
  })

  it("devolução parcial referencia só o item devolvido", () => {
    const { payload } = chamar()
    expect((payload as any).itens).toHaveLength(1)
    expect((payload as any).itens[0].codigo).toBe("LEG-VERTICE-M")
  })

  it("respeita a quantidade devolvida, não a quantidade vendida", () => {
    const { payload } = chamar()
    expect((payload as any).itens[0].quantidade).toBe(1)
    expect((payload as any).itens[0].valor_total).toBe("249.00")
  })

  it("recusa quantidade devolvida maior que a vendida", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_b", quantidade: 5 }] })).toThrow(
      /maior que a quantidade vendida/i
    )
  })

  it("usa CFOP de devolução dentro do estado quando a venda foi para MG", () => {
    expect(((chamar().payload) as any).itens[0].cfop).toBe("1202")
  })

  it("usa CFOP de devolução interestadual quando a venda foi para fora de MG", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: "SP" })
    expect((payload as any).itens[0].cfop).toBe("2202")
  })

  it("a ÉCLAT é emitente E destinatária, com a IE informada (CCC: IE obrigatória como destinatário)", () => {
    const { payload } = chamar()
    const p = payload as any
    expect(p.emitente.cnpj).toBe("68673407000113")
    expect(p.destinatario.cnpj).toBe("68673407000113")
    expect(p.destinatario.ie).toBe("56295050042")
  })

  it("recusa item devolvido que não existe na nota de origem", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_zzz", quantidade: 1 }] })).toThrow(ErroFiscal)
  })

  it("recusa lista de devolvidos vazia", () => {
    expect(() => chamar({ devolvidos: [] })).toThrow(ErroFiscal)
  })
})
