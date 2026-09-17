import { cfopNumerico, montarPayloadVenda, tipoAmbiente } from "../fiscal-payload"
import { ErroFiscal } from "../tipos"

// Formato do payload: SDK brasilnfe@3.1.3, tipo NotaFiscalEnvio (spec §7.1.1).

const config = {
  id: 1, cnpj: "68673407000113", razao_social: "CAMILA DE MOURA NOGUEIRA",
  nome_fantasia: "USE ECLAT", ie: "56295050042", im: null, crt: 1,
  logradouro: "R NORTE", numero: "180", complemento: null, bairro: "ANGOLA",
  municipio: "BETIM", municipio_ibge: "3106705", uf: "MG", cep: "32604182",
  serie_nfe: 1, ambiente: "homologacao", emissao_ativa: true,
}

function perfil(p = {}) {
  return {
    id: "padrao", escopo: "padrao", alvo_id: null, csosn: "102",
    cfop_dentro_uf: "5102", cfop_fora_uf: "6108",
    cfop_devolucao_dentro_uf: "1202", cfop_devolucao_fora_uf: "2202",
    origem_padrao: 0, ativo: true, ...p,
  }
}

function item(p = {}) {
  return {
    line_item_id: p.line_item_id ?? "li_1",
    product_id: p.product_id ?? "prod_1",
    categoria_handle: p.categoria_handle ?? "tops",
    titulo: p.titulo ?? "Top Aura",
    // "in" distingue AUSENTE (usa o default) de NULO explícito (preserva o null do teste).
    sku: "sku" in p ? (p.sku ?? null) : "TOP-AURA-P",
    ncm: "ncm" in p ? (p.ncm ?? null) : "61091000",
    origem: "origem" in p ? (p.origem ?? null) : 0,
    quantidade: p.quantidade ?? 1,
    valor_unitario_centavos: p.valor_unitario_centavos ?? 18990,
    desconto_centavos: p.desconto_centavos ?? 0,
  }
}

function destino(uf) {
  return {
    cpf: "12345678909", nome: "Maria Silva", logradouro: "Rua A", numero: "10",
    complemento: null, bairro: "Centro", municipio: "Belo Horizonte",
    municipio_ibge: "3106200", uf, cep: "30110000",
  }
}

function montar(over = {}) {
  return montarPayloadVenda({
    config, perfis: [perfil()], itens: [item()], destinatario: destino("MG"),
    frete_centavos: 0, pagamento: { forma: "99", descricao: "Pagamento online" },
    identificador: "order_1:venda:homologacao", ...over,
  }).payload
}

describe("tipoAmbiente / cfopNumerico", () => {
  it("homologação é 2, produção é 1", () => {
    expect(tipoAmbiente("homologacao")).toBe(2)
    expect(tipoAmbiente("producao")).toBe(1)
  })

  it("CFOP vira número; CFOP malformado é erro, nunca NaN na nota", () => {
    expect(cfopNumerico("5102", "Top")).toBe(5102)
    expect(() => cfopNumerico("", "Top")).toThrow(ErroFiscal)
    expect(() => cfopNumerico("51A2", "Top")).toThrow(ErroFiscal)
  })
})

describe("montarPayloadVenda — cabeçalho", () => {
  it("usa os nomes e tipos do contrato real", () => {
    const p = montar()
    expect(p.ModeloDocumento).toBe(55)
    expect(p.Finalidade).toBe(1)
    expect(p.TipoAmbiente).toBe(2)
    expect(p.ConsumidorFinal).toBe(true)      // booleano, não 1
    expect(p.IndicadorPresenca).toBe(2)       // não presencial, Internet
    expect(p.CalcularIBPT).toBe(true)         // Lei 12.741/2012
    expect(p.EnviarEmail).toBe(false)
    expect(p.NaturezaOperacao).toBe("VENDA DE MERCADORIA")
    expect(p.IdentificadorInterno).toBe("order_1:venda:homologacao")
  })

  it("NÃO envia o que o contrato não tem ou que causaria rejeição", () => {
    const p = montar()
    expect(p).not.toHaveProperty("Intermediador")   // rejeição 435 em venda direta
    expect(p).not.toHaveProperty("NFReferencia")
    expect(p).not.toHaveProperty("Serie")           // numeração é do fornecedor
    expect(p).not.toHaveProperty("Numero")
    expect(p).not.toHaveProperty("Lote")
    expect(p).not.toHaveProperty("emitente")        // vem do cadastro no painel deles
    expect(p).not.toHaveProperty("total")
    expect(p).not.toHaveProperty("itens")
  })

  it("monta o Cliente como pessoa física não contribuinte", () => {
    const c = montar().Cliente
    expect(c.CpfCnpj).toBe("12345678909")
    expect(c.NmCliente).toBe("Maria Silva")
    expect(c.IndicadorIe).toBe(9)
    expect(c.Endereco).toEqual({
      Cep: "30110000", Logradouro: "Rua A", Numero: "10", Complemento: null, Bairro: "Centro",
      CodMunicipio: "3106200", Municipio: "Belo Horizonte", Uf: "MG", CodPais: 1058, Pais: "BRASIL",
    })
  })

  it("envia ModalidadeFrete 0 de propósito (omitido, a API assume 9 = sem transporte)", () => {
    expect(montar().Transporte).toEqual({ ModalidadeFrete: 0 })
  })
})

describe("montarPayloadVenda — produtos", () => {
  it("CFOP de dentro do estado quando o destino é MG, interestadual fora — como número", () => {
    expect(montar({ destinatario: destino("MG") }).Produtos[0].CFOP).toBe(5102)
    expect(montar({ destinatario: destino("SP") }).Produtos[0].CFOP).toBe(6108)
  })

  it("UF com espaço ou minúscula não vira interestadual por engano", () => {
    expect(montar({ destinatario: destino(" mg ") }).Produtos[0].CFOP).toBe(5102)
  })

  it("valores em reais como NÚMERO, bruto e desconto separados", () => {
    const prod = montar({
      itens: [item({ quantidade: 2, valor_unitario_centavos: 18990, desconto_centavos: 3000 })],
    }).Produtos[0]
    expect(prod.ValorUnitario).toBe(189.9)
    expect(prod.ValorUnitarioTributavel).toBe(189.9)
    expect(prod.ValorTotal).toBe(379.8)      // bruto: 2 × 189.90
    expect(prod.ValorDesconto).toBe(30)
    expect(prod.Quantidade).toBe(2)
    expect(prod.QuantidadeTributavel).toBe(2)
    expect(prod.UnidadeComercial).toBe("UN")
  })

  it("o CSOSN vai dentro de Imposto.ICMS, não solto no item", () => {
    const prod = montar().Produtos[0]
    expect(prod.Imposto.ICMS.CodSituacaoTributaria).toBe("102")
    expect(prod).not.toHaveProperty("csosn")
  })

  it("PIS/COFINS e CEST só entram quando o perfil os define", () => {
    const sem = montar().Produtos[0]
    expect(sem.Imposto).not.toHaveProperty("PIS")
    expect(sem.Imposto).not.toHaveProperty("COFINS")
    expect(sem).not.toHaveProperty("CEST")

    const com = montar({ perfis: [perfil({ cst_pis_cofins: "99", cest: "2806000" })] }).Produtos[0]
    expect(com.Imposto.PIS).toEqual({ CodSituacaoTributaria: "99" })
    expect(com.Imposto.COFINS).toEqual({ CodSituacaoTributaria: "99" })
    expect(com.CEST).toBe("2806000")
  })

  it("nunca envia o grupo IBSCBS (risco 1 da spec ainda aberto)", () => {
    expect(montar().Produtos[0].Imposto).not.toHaveProperty("IBSCBS")
  })

  it("CSOSN que exige campos que não enviamos é recusado, não emitido pela metade", () => {
    for (const csosn of ["101", "201", "202", "203", "900"]) {
      expect(() => montar({ perfis: [perfil({ csosn })] })).toThrow(ErroFiscal)
    }
    for (const csosn of ["102", "103", "300", "400", "500"]) {
      expect(() => montar({ perfis: [perfil({ csosn })] })).not.toThrow()
    }
  })

  it("código é o SKU, ou o line_item_id na falta dele", () => {
    expect(montar().Produtos[0].CodProdutoServico).toBe("TOP-AURA-P")
    expect(montar({ itens: [item({ sku: null })] }).Produtos[0].CodProdutoServico).toBe("li_1")
  })

  it("origem da variante vence; sem ela, a do perfil", () => {
    expect(montar({ itens: [item({ origem: 1 })] }).Produtos[0].OrigemProduto).toBe(1)
    expect(montar({ itens: [item({ origem: null })], perfis: [perfil({ origem_padrao: 5 })] }).Produtos[0].OrigemProduto).toBe(5)
  })

  it("preserva a ordem dos itens — a posição no array É o nItem", () => {
    const r = montarPayloadVenda({
      config, perfis: [perfil()], destinatario: destino("MG"), frete_centavos: 0,
      pagamento: { forma: "99", descricao: "Pagamento online" }, identificador: "k",
      itens: [item({ line_item_id: "li_a", sku: "A" }), item({ line_item_id: "li_b", sku: "B" })],
    })
    expect(r.payload.Produtos.map((x) => x.CodProdutoServico)).toEqual(["A", "B"])
    expect(r.itens_ordenados.map((x) => x.line_item_id)).toEqual(["li_a", "li_b"])
    expect(r.payload.Produtos[0]).not.toHaveProperty("numero_item")
  })

  it("produto sem NCM bloqueia, apontando o produto", () => {
    expect(() => montar({ itens: [item({ ncm: null, titulo: "Legging Vértice" })] })).toThrow(/Legging Vértice/)
  })

  it("pedido sem itens é erro", () => {
    expect(() => montar({ itens: [] })).toThrow(ErroFiscal)
  })
})

describe("montarPayloadVenda — frete e pagamento", () => {
  it("rateia o frete entre os itens e a soma fecha no centavo", () => {
    const p = montar({
      frete_centavos: 100,
      itens: [
        item({ line_item_id: "a", sku: "A", valor_unitario_centavos: 5000 }),
        item({ line_item_id: "b", sku: "B", valor_unitario_centavos: 5000 }),
        item({ line_item_id: "c", sku: "C", valor_unitario_centavos: 5000 }),
      ],
    })
    expect(p.Produtos.map((x) => x.ValorFrete)).toEqual([0.34, 0.33, 0.33])
  })

  it("o rateio pesa pelo valor LÍQUIDO da linha (bruto − desconto)", () => {
    const p = montar({
      frete_centavos: 1000,
      itens: [
        item({ line_item_id: "a", sku: "A", valor_unitario_centavos: 10000, desconto_centavos: 2500 }), // líquido 7500
        item({ line_item_id: "b", sku: "B", valor_unitario_centavos: 2500 }),                            // líquido 2500
      ],
    })
    expect(p.Produtos.map((x) => x.ValorFrete)).toEqual([7.5, 2.5])
  })

  it("VlPago é o total da nota: produtos − desconto + frete", () => {
    const p = montar({
      frete_centavos: 2590,
      itens: [item({ quantidade: 2, valor_unitario_centavos: 18990, desconto_centavos: 3000 })],
    })
    // 2 × 189.90 − 30.00 + 25.90 = 375.70
    expect(p.Pagamentos).toEqual([
      { IndicadorPagamento: 0, FormaPagamento: "99", Descricao: "Pagamento online", VlPago: 375.7 },
    ])
  })

  it("forma de pagamento sem descrição não manda o campo Descricao", () => {
    const p = montar({ pagamento: { forma: "17", descricao: null } })
    expect(p.Pagamentos[0].FormaPagamento).toBe("17")
    expect(p.Pagamentos[0]).not.toHaveProperty("Descricao")
  })
})
