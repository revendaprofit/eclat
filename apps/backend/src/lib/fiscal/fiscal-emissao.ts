// Orquestra a emissão da NF-e de venda (spec §7.2).
//
// Ordem inegociável: grava o documento e os itens ANTES de transmitir. Se a rede cair no meio,
// a linha já existe com a chave de idempotência, e a reconciliação consulta pela chave em vez de
// reemitir. Nota fiscal duplicada é obrigação fiscal em duplicidade — exige cancelamento formal
// em 24h e, passado o prazo, vira apuração errada.

import {
  acharPorIdempotencia, atualizarDocumento, criarDocumento, criarItens, getConfig, listPerfis,
} from "./fiscal-db"
import { transmitir } from "./fiscal-client"
import { montarPayloadVenda, type DestinatarioNF } from "./fiscal-payload"
import { ErroFiscal, type Ambiente, type FiscalDocumento, type ItemPedido } from "./tipos"

export function chaveIdempotencia(
  orderId: string,
  tipo: "venda" | "devolucao",
  ambiente: Ambiente
): string {
  return `${orderId}:${tipo}:${ambiente}`
}

// Um documento já resolvido não deve ser reemitido nunca.
const JA_RESOLVIDO = new Set(["autorizado_nao_verificado", "verificado", "denegado"])

export async function emitirVenda(args: {
  orderId: string
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
}): Promise<FiscalDocumento> {
  const config = await getConfig()
  const key = chaveIdempotencia(args.orderId, "venda", config.ambiente)

  const existente = await acharPorIdempotencia(key)
  if (existente && JA_RESOLVIDO.has(existente.status)) {
    return existente
  }
  if (existente && existente.status === "transmitido_sem_confirmacao") {
    throw new ErroFiscal(
      "Já existe uma transmissão sem confirmação para este pedido. Rode a reconciliação antes de tentar de novo — reemitir criaria nota duplicada."
    )
  }

  if (!config.emissao_ativa) {
    throw new ErroFiscal(
      "A emissão está desligada em Fiscal → Configuração (emissao_ativa). Ligue-a para transmitir notas."
    )
  }

  const perfis = await listPerfis()
  const { payload, itens_ordenados } = montarPayloadVenda({
    config,
    perfis,
    itens: args.itens,
    destinatario: args.destinatario,
    frete_centavos: args.frete_centavos,
  })

  // 1) grava ANTES de transmitir
  const doc = await criarDocumento({
    medusa_order_id: args.orderId,
    tipo: "venda",
    modelo: 55,
    serie: config.serie_nfe,
    numero: null,
    chave_acesso: null,
    status: "montado",
    ambiente: config.ambiente,
    idempotency_key: key,
    payload_enviado: payload,
    resposta_bruta: null,
    rejeicao_codigo: null,
    rejeicao_motivo: null,
    xml_url: null,
    danfe_url: null,
    documento_origem_id: null,
  })

  // O codigo_enviado grava o MESMO valor que foi para o payload (payload.itens[idx].codigo),
  // nunca recalculado aqui. A regra "sku ?? line_item_id" mora só em montarPayloadVenda — se
  // recalculássemos aqui e alguém mudasse a regra em um lugar só, o casamento por código na
  // reconciliação (spec §7.3) quebraria em silêncio.
  const payloadItens = payload.itens as Array<{ codigo: string }>
  await criarItens(
    itens_ordenados.map((it, idx) => ({
      fiscal_documento_id: doc.id,
      medusa_line_item_id: it.line_item_id,
      ordem_enviada: idx + 1,
      n_item_verificado: null,
      codigo_enviado: payloadItens[idx].codigo,
      ncm: it.ncm as string,
      quantidade: it.quantidade,
      valor_unitario_centavos: it.valor_unitario_centavos,
      desconto_centavos: it.desconto_centavos,
    }))
  )

  // 2) transmite
  await atualizarDocumento(doc.id, { status: "transmitido_sem_confirmacao" })

  let r
  try {
    r = await transmitir(payload)
  } catch (e) {
    // Fica em transmitido_sem_confirmacao de propósito: a reconciliação decide,
    // consultando pela chave. Nunca reemitir às cegas.
    throw new ErroFiscal(
      `Falha ao transmitir a NF-e do pedido ${args.orderId}. O documento ficou pendente de reconciliação. Detalhe: ${(e as Error).message}`
    )
  }

  // 3) grava o resultado
  return atualizarDocumento(doc.id, {
    status: r.autorizado ? "autorizado_nao_verificado" : "rejeitado",
    chave_acesso: r.chave_acesso,
    numero: r.numero,
    serie: r.serie ?? config.serie_nfe,
    rejeicao_codigo: r.autorizado ? null : r.status_sefaz,
    rejeicao_motivo: r.autorizado ? null : r.motivo,
    xml_url: r.xml_url,
    danfe_url: r.danfe_url,
    resposta_bruta: r.bruto,
  })
}
