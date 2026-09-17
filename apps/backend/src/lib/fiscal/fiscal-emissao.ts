// Orquestra a emissão da NF-e de venda (spec §7.2).
//
// Ordem inegociável: grava o documento e os itens ANTES de transmitir. Se a rede cair no meio,
// a linha já existe com a chave de idempotência, e a reconciliação consulta pela chave em vez de
// reemitir. Nota fiscal duplicada é obrigação fiscal em duplicidade — exige cancelamento formal
// em 24h e, passado o prazo, vira apuração errada.

import { createHash } from "node:crypto"
import {
  atualizarDocumento, criarDocumento, criarItens, documentosDoPedido, getConfig, listPerfis,
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

// Resumo determinístico do CONJUNTO devolvido (achado crítico da revisão de 2026-09-17): uma
// chave de idempotência só por pedido faz a segunda remessa de devolução colidir com a primeira
// e devolver, em silêncio, o documento da remessa errada com HTTP 200 — sem transmitir nada da
// segunda. O digest entra na chave de emitir-devolucao/route.ts junto com chaveIdempotencia, para
// que a MESMA devolução repetida continue idempotente, e uma devolução DIFERENTE gere chave nova.
// Puro e determinístico: mesmos pares (line_item_id, quantidade), em qualquer ordem de entrada,
// produzem o mesmo digest — por isso ordena por line_item_id antes de serializar.
export function digestDevolvidos(
  itens: Array<{ line_item_id: string; quantidade: number }>
): string {
  const normalizado = itens
    .map((it) => ({ line_item_id: it.line_item_id, quantidade: it.quantidade }))
    .sort((a, b) => (a.line_item_id < b.line_item_id ? -1 : a.line_item_id > b.line_item_id ? 1 : 0))
  return createHash("sha256").update(JSON.stringify(normalizado)).digest("hex").slice(0, 16)
}

// Um documento já resolvido não deve ser reemitido nunca. Exportado porque a mesma regra vale
// para a devolução (emitir-devolucao/route.ts) — duplicar o Set em dois lugares arriscaria os
// dois se desalinharem no futuro.
export const JA_RESOLVIDO = new Set(["autorizado_nao_verificado", "verificado", "denegado"])

// null = interruptor mestre desligado (spec §6.1, Bloco 1 / achados C1+C2): "desligado, o sistema
// registra mas não transmite" — nesta implementação, desligado significa nem sequer tenta, sem
// tocar no banco e sem lançar. Quem chama (admin/fiscal/emitir/route.ts) responde 200 com um corpo
// explícito, e o Cockpit despacha sem nota, com aviso. Isso é modo seguro, não erro: o padrão de
// fábrica é emissao_ativa=false, e antes deste fix isso derrubava todo despacho com 422.
export async function emitirVenda(args: {
  orderId: string
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
}): Promise<FiscalDocumento | null> {
  const config = await getConfig()

  // Checagem ANTES de montar payload ou tocar no banco — é o interruptor mestre, não uma trava de
  // negócio para lançar como ErroFiscal.
  if (!config.emissao_ativa) {
    return null
  }

  // Busca por pedido+tipo+ambiente, não só pela chave de idempotência "canônica" (achado crítico
  // C3): um documento `rejeitado` (ou `montado` órfão) não é beco sem saída permanente — só
  // `autorizado_nao_verificado`/`verificado`/`denegado` (JA_RESOLVIDO) barram reemissão de verdade,
  // e `transmitido_sem_confirmacao` continua exigindo resolução manual antes de tentar de novo.
  const documentos = await documentosDoPedido(args.orderId, "venda", config.ambiente)

  const jaResolvido = documentos.find((d) => JA_RESOLVIDO.has(d.status))
  if (jaResolvido) {
    return jaResolvido
  }

  const pendente = documentos.find((d) => d.status === "transmitido_sem_confirmacao")
  if (pendente) {
    throw new ErroFiscal(
      "Já existe uma transmissão sem confirmação para este pedido. Rode a reconciliação antes de tentar de novo — reemitir criaria nota duplicada."
    )
  }

  // A chave ganha um sufixo de tentativa quando já existem documentos NÃO reaproveitáveis
  // (rejeitado ou montado órfão) para este pedido/tipo/ambiente — senão a nova tentativa colide
  // com o índice único da tentativa anterior (ERROR: duplicate key ... idempotency_key_key).
  const tentativasAnteriores = documentos.filter(
    (d) => d.status === "rejeitado" || d.status === "montado"
  ).length
  const baseKey = chaveIdempotencia(args.orderId, "venda", config.ambiente)
  const key = tentativasAnteriores === 0 ? baseKey : `${baseKey}:r${tentativasAnteriores}`

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
    //
    // A CLASSE do erro decide 422 vs 500 lá na rota (achado I2/5.1): se o fornecedor recusou
    // (ErroFiscal, ex.: 4xx) continua ErroFiscal; se foi queda de infra (Error comum: 5xx, timeout,
    // falha de rede) continua Error comum. Embrulhar tudo em ErroFiscal mascarava uma queda da
    // Brasil NFe como erro do operador, e nenhum alerta de 5xx disparava.
    const erro = e as Error
    const mensagem = `Falha ao transmitir a NF-e do pedido ${args.orderId}. O documento ficou pendente de reconciliação. Detalhe: ${erro.message}`
    throw erro instanceof ErroFiscal ? new ErroFiscal(mensagem) : new Error(mensagem)
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
