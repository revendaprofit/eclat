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

// Fixtures do rateio proporcional do desconto na devolução (Tarefa B1) — no escopo do arquivo
// porque também são usadas por "resumo da devolução" (Tarefa 9).
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

function chamar(over: Record<string, unknown> = {}) {
  return montarPayloadDevolucao({
    config, perfis: [perfilPadrao], documentoOrigem: documento(), itensOrigem,
    devolvidos: [{ line_item_id: "li_b", quantidade: 1 }],
    itensPedido, ufDestinatarioOriginal: "MG",
    identificador: "order_1:devolucao:homologacao:abc",
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
  it("é devolução (Finalidade 4); o tipo entrada NÃO é enviado — a API deriva do CFOP 1xxx/2xxx", () => {
    const { payload } = chamar()
    const p = payload as any
    expect(p.Finalidade).toBe(4)
    expect(p.ModeloDocumento).toBe(55)
    expect(p.TipoAmbiente).toBe(2)
    expect(p.NaturezaOperacao).toBe("DEVOLUCAO DE VENDA")
    expect(p.ConsumidorFinal).toBe(false)
    expect(p.IndicadorPresenca).toBe(0)
    expect(p.IdentificadorInterno).toBe("order_1:devolucao:homologacao:abc")
    expect(p).not.toHaveProperty("tipo_nf")
    expect(p).not.toHaveProperty("Serie")
    expect(p).not.toHaveProperty("Numero")
    expect(p).not.toHaveProperty("Intermediador")
  })

  it("referencia a nota de origem ITEM A ITEM: chave + nItem no próprio produto (VC02-14, VC03-20)", () => {
    const { payload } = chamar()
    const prod = (payload as any).Produtos[0]
    expect(prod.ChaveAcessoReferenciada).toBe(CHAVE)
    expect(prod.NItemReferenciado).toBe(2) // li_b foi autorizado como nItem 2 na venda
  })

  it("NUNCA envia NFReferencia na raiz — é o refNFe genérico que a VC02-14 proíbe", () => {
    expect(chamar().payload).not.toHaveProperty("NFReferencia")
  })

  it("respeita a quantidade devolvida, não a vendida; ValorTotal é o BRUTO", () => {
    const { payload } = chamar() // 1 de 2 leggings a 249.00
    const prod = (payload as any).Produtos[0]
    expect(prod.Quantidade).toBe(1)
    expect(prod.ValorUnitario).toBe(249)
    expect(prod.ValorTotal).toBe(249)
    expect(prod.ValorDesconto).toBe(0)
  })

  it("a ÉCLAT é o Cliente da NFD, como contribuinte com IE (spec §11 risco 10 — decisão provisória)", () => {
    const c = (chamar().payload as any).Cliente
    expect(c.CpfCnpj).toBe("68673407000113")
    expect(c.IndicadorIe).toBe(1)
    expect(c.Ie).toBe("56295050042")
    expect(c.Endereco.CodMunicipio).toBe("3106705")
    expect(c.Endereco.Uf).toBe("MG")
    expect(chamar().payload).not.toHaveProperty("emitente")
  })

  it("normaliza a UF do Cliente (config.uf cru com espaço/minúscula)", () => {
    const { payload } = chamar({ config: { ...config, uf: " mg " } })
    expect((payload as any).Cliente.Endereco.Uf).toBe("MG")
  })

  it("sem pagamento (90, valor 0) e sem transporte (9)", () => {
    const p = chamar().payload as any
    expect(p.Pagamentos).toEqual([{ IndicadorPagamento: 0, FormaPagamento: "90", VlPago: 0 }])
    expect(p.Transporte).toEqual({ ModalidadeFrete: 9 })
  })

  it("CSOSN vai em Imposto.ICMS; perfil com CSOSN não suportado é recusado", () => {
    expect((chamar().payload as any).Produtos[0].Imposto.ICMS.CodSituacaoTributaria).toBe("102")
    expect(() => chamar({ perfis: [{ ...perfilPadrao, csosn: "201" }] })).toThrow(ErroFiscal)
  })

  it("devolução parcial referencia só o item devolvido", () => {
    const { payload } = chamar()
    expect((payload as any).Produtos).toHaveLength(1)
    expect((payload as any).Produtos[0].CodProdutoServico).toBe("LEG-VERTICE-M")
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
    expect(p.Produtos[0].CodProdutoServico).toBe("TOP-AURA-P")
    // Segunda posição: li_b deve corresponder ao segundo item do payload
    expect(itens_ordenados[1].line_item_id).toBe("li_b")
    expect(p.Produtos[1].CodProdutoServico).toBe("LEG-VERTICE-M")
  })

  it("recusa quantidade devolvida maior que a vendida", () => {
    expect(() => chamar({ devolvidos: [{ line_item_id: "li_b", quantidade: 5 }] })).toThrow(
      /maior que a quantidade vendida/i
    )
  })

  it("usa CFOP de devolução dentro do estado quando a venda foi para MG", () => {
    expect(((chamar().payload) as any).Produtos[0].CFOP).toBe(1202)
  })

  it("usa CFOP de devolução interestadual quando a venda foi para fora de MG", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: "SP" })
    expect((payload as any).Produtos[0].CFOP).toBe(2202)
  })

  it("normaliza UF com espaço em branco na escolha do CFOP", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: " MG " })
    expect((payload as any).Produtos[0].CFOP).toBe(1202)
  })

  it("normaliza UF minúscula na escolha do CFOP", () => {
    const { payload } = chamar({ ufDestinatarioOriginal: "sp" })
    expect((payload as any).Produtos[0].CFOP).toBe(2202)
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
  it("devolução total de item com desconto estorna o desconto inteiro", () => {
    const { payload } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_c", quantidade: 2 }],
    })
    const item = (payload as any).Produtos[0]
    expect(item.ValorDesconto).toBe(2)
    expect(item.ValorTotal).toBe(200)   // BRUTO: 10000 × 2 = 200.00; o desconto vai à parte
  })

  it("devolução parcial (1 de 3, desconto de 100) estorna 33", () => {
    const { payload, itens_documento } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_d", quantidade: 1 }],
    })
    const item = (payload as any).Produtos[0]
    // round(100 * 1 / 3) = round(33.33) = 33
    expect(item.ValorDesconto).toBe(0.33)
    expect(item.ValorTotal).toBe(80)    // BRUTO de 1 unidade
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
    const item = (payload as any).Produtos[0]
    // round(100 * 2 / 3) = round(66.67) = 67
    expect(item.ValorDesconto).toBe(0.67)
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
    const item = (payload as any).Produtos[0]
    expect(item.ValorDesconto).toBe(0)
    expect(item.ValorTotal).toBe(249)
    expect(itens_documento[0].desconto_centavos).toBe(0)
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
    expect((payload as any).Produtos).toHaveLength(1)
  })

  it("sem devoluções anteriores (mapa vazio, o padrão), comportamento é igual ao de antes", () => {
    const { payload } = chamar({ devolvidos: [{ line_item_id: "li_b", quantidade: 1 }] })
    expect((payload as any).Produtos).toHaveLength(1)
  })
})

// Tarefa 9: o Cockpit para de ler o payload do fornecedor (payload.itens/payload.total, que a
// Tarefa 4 removeu) para montar a prévia da NFD. O backend passa a devolver um resumo próprio,
// em centavos, que a tela só precisa exibir.
describe("resumo da devolução (para a tela, em centavos)", () => {
  it("traz itens e totais sem depender do formato do payload do fornecedor", () => {
    const { resumo } = chamar() // 1 de 2 leggings a 249.00, sem desconto
    expect(resumo).toEqual({
      itens: [{
        codigo: "LEG-VERTICE-M", descricao: "Legging Vertice", quantidade: 1,
        bruto_centavos: 24900, desconto_centavos: 0, liquido_centavos: 24900,
      }],
      produtos_centavos: 24900,
      desconto_centavos: 0,
      total_centavos: 24900,
    })
  })

  it("os totais fecham com a soma das linhas, inclusive com desconto rateado", () => {
    const { resumo } = chamar({
      itensOrigem: itensOrigemComDesconto,
      itensPedido: itensPedidoComDesconto,
      devolvidos: [{ line_item_id: "li_c", quantidade: 2 }, { line_item_id: "li_d", quantidade: 1 }],
    })
    const soma = (f: (i: (typeof resumo.itens)[number]) => number) => resumo.itens.reduce((a, i) => a + f(i), 0)
    expect(resumo.produtos_centavos).toBe(soma((i) => i.bruto_centavos))
    expect(resumo.desconto_centavos).toBe(soma((i) => i.desconto_centavos))
    expect(resumo.total_centavos).toBe(soma((i) => i.liquido_centavos))
    expect(resumo.total_centavos).toBe(resumo.produtos_centavos - resumo.desconto_centavos)
    for (const i of resumo.itens) expect(i.liquido_centavos).toBe(i.bruto_centavos - i.desconto_centavos)
  })
})
