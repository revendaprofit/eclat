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
  { id: "fi_1", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_a", ordem_enviada: 1, n_item_verificado: 1, codigo_enviado: "TOP-AURA-P", ncm: "61091000", quantidade: 1, valor_unitario_centavos: 18900, desconto_centavos: 0 },
  { id: "fi_2", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_b", ordem_enviada: 2, n_item_verificado: 2, codigo_enviado: "LEG-VERTICE-M", ncm: "61046200", quantidade: 2, valor_unitario_centavos: 24900, desconto_centavos: 0 },
]

const itensPedido: ItemPedido[] = [
  { line_item_id: "li_a", product_id: "prod_a", categoria_handle: "tops", titulo: "Top Aura", sku: "TOP-AURA-P", ncm: "61091000", origem: 0, quantidade: 1, valor_unitario_centavos: 18900, desconto_centavos: 0 },
  { line_item_id: "li_b", product_id: "prod_b", categoria_handle: "leggings", titulo: "Legging Vertice", sku: "LEG-VERTICE-M", ncm: "61046200", origem: 0, quantidade: 2, valor_unitario_centavos: 24900, desconto_centavos: 0 },
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

  it("retorna itens_ordenados na ordem do payload, com 2 itens", () => {
    const { payload, itens_ordenados } = chamar({
      devolvidos: [
        { line_item_id: "li_a", quantidade: 1 },
        { line_item_id: "li_b", quantidade: 1 },
      ],
    })
    const p = payload as any
    expect(itens_ordenados).toHaveLength(2)
    // Primeira posição: li_a deve corresponder ao primeiro item do payload
    expect(itens_ordenados[0].line_item_id).toBe("li_a")
    expect(p.itens[0].codigo).toBe("TOP-AURA-P")
    // Segunda posição: li_b deve corresponder ao segundo item do payload
    expect(itens_ordenados[1].line_item_id).toBe("li_b")
    expect(p.itens[1].codigo).toBe("LEG-VERTICE-M")
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

  it("normaliza UF com espaço em branco na escolha do CFOP", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: " MG " })
    expect((payload as any).itens[0].cfop).toBe("1202")
  })

  it("normaliza UF minúscula na escolha do CFOP", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: "sp" })
    expect((payload as any).itens[0].cfop).toBe("2202")
  })

  it("a ÉCLAT é emitente E destinatária, com a IE informada (CCC: IE obrigatória como destinatário)", () => {
    const { payload } = chamar()
    const p = payload as any
    expect(p.emitente.cnpj).toBe("68673407000113")
    expect(p.destinatario.cnpj).toBe("68673407000113")
    expect(p.destinatario.ie).toBe("56295050042")
  })

  // Achado I9/5.7: na venda a destinatária é pessoa física não contribuinte (ind_ie_destinatario
  // 9). Na devolução quem devolve para si mesma é a própria ÉCLAT, contribuinte COM IE — sem o
  // indicador, a IE informada no destinatário fica inconsistente com o cadastro declarado.
  it("declara ind_ie_destinatario de contribuinte (a ÉCLAT tem IE, ao contrário da venda)", () => {
    const { payload } = chamar()
    expect((payload as any).ind_ie_destinatario).toBe(1)
  })

  // Achado 5.5: emitente/destinatario.uf gravavam config.uf CRU (enderecoEclat compartilhado),
  // enquanto a variável usada para decidir o CFOP já era normalizada logo acima.
  it("normaliza a UF do emitente/destinatário (ambos são a ÉCLAT) no payload", () => {
    const { payload } = chamar({ config: { ...config, uf: " mg " } })
    const p = payload as any
    expect(p.emitente.uf).toBe("MG")
    expect(p.destinatario.uf).toBe("MG")
  })

  it("recusa item devolvido que não existe na nota de origem", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_zzz", quantidade: 1 }] })).toThrow(ErroFiscal)
  })

  it("recusa lista de devolvidos vazia", () => {
    expect(() => chamar({ devolvidos: [] })).toThrow(ErroFiscal)
  })
})

// Rateio proporcional do desconto na devolução (Tarefa B1) — mesmo defeito que acabou de ser
// corrigido do lado da venda (fiscal-pedido.ts), agora do lado da NFD.
describe("rateio do desconto na devolução", () => {
  const itensOrigemComDesconto: FiscalDocumentoItem[] = [
    ...itensOrigem,
    // Vendidas 2 unidades, desconto de 200 centavos na linha inteira.
    { id: "fi_3", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_c", ordem_enviada: 3, n_item_verificado: 3, codigo_enviado: "VEST-SOL-G", ncm: "61044200", quantidade: 2, valor_unitario_centavos: 10000, desconto_centavos: 200 },
    // Vendidas 3 unidades, desconto de 100 centavos na linha inteira.
    { id: "fi_4", fiscal_documento_id: "doc_1", medusa_line_item_id: "li_d", ordem_enviada: 4, n_item_verificado: 4, codigo_enviado: "SHORT-FLOW-M", ncm: "61046300", quantidade: 3, valor_unitario_centavos: 8000, desconto_centavos: 100 },
  ]

  const itensPedidoComDesconto: ItemPedido[] = [
    ...itensPedido,
    { line_item_id: "li_c", product_id: "prod_c", categoria_handle: "vestidos", titulo: "Vestido Sol", sku: "VEST-SOL-G", ncm: "61044200", origem: 0, quantidade: 2, valor_unitario_centavos: 10000, desconto_centavos: 200 },
    { line_item_id: "li_d", product_id: "prod_d", categoria_handle: "shorts", titulo: "Short Flow", sku: "SHORT-FLOW-M", ncm: "61046300", origem: 0, quantidade: 3, valor_unitario_centavos: 8000, desconto_centavos: 100 },
  ]

  it("devolução total de item com desconto estorna o desconto inteiro", () => {
    const { payload } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_c", quantidade: 2 }],
    })
    const item = (payload as any).itens[0]
    expect(item.valor_desconto).toBe("2.00")
    // 10000 * 2 - 200 = 19800 centavos = 198.00
    expect(item.valor_total).toBe("198.00")
  })

  it("devolução parcial (1 de 3, desconto de 100) estorna 33", () => {
    const { payload, itens_documento } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_d", quantidade: 1 }],
    })
    const item = (payload as any).itens[0]
    // round(100 * 1 / 3) = round(33.33) = 33
    expect(item.valor_desconto).toBe("0.33")
    expect(item.valor_total).toBe("79.67") // 8000 - 33 = 7967 centavos
    expect(itens_documento[0].desconto_centavos).toBe(33)
  })

  // Achado importante da revisão de 2026-09-17: o teste de "devolução total" (quantidade
  // devolvida == vendida) e o de "total fecha com a soma das linhas" (que soma os próprios itens
  // do payload) passariam mesmo com uma fórmula errada (ex.: sempre estornar o desconto cheio, ou
  // qualquer fórmula internamente consistente). O teste abaixo usa uma fração DIFERENTE (2 de 3,
  // não 1 de 3) — só a fórmula proporcional (Math.round(desconto * qtd / vendida)) bate 67.
  it("devolução parcial (2 de 3, desconto de 100) estorna 67 — prova a fórmula, não só o formato", () => {
    const { payload, itens_documento } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_d", quantidade: 2 }],
    })
    const item = (payload as any).itens[0]
    // round(100 * 2 / 3) = round(66.67) = 67
    expect(item.valor_desconto).toBe("0.67")
    expect(itens_documento[0].desconto_centavos).toBe(67)
  })

  it("arredondamento por remessa: três devoluções de 1 unidade cada não somam o desconto original (esperado)", () => {
    // Cada chamada a montarPayloadDevolucao é independente — não há "resto" acumulado entre
    // remessas. round(100 * 1 / 3) = 33 em cada uma das três vezes, mas 33 + 33 + 33 = 99, não
    // 100. É uma perda de até poucos centavos aceita como parte da política de rateio proporcional
    // por remessa (comentada no código de fiscal-payload-devolucao.ts) — não é bug desta função.
    const devolverUmaUnidade = () =>
      chamar({
        itensOrigem: itensOrigemComDesconto,
        itensPedido: itensPedidoComDesconto,
        devolvidos: [{ line_item_id: "li_d", quantidade: 1 }],
      }).itens_documento[0].desconto_centavos
    const somaTresRemessas = devolverUmaUnidade() + devolverUmaUnidade() + devolverUmaUnidade()
    expect(somaTresRemessas).toBe(99)
    const descontoOriginalDaLinha = itensOrigemComDesconto.find(
      (i) => i.medusa_line_item_id === "li_d"
    )!.desconto_centavos
    expect(somaTresRemessas).not.toBe(descontoOriginalDaLinha)
  })

  it("item sem desconto preserva o comportamento atual (nenhum estorno)", () => {
    const { payload, itens_documento } = chamar({
      devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
    })
    const item = (payload as any).itens[0]
    expect(item.valor_desconto).toBe("0.00")
    expect(item.valor_total).toBe("249.00")
    expect(itens_documento[0].desconto_centavos).toBe(0)
  })

  it("o total da nota fecha com a soma das linhas", () => {
    const { payload } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [
        { line_item_id: "li_c", quantidade: 2 },
        { line_item_id: "li_d", quantidade: 1 },
      ],
    })
    const p = payload as any
    const somaProdutos = p.itens.reduce(
      (acc: number, it: any) => acc + Math.round(Number(it.valor_unitario) * 100) * it.quantidade,
      0
    )
    const somaDesconto = p.itens.reduce(
      (acc: number, it: any) => acc + Math.round(Number(it.valor_desconto) * 100),
      0
    )
    const somaTotal = p.itens.reduce(
      (acc: number, it: any) => acc + Math.round(Number(it.valor_total) * 100),
      0
    )
    expect(Math.round(Number(p.total.valor_produtos) * 100)).toBe(somaProdutos)
    expect(Math.round(Number(p.total.valor_desconto) * 100)).toBe(somaDesconto)
    expect(Math.round(Number(p.total.valor_nota) * 100)).toBe(somaTotal)
    expect(Math.round(Number(p.total.valor_nota) * 100)).toBe(somaProdutos - somaDesconto)
  })
})

// Trava de quantidade já devolvida em NFDs anteriores (Crítico 1 da revisão de 2026-09-17): a
// chave de idempotência por CONJUNTO devolvido (emitir-devolucao/route.ts) deixa de recusar uma
// segunda remessa só porque o conjunto é diferente — sem esta trava, o mesmo item poderia ser
// devolvido duas vezes (uma NFD por remessa, cada uma "válida" isoladamente).
describe("trava de quantidade já devolvida em NFDs anteriores", () => {
  it("recusa quando a soma com devoluções anteriores passaria da quantidade vendida", () => {
    // li_b: vendidas 2 unidades (fixture base). Já devolvida 2 em NFD anterior; pedir mais 1 estoura.
    expect(() =>
      chamar({
        devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
        quantidadesJaDevolvidas: new Map([["li_b", 2]]),
      })
    ).toThrow(ErroFiscal)
  })

  it("a mensagem de erro aponta o item, quanto já foi devolvido e quanto resta", () => {
    expect(() =>
      chamar({
        devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
        quantidadesJaDevolvidas: new Map([["li_b", 2]]),
      })
    ).toThrow(/li_b.*já foram devolvidas 2 de 2/is)
  })

  it("permite quando a soma com devoluções anteriores não excede a quantidade vendida", () => {
    // li_b: vendidas 2. Já devolvida 1 antes; devolver mais 1 agora fecha em 2 — ok.
    const { payload } = chamar({
      devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
      quantidadesJaDevolvidas: new Map([["li_b", 1]]),
    })
    expect((payload as any).itens).toHaveLength(1)
  })

  it("sem devoluções anteriores (mapa vazio, o padrão), comportamento é igual ao de antes", () => {
    const { payload } = chamar({ devolvidos: [{ line_item_id: "li_b", quantidade: 1 }] })
    expect((payload as any).itens).toHaveLength(1)
  })
})
