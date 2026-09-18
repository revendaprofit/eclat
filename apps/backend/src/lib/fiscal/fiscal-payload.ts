// Monta o payload da NF-e de venda no contrato REAL da Brasil NFe (spec §7.1.1).
// Fonte do formato: SDK oficial brasilnfe@3.1.3, tipo NotaFiscalEnvio.
// Função PURA: não faz rede, não lê banco.
//
// O que NÃO vai, de propósito:
//   - emitente e totais da nota: vêm do cadastro e do cálculo do fornecedor;
//   - Serie/Numero/Lote: omitidos, a numeração é gerenciada por eles;
//   - Intermediador: venda em site próprio. Enviar o grupo é rejeição 435 — e o JSON de
//     exemplo do fornecedor o inclui, então não copie de lá;
//   - número do item: não existe campo. A POSIÇÃO no array Produtos é o nItem.

import { numeroReais, ratearFrete } from "./fiscal-dinheiro"
import type { PagamentoNF } from "./fiscal-pagamento"
import { resolverPerfil } from "./fiscal-perfil"
import { ErroFiscal, type Ambiente, type FiscalConfig, type FiscalPerfil, type ItemPedido } from "./tipos"

export type DestinatarioNF = {
  cpf: string
  nome: string
  logradouro: string
  numero: string
  complemento: string | null
  bairro: string
  municipio: string
  municipio_ibge: string
  uf: string
  cep: string
}

// Só os CSOSN que não exigem campo além do próprio código. 101 pede alíquota de crédito;
// 201/202/203/900 pedem MVA e base de ST — nada disso é enviado por este sistema (spec §11.3).
export const CSOSN_SUPORTADOS = new Set(["102", "103", "300", "400", "500"])

export function tipoAmbiente(a: Ambiente): 1 | 2 {
  return a === "producao" ? 1 : 2
}

export function cfopNumerico(cfop: string, titulo: string): number {
  if (!/^\d{4}$/.test(String(cfop ?? "").trim())) {
    throw new ErroFiscal(
      `CFOP inválido ("${cfop}") no perfil fiscal aplicado a "${titulo}". Corrija em Fiscal → Perfis tributários.`
    )
  }
  return Number(String(cfop).trim())
}

export function impostoDoPerfil(perfil: FiscalPerfil, titulo: string): Record<string, unknown> {
  const csosn = String(perfil.csosn ?? "").trim()
  if (!CSOSN_SUPORTADOS.has(csosn)) {
    throw new ErroFiscal(
      `O perfil fiscal aplicado a "${titulo}" usa CSOSN ${csosn || "(vazio)"}, que exige campos que este sistema ainda não envia (alíquota de crédito ou substituição tributária). Suportados: 102, 103, 300, 400, 500. Fale com o desenvolvedor antes de emitir.`
    )
  }
  const imposto: Record<string, unknown> = { ICMS: { CodSituacaoTributaria: csosn } }
  // CST de PIS e COFINS são espelhados. Sem valor no perfil, o bloco não vai.
  if (perfil.cst_pis_cofins) {
    imposto.PIS = { CodSituacaoTributaria: perfil.cst_pis_cofins }
    imposto.COFINS = { CodSituacaoTributaria: perfil.cst_pis_cofins }
  }
  return imposto
}

export function montarPayloadVenda(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
  pagamento: PagamentoNF
  identificador: string
}): { payload: Record<string, unknown>; itens_ordenados: ItemPedido[] } {
  const { config, perfis, itens, destinatario, frete_centavos, pagamento, identificador } = args

  if (itens.length === 0) {
    throw new ErroFiscal("Pedido sem itens: não há o que emitir.")
  }

  // A MESMA normalização decide o CFOP e vai para o payload (achado 5.5 da revisão 1).
  const ufDestino = destinatario.uf.trim().toUpperCase()
  const ufEmitente = config.uf.trim().toUpperCase()
  const interestadual = ufDestino !== ufEmitente

  for (const it of itens) {
    if (!it.ncm) {
      throw new ErroFiscal(
        `Produto "${it.titulo}" está sem NCM. Cadastre o NCM da variante (campo hs_code) em Produtos antes de emitir.`
      )
    }
  }

  // Frete por item, pesado pelo valor LÍQUIDO da linha.
  const liquidos = itens.map((it) => it.valor_unitario_centavos * it.quantidade - it.desconto_centavos)
  const fretes = ratearFrete(frete_centavos, liquidos)

  const produtos = itens.map((it, idx) => {
    const perfil = resolverPerfil(perfis, it.product_id, it.categoria_handle)
    const produto: Record<string, unknown> = {
      NmProduto: it.titulo,
      CodProdutoServico: it.sku ?? it.line_item_id,
      NCM: it.ncm,
      CFOP: cfopNumerico(interestadual ? perfil.cfop_fora_uf : perfil.cfop_dentro_uf, it.titulo),
      UnidadeComercial: "UN",
      UnidadeComercialTributavel: "UN",
      Quantidade: it.quantidade,
      QuantidadeTributavel: it.quantidade,
      // Unitário e total ficam no BRUTO; o desconto vai em campo próprio, nunca escondido.
      ValorUnitario: numeroReais(it.valor_unitario_centavos),
      ValorUnitarioTributavel: numeroReais(it.valor_unitario_centavos),
      ValorTotal: numeroReais(it.valor_unitario_centavos * it.quantidade),
      ValorDesconto: numeroReais(it.desconto_centavos),
      ValorFrete: numeroReais(fretes[idx]),
      OrigemProduto: it.origem != null ? it.origem : perfil.origem_padrao,
      Imposto: impostoDoPerfil(perfil, it.titulo),
    }
    if (perfil.cest) produto.CEST = perfil.cest
    return produto
  })

  const totalNotaCentavos = liquidos.reduce((a, b) => a + b, 0) + frete_centavos

  const pag: Record<string, unknown> = { IndicadorPagamento: 0, FormaPagamento: pagamento.forma }
  if (pagamento.descricao) pag.Descricao = pagamento.descricao
  pag.VlPago = numeroReais(totalNotaCentavos)

  const payload: Record<string, unknown> = {
    ModeloDocumento: 55,
    Finalidade: 1,
    // Enviado sempre, embora opcional: se o cadastro no painel deles divergir, a resposta denuncia.
    TipoAmbiente: tipoAmbiente(config.ambiente),
    NaturezaOperacao: "VENDA DE MERCADORIA",
    ConsumidorFinal: true,
    IndicadorPresenca: 2,
    CalcularIBPT: true,
    EnviarEmail: false,
    IdentificadorInterno: identificador,
    Cliente: {
      CpfCnpj: destinatario.cpf,
      NmCliente: destinatario.nome,
      IndicadorIe: 9,
      Endereco: {
        Cep: destinatario.cep,
        Logradouro: destinatario.logradouro,
        Numero: destinatario.numero,
        Complemento: destinatario.complemento,
        Bairro: destinatario.bairro,
        CodMunicipio: destinatario.municipio_ibge,
        Municipio: destinatario.municipio,
        Uf: ufDestino,
        CodPais: 1058,
        Pais: "BRASIL",
      },
    },
    Produtos: produtos,
    Pagamentos: [pag],
    // Omitido, a API materializa ModalidadeFrete 9 ("sem transporte") — falso para quem despacha.
    Transporte: { ModalidadeFrete: 0 },
  }

  return { payload, itens_ordenados: itens }
}
