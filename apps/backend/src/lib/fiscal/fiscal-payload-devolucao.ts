// Monta o payload da NF-e de devolução — entrada própria, finalidade 4 (spec §8).
//
// Desde 01/09/2026 (NT 2025.002-RTC v1.40) a devolução referencia a nota de origem ITEM A ITEM,
// no grupo DFeReferenciado, com chave de acesso + nItem. Regras atendidas aqui:
//   VC02-14  referência exclusivamente item a item (refNFe genérico é proibido)
//   VC03-20  nItem obrigatório em cada referência
//   VC02-40  emitente das notas referenciadas igual em todos os itens (só referenciamos 1 nota)
//   VC02-50  destinatário da NF-e igual ao emitente da nota referenciada (a ÉCLAT devolve para si)
//
// A consumidora é pessoa física e não emite nota: quem emite a devolução é a loja, como entrada.
// O CCC/SVRS informa "IE como destinatário: Obrigatória" — por isso a IE vai no destinatário também.

import { resolverPerfil } from "./fiscal-perfil"
import {
  ErroFiscal,
  type FiscalConfig,
  type FiscalDocumento,
  type FiscalDocumentoItem,
  type FiscalPerfil,
  type ItemPedido,
} from "./tipos"

function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function montarPayloadDevolucao(args: {
  config: FiscalConfig
  perfis: FiscalPerfil[]
  documentoOrigem: FiscalDocumento
  itensOrigem: FiscalDocumentoItem[]
  devolvidos: Array<{ line_item_id: string; quantidade: number }>
  itensPedido: ItemPedido[]
  ufDestinatarioOriginal: string
}): {
  payload: Record<string, unknown>
  itens_ordenados: ItemPedido[]
  itens_documento: Array<Omit<FiscalDocumentoItem, "id" | "fiscal_documento_id" | "n_item_verificado">>
} {
  const {
    config, perfis, documentoOrigem, itensOrigem, devolvidos, itensPedido, ufDestinatarioOriginal,
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
  let totalProdutosCentavos = 0
  let totalDescontoCentavos = 0

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
    const totalItemCentavos = origem.valor_unitario_centavos * dev.quantidade - descontoAEstornar
    totalProdutosCentavos += origem.valor_unitario_centavos * dev.quantidade
    totalDescontoCentavos += descontoAEstornar

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

    return {
      numero_item: idx + 1,
      codigo: codigoEnviado,
      descricao: doPedido.titulo,
      ncm: origem.ncm,
      cfop: interestadual ? perfil.cfop_devolucao_fora_uf : perfil.cfop_devolucao_dentro_uf,
      csosn: perfil.csosn,
      origem: doPedido.origem ?? perfil.origem_padrao,
      unidade: "UN",
      quantidade: dev.quantidade,
      valor_unitario: reais(origem.valor_unitario_centavos),
      valor_desconto: reais(descontoAEstornar),
      valor_total: reais(totalItemCentavos),
      // VC02-14 / VC03-20: referência item a item, chave + nItem da nota de origem.
      documentos_referenciados: [
        { chave_acesso: documentoOrigem.chave_acesso as string, numero_item: origem.n_item_verificado },
      ],
    }
  })

  const enderecoEclat = {
    logradouro: config.logradouro,
    numero: config.numero,
    complemento: config.complemento,
    bairro: config.bairro,
    municipio: config.municipio,
    municipio_ibge: config.municipio_ibge,
    uf: config.uf,
    cep: config.cep,
  }

  const payload: Record<string, unknown> = {
    modelo: 55,
    serie: config.serie_nfe,
    ambiente: config.ambiente,
    finalidade: 4, // 4 = devolução
    tipo_nf: 0, // 0 = entrada
    ind_final: 0,
    ind_presenca: 0,
    natureza_operacao: "DEVOLUCAO DE VENDA",
    emitente: {
      cnpj: config.cnpj,
      razao_social: config.razao_social,
      nome_fantasia: config.nome_fantasia,
      ie: config.ie,
      crt: config.crt,
      ...enderecoEclat,
    },
    // VC02-50: o destinatário da devolução é o emitente da nota referenciada — a própria ÉCLAT.
    destinatario: {
      cnpj: config.cnpj,
      nome: config.razao_social,
      ie: config.ie, // CCC: "IE como destinatário: Obrigatória"
      ...enderecoEclat,
    },
    itens: linhas,
    total: {
      valor_produtos: reais(totalProdutosCentavos),
      valor_desconto: reais(totalDescontoCentavos),
      valor_frete: "0.00",
      valor_nota: reais(totalProdutosCentavos - totalDescontoCentavos),
    },
  }

  return { payload, itens_ordenados: ordenados, itens_documento: itensDocumento }
}
