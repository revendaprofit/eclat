import { montarPayloadVenda, type DestinatarioNF } from "../fiscal-payload"
import { ErroFiscal, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "../tipos"

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

function item(p: Partial<ItemPedido> = {}): ItemPedido {
  return {
    line_item_id: p.line_item_id ?? "li_1",
    product_id: p.product_id ?? "prod_1",
    categoria_handle: p.categoria_handle ?? "tops",
    titulo: p.titulo ?? "Top Aura",
    sku: p.sku ?? "TOP-AURA-P",
    ncm: "ncm" in p ? p.ncm : "61091000",
    origem: "origem" in p ? p.origem : 0,
    quantidade: p.quantidade ?? 1,
    valor_unitario_centavos: p.valor_unitario_centavos ?? 18900,
    desconto_centavos: p.desconto_centavos ?? 0,
  }
}

function destino(uf: string): DestinatarioNF {
  return {
    cpf: "12345678909", nome: "Maria Silva", logradouro: "Rua A", numero: "10",
    complemento: null, bairro: "Centro", municipio: "Belo Horizonte",
    municipio_ibge: "3106200", uf, cep: "30110000",
  }
}

describe("montarPayloadVenda", () => {
  it("usa CFOP de dentro do estado quando o destino é MG", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    const itens = (payload as any).itens
    expect(itens[0].cfop).toBe("5102")
  })

  it("usa CFOP interestadual quando o destino é fora de MG", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("SP"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].cfop).toBe("6108")
  })

  it("marca consumidor final não contribuinte em operação pela Internet", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    const p = payload as any
    expect(p.ind_ie_destinatario).toBe(9)
    expect(p.ind_final).toBe(1)
    expect(p.ind_presenca).toBe(2)
    expect(p.finalidade).toBe(1)
    expect(p.tipo_nf).toBe(1)
  })

  it("preenche CSOSN do perfil e CRT do emitente (Simples Nacional)", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].csosn).toBe("102")
    expect((payload as any).emitente.crt).toBe(1)
  })

  it("converte centavos para reais com 2 casas, sem float acumulado", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao],
      itens: [item({ valor_unitario_centavos: 18990, quantidade: 3 })],
      destinatario: destino("MG"), frete_centavos: 1990,
    })
    const p = payload as any
    expect(p.itens[0].valor_unitario).toBe("189.90")
    expect(p.itens[0].valor_total).toBe("569.70")
    expect(p.total.valor_frete).toBe("19.90")
    expect(p.total.valor_produtos).toBe("569.70")
    expect(p.total.valor_nota).toBe("589.60")
  })

  it("aplica o desconto do item no valor_total da linha e nos totais da nota, sem tocar no valor_unitario bruto", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao],
      itens: [item({ valor_unitario_centavos: 5000, quantidade: 2, desconto_centavos: 1000 })],
      destinatario: destino("MG"), frete_centavos: 0,
    })
    const p = payload as any
    // Bruto continua bruto — o desconto nunca é escondido dentro do valor_unitario.
    expect(p.itens[0].valor_unitario).toBe("50.00")
    expect(p.itens[0].valor_desconto).toBe("10.00")
    expect(p.itens[0].valor_total).toBe("90.00") // 50*2 - 10
    expect(p.total.valor_produtos).toBe("100.00") // soma dos brutos
    expect(p.total.valor_desconto).toBe("10.00")
    expect(p.total.valor_nota).toBe("90.00") // produtos - desconto + frete(0)
  })

  it("numera itens de 1 em diante e devolve a ordem enviada", () => {
    const a = item({ line_item_id: "li_a" })
    const b = item({ line_item_id: "li_b" })
    const { payload, itens_ordenados } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [a, b], destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens.map((i: any) => i.numero_item)).toEqual([1, 2])
    expect(itens_ordenados.map((i) => i.line_item_id)).toEqual(["li_a", "li_b"])
  })

  it("falha com mensagem legível quando falta NCM", () => {
    expect(() =>
      montarPayloadVenda({
        config, perfis: [perfilPadrao], itens: [item({ ncm: null, titulo: "Top Aura" })],
        destinatario: destino("MG"), frete_centavos: 0,
      })
    ).toThrow(/Top Aura.*NCM/s)
  })

  it("falha quando não há itens", () => {
    expect(() =>
      montarPayloadVenda({
        config, perfis: [perfilPadrao], itens: [], destinatario: destino("MG"), frete_centavos: 0,
      })
    ).toThrow(ErroFiscal)
  })

  it("usa origem do perfil quando a variante não tem origem", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [{ ...perfilPadrao, origem_padrao: 1 }], itens: [item({ origem: null })],
      destinatario: destino("MG"), frete_centavos: 0,
    })
    expect((payload as any).itens[0].origem).toBe(1)
  })

  it("normaliza UF com espaço à direita no payload", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG "), frete_centavos: 0,
    })
    expect((payload as any).destinatario.uf).toBe("MG")
  })

  it("normaliza UF minúscula no payload", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("mg"), frete_centavos: 0,
    })
    expect((payload as any).destinatario.uf).toBe("MG")
  })

  it("trata UF com espaço como dentro do estado se for a UF do emitente", () => {
    const { payload } = montarPayloadVenda({
      config, perfis: [perfilPadrao], itens: [item()], destinatario: destino("MG "), frete_centavos: 0,
    })
    expect((payload as any).itens[0].cfop).toBe("5102")
  })
})
