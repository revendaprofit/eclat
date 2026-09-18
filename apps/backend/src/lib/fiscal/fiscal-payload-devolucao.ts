// Monta o payload da NF-e de devolução — entrada própria, finalidade 4 (spec §8).
//
// Desde 01/09/2026 (NT 2025.002-RTC v1.40) a devolução referencia a nota de origem ITEM A ITEM,
// pelos campos `ChaveAcessoReferenciada` + `NItemReferenciado` DE CADA PRODUTO — a API monta com
// eles o grupo DFeReferenciado. `NFReferencia` (raiz) é o refNFe genérico que a VC02-14 proíbe, e
// os dois não podem coexistir. Regras atendidas aqui:
//   VC02-14  referência exclusivamente item a item (refNFe genérico é proibido)
//   VC03-20  nItem obrigatório em cada referência
//   VC02-40  emitente das notas referenciadas igual em todos os itens (só referenciamos 1 nota)
//   VC02-50  destinatário da NF-e igual ao emitente da nota referenciada (a ÉCLAT devolve para si)
//
// A consumidora é pessoa física e não emite nota: quem emite a devolução é a loja, como entrada.
// O CCC/SVRS informa "IE como destinatário: Obrigatória" — por isso a IE vai no destinatário também.

import { resolverPerfil } from "./fiscal-perfil"
import { numeroReais } from "./fiscal-dinheiro"
import { cfopNumerico, impostoDoPerfil, tipoAmbiente } from "./fiscal-payload"
import {
  ErroFiscal,
  type FiscalConfig,
  type FiscalDocumento,
  type FiscalDocumentoItem,
  type FiscalPerfil,
  type ItemPedido,
} from "./tipos"

// Resumo para a tela, em centavos. A tela NUNCA lê o payload do fornecedor: o formato dele é
// problema desta camada, não do Cockpit.
export type ResumoDevolucao = {
  itens: Array<{
    codigo: string; descricao: string; quantidade: number
    bruto_centavos: number; desconto_centavos: number; liquido_centavos: number
  }>
  produtos_centavos: number
  desconto_centavos: number
  total_centavos: number
}

export function montarPayloadDevolucao(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  documentoOrigem: FiscalDocumento
  itensOrigem: FiscalDocumentoItem[]
  devolvidos: Array<{ line_item_id: string; quantidade: number }>
  itensPedido: ItemPedido[]
  ufDestinatarioOriginal: string
  identificador: string
  // Soma, por medusa_line_item_id, do que já foi devolvido em NFDs anteriores RESOLVIDAS deste
  // mesmo documento de venda (achado crítico da revisão de 2026-09-17). Sem isso, a chave de
  // idempotência por CONJUNTO devolvido (emitir-devolucao/route.ts) permitiria devolver o mesmo
  // item duas vezes só porque cada remessa tem um conjunto diferente. Default vazio para não
  // quebrar quem ainda não passa o mapa (ex.: chamadas antigas nos testes).
  quantidadesJaDevolvidas?: Map<string, number>
}): {
  payload: Record<string, unknown>
  itens_ordenados: ItemPedido[]
  itens_documento: Array<Omit<FiscalDocumentoItem, "id" | "fiscal_documento_id" | "n_item_verificado">>
  resumo: ResumoDevolucao
} {
  const {
    config, perfis, documentoOrigem, itensOrigem, devolvidos, itensPedido, ufDestinatarioOriginal,
    identificador,
    quantidadesJaDevolvidas = new Map<string, number>(),
  } = args

  // --- Trava de segurança (spec §7.3) ---------------------------------------
  if (documentoOrigem.status !== "verificado" || !documentoOrigem.verificado_em) {
    throw new ErroFiscal(
      "A nota de venda deste pedido ainda não foi reconciliada (o XML autorizado não foi lido). " +
        "Sem o nItem confirmado pela SEFAZ a devolução seria rejeitada (VC03-20). " +
        "Rode a reconciliação em Fiscal → Fila antes de emitir a devolução."
    )
  }
  if (!documentoOrigem.chave_acesso) {
    throw new ErroFiscal("A nota de venda deste pedido não tem chave de acesso gravada.")
  }
  if (devolvidos.length === 0) {
    throw new ErroFiscal("Nenhum item informado para devolução.")
  }
  // -------------------------------------------------------------------------

  const ufDestino = ufDestinatarioOriginal.trim().toUpperCase()
  const ufEmitente = config.uf.trim().toUpperCase()
  const interestadual = ufDestino !== ufEmitente
  const ordenados: ItemPedido[] = []
  // Dados prontos para persistir em fiscal_documento_item (mesmo formato usado por
  // fiscal-emissao.ts na venda) — calculados uma única vez aqui, junto com o rateio do
  // desconto, para a rota de emissão da NFD não precisar reimplementar a fórmula.
  const itensDocumento: Array<Omit<FiscalDocumentoItem, "id" | "fiscal_documento_id" | "n_item_verificado">> = []
  const itensResumo: ResumoDevolucao["itens"] = []

  const linhas = devolvidos.map((dev, idx) => {
    const origem = itensOrigem.find((i) => i.medusa_line_item_id === dev.line_item_id)
    if (!origem) {
      throw new ErroFiscal(
        `O item ${dev.line_item_id} não consta na nota de venda deste pedido. Não é possível devolvê-lo.`
      )
    }
    if (origem.n_item_verificado === null) {
      throw new ErroFiscal(
        `O item "${origem.medusa_line_item_id}" não tem o nItem confirmado pela SEFAZ. ` +
          "Rode a reconciliação antes de emitir a devolução."
      )
    }
    if (dev.quantidade < 1 || dev.quantidade > origem.quantidade) {
      throw new ErroFiscal(
        `Quantidade a devolver (${dev.quantidade}) é maior que a quantidade vendida (${origem.quantidade}).`
      )
    }

    // Soma com o que outras NFDs (resolvidas) já devolveram deste mesmo item — a checagem acima
    // sozinha não pega uma segunda devolução do mesmo item em duas remessas diferentes.
    const jaDevolvido = quantidadesJaDevolvidas.get(dev.line_item_id) ?? 0
    if (jaDevolvido + dev.quantidade > origem.quantidade) {
      throw new ErroFiscal(
        `Item ${dev.line_item_id}: já foram devolvidas ${jaDevolvido} de ${origem.quantidade} unidades vendidas em NFDs anteriores. ` +
          `Esta devolução pede mais ${dev.quantidade} unidade(s), o que passaria do total vendido — restam ${origem.quantidade - jaDevolvido} para devolver.`
      )
    }

    const doPedido = itensPedido.find((i) => i.line_item_id === dev.line_item_id)
    if (!doPedido) {
      throw new ErroFiscal(`Item ${dev.line_item_id} não encontrado no pedido.`)
    }
    ordenados.push(doPedido)

    const perfil = resolverPerfil(perfis, doPedido.product_id, doPedido.categoria_handle)

    // Rateio proporcional do desconto (Benefício Conjunto e afins): decisão de negócio ainda
    // pendente de confirmação do contador. A regra hoje é devolver o desconto na mesma proporção
    // da quantidade devolvida em relação à quantidade vendida naquela linha. Se o contador
    // preferir outra política (ex.: estornar sempre o desconto cheio, ou nunca estornar), é
    // esta fórmula — e só ela — que muda.
    const descontoAEstornar = Math.round(
      (origem.desconto_centavos * dev.quantidade) / origem.quantidade
    )

    const codigoEnviado = doPedido.sku ?? doPedido.line_item_id
    itensDocumento.push({
      medusa_line_item_id: dev.line_item_id,
      ordem_enviada: idx + 1,
      codigo_enviado: codigoEnviado,
      ncm: origem.ncm,
      quantidade: dev.quantidade,
      valor_unitario_centavos: origem.valor_unitario_centavos,
      desconto_centavos: descontoAEstornar,
    })

    const brutoCentavos = origem.valor_unitario_centavos * dev.quantidade
    itensResumo.push({
      codigo: codigoEnviado,
      descricao: doPedido.titulo,
      quantidade: dev.quantidade,
      bruto_centavos: brutoCentavos,
      desconto_centavos: descontoAEstornar,
      liquido_centavos: brutoCentavos - descontoAEstornar,
    })

    const produto: Record<string, unknown> = {
      NmProduto: doPedido.titulo,
      CodProdutoServico: codigoEnviado,
      NCM: origem.ncm,
      CFOP: cfopNumerico(
        interestadual ? perfil.cfop_devolucao_fora_uf : perfil.cfop_devolucao_dentro_uf,
        doPedido.titulo
      ),
      UnidadeComercial: "UN",
      UnidadeComercialTributavel: "UN",
      Quantidade: dev.quantidade,
      QuantidadeTributavel: dev.quantidade,
      ValorUnitario: numeroReais(origem.valor_unitario_centavos),
      ValorUnitarioTributavel: numeroReais(origem.valor_unitario_centavos),
      ValorTotal: numeroReais(origem.valor_unitario_centavos * dev.quantidade), // BRUTO
      ValorDesconto: numeroReais(descontoAEstornar),
      OrigemProduto: doPedido.origem ?? perfil.origem_padrao,
      Imposto: impostoDoPerfil(perfil, doPedido.titulo),
      // VC02-14 / VC03-20: referência item a item — chave + nItem DA NOTA DE VENDA.
      ChaveAcessoReferenciada: documentoOrigem.chave_acesso as string,
      NItemReferenciado: origem.n_item_verificado,
    }
    if (perfil.cest) produto.CEST = perfil.cest
    return produto
  })

  const payload: Record<string, unknown> = {
    ModeloDocumento: 55,
    Finalidade: 4, // devolução. O tipo (entrada) a API deriva do CFOP 1xxx/2xxx.
    TipoAmbiente: tipoAmbiente(config.ambiente),
    NaturezaOperacao: "DEVOLUCAO DE VENDA",
    ConsumidorFinal: false,
    IndicadorPresenca: 0,
    EnviarEmail: false,
    IdentificadorInterno: identificador,
    // Spec §11 risco 10 — decisão PROVISÓRIA, a confirmar em homologação: a contraparte da NFD é
    // a própria ÉCLAT, contribuinte com IE (o CCC registra "IE como destinatário: Obrigatória").
    // Se a homologação rejeitar (VC02-50), é ESTE bloco — e só ele — que muda.
    Cliente: {
      CpfCnpj: config.cnpj,
      NmCliente: config.razao_social,
      IndicadorIe: 1,
      Ie: config.ie,
      Endereco: {
        Cep: config.cep,
        Logradouro: config.logradouro,
        Numero: config.numero,
        Complemento: config.complemento,
        Bairro: config.bairro,
        CodMunicipio: config.municipio_ibge,
        Municipio: config.municipio,
        Uf: ufEmitente,
        CodPais: 1058,
        Pais: "BRASIL",
      },
    },
    Produtos: linhas,
    Pagamentos: [{ IndicadorPagamento: 0, FormaPagamento: "90", VlPago: 0 }],
    Transporte: { ModalidadeFrete: 9 },
  }

  const produtosCentavos = itensResumo.reduce((a, i) => a + i.bruto_centavos, 0)
  const descontoCentavos = itensResumo.reduce((a, i) => a + i.desconto_centavos, 0)
  const resumo: ResumoDevolucao = {
    itens: itensResumo,
    produtos_centavos: produtosCentavos,
    desconto_centavos: descontoCentavos,
    total_centavos: produtosCentavos - descontoCentavos,
  }

  return { payload, itens_ordenados: ordenados, itens_documento: itensDocumento, resumo }
}
