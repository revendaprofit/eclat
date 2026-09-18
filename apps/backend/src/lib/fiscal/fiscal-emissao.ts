// Orquestra a emissão da NF-e de venda (spec §7.2).
//
// Ordem inegociável: grava o documento e os itens ANTES de transmitir. Se a rede cair no meio,
// a linha já existe com a chave de idempotência, e a varredura localiza a nota no fornecedor pelo
// IdentificadorInterno (a própria chave de idempotência) em vez de reemitir. Nota fiscal duplicada
// é obrigação fiscal em duplicidade — exige cancelamento formal em 24h e, passado o prazo, vira
// apuração errada.

import { createHash } from "node:crypto"
import {
  atualizarDocumento, criarDocumento, criarItens, documentosDoPedido, getConfig, lerDocumento, listPerfis,
} from "./fiscal-db"
import { transmitir } from "./fiscal-client"
import type { PagamentoNF } from "./fiscal-pagamento"
import { montarPayloadVenda, type DestinatarioNF } from "./fiscal-payload"
import { localizarNoFornecedor, reconciliarDocumento } from "./fiscal-reconciliar"
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

const ALERTA_AMBIENTE =
  "ALERTA: a nota foi autorizada num ambiente diferente do configurado em Fiscal → Configuração. " +
  "Confira o ambiente da empresa no painel da Brasil NFe antes de emitir qualquer outra nota."

// Adota uma nota que o fornecedor já tem para este documento: grava a chave (localizarNoFornecedor)
// e tenta reconciliar. Falha de reconciliação não impede a adoção — a nota existe de qualquer jeito.
async function adotarSeExistir(
  doc: FiscalDocumento,
  avisar?: (mensagem: string) => void
): Promise<FiscalDocumento | null> {
  const achado = await localizarNoFornecedor(doc)
  if (!achado) return null
  try {
    await reconciliarDocumento(achado.id)
  } catch (e) {
    avisar?.(`[fiscal] nota ${achado.id} adotada do fornecedor, mas a reconciliação falhou: ${(e as Error).message}`)
  }
  return lerDocumento(achado.id)
}

// Decide se há o que emitir (spec §7.2 item 8). Com numeração automática do fornecedor, a SEFAZ
// NÃO barra duplicata — cada tentativa ganha número novo. A barreira é só nossa.
//
// Se a consulta ao fornecedor falhar, o erro PROPAGA: sem poder verificar, não se emite.
export async function prepararTentativa(args: {
  orderId: string
  tipo: "venda" | "devolucao"
  ambiente: Ambiente
  baseKey: string
  avisar?: (mensagem: string) => void
}): Promise<{ existente: FiscalDocumento } | { key: string }> {
  const { orderId, tipo, ambiente, baseKey, avisar } = args
  const todos = await documentosDoPedido(orderId, tipo, ambiente)
  // Só as tentativas DESTA chave. Na devolução a chave carrega o digest do conjunto devolvido —
  // outra remessa do mesmo pedido é outro documento, não uma tentativa anterior deste.
  const docs = todos.filter(
    (d) => d.idempotency_key === baseKey || d.idempotency_key.startsWith(`${baseKey}:r`)
  )

  const jaResolvido = docs.find((d) => JA_RESOLVIDO.has(d.status))
  if (jaResolvido) return { existente: jaResolvido }

  const pendente = docs.find((d) => d.status === "transmitido_sem_confirmacao")
  if (pendente) {
    const adotado = await adotarSeExistir(pendente, avisar)
    if (adotado) return { existente: adotado }
    throw new ErroFiscal(
      "Já existe uma transmissão sem confirmação para este pedido, e a Brasil NFe ainda não a localiza. " +
        "Resolva em Fiscal → Fila (reconciliar ou resolver) antes de tentar de novo — reemitir criaria nota duplicada."
    )
  }

  // Tentativas que NÓS demos como não emitidas. Antes de emitir outra, confirma com o fornecedor.
  const anteriores = docs.filter((d) => d.status === "rejeitado" || d.status === "montado")
  for (const anterior of anteriores) {
    const adotado = await adotarSeExistir(anterior, avisar)
    if (adotado) return { existente: adotado }
  }

  // Sufixo de tentativa: sem ele a nova linha colide no índice único idempotency_key_key (C3).
  return { key: anteriores.length === 0 ? baseKey : `${baseKey}:r${anteriores.length}` }
}

// Marca pendente → transmite → grava o resultado → reconcilia na hora. Compartilhada por venda e
// devolução: a interpretação da resposta não pode existir em duas cópias.
export async function transmitirEGravar(args: {
  doc: FiscalDocumento
  payload: Record<string, unknown>
  rotulo: string
  avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento> {
  const { doc, payload, rotulo, avisar } = args
  await atualizarDocumento(doc.id, { status: "transmitido_sem_confirmacao" })

  let r
  try {
    r = await transmitir(payload)
  } catch (e) {
    // Fica em transmitido_sem_confirmacao de propósito: a varredura localiza pelo
    // IdentificadorInterno. A CLASSE do erro é preservada (ErroFiscal → 422, Error → 500):
    // queda do fornecedor não é erro do operador (achado I2/5.1).
    const erro = e as Error
    const mensagem = `Falha ao transmitir a ${rotulo}. O documento ficou pendente de reconciliação. Detalhe: ${erro.message}`
    throw erro instanceof ErroFiscal ? new ErroFiscal(mensagem) : new Error(mensagem)
  }

  if (r.desfecho === "indefinido") {
    await atualizarDocumento(doc.id, { resposta_bruta: r.bruto })
    throw new Error(
      `A Brasil NFe devolveu uma resposta que não permite concluir se a ${rotulo} foi autorizada. ` +
        "O documento ficou pendente de reconciliação — não reemita."
    )
  }

  if (r.desfecho !== "autorizado") {
    return atualizarDocumento(doc.id, {
      status: r.desfecho,
      chave_acesso: r.chave_acesso,
      numero: r.numero,
      serie: r.serie,
      rejeicao_codigo: r.codigo_sefaz,
      rejeicao_motivo: r.motivo,
      resposta_bruta: r.bruto,
    })
  }

  await atualizarDocumento(doc.id, {
    status: "autorizado_nao_verificado",
    chave_acesso: r.chave_acesso,
    numero: r.numero,
    serie: r.serie,
    xml_autorizado: r.xml,
    rejeicao_codigo: null,
    rejeicao_motivo: r.ambiente_divergente ? ALERTA_AMBIENTE : null,
    resposta_bruta: r.bruto,
  })
  if (r.ambiente_divergente) avisar?.(`[fiscal] ${rotulo}: ${ALERTA_AMBIENTE}`)

  // Reconciliação NA HORA, com o XML que veio na resposta (spec §7.3). Falhar aqui não desfaz a
  // emissão: a nota está autorizada. O documento fica autorizado_nao_verificado e a varredura tenta.
  try {
    if (!r.xml) throw new Error("a resposta não trouxe o XML autorizado (Base64Xml vazio)")
    await reconciliarDocumento(doc.id, r.xml)
  } catch (e) {
    avisar?.(`[fiscal] ${rotulo} autorizada, mas a reconciliação na hora falhou: ${(e as Error).message}`)
  }
  return lerDocumento(doc.id)
}

// Não checa emissao_ativa aqui (achado N1 da re-revisão): quem decide isso é o ÚNICO chamador
// hoje, admin/fiscal/emitir/route.ts — e precisa decidir ANTES de montar os itens do pedido
// (montarItensDoPedido lança ErroFiscal por falta de CPF/IBGE, o que é todo pedido real agora),
// não depois. Checar aqui de novo seria uma segunda fonte de verdade fadada a desalinhar da
// primeira. Se um novo chamador aparecer, ele precisa repetir a checagem de emissao_ativa ANTES
// de chamar emitirVenda — não delegar para cá.
export async function emitirVenda(args: {
  orderId: string
  itens: ItemPedido[]
  destinatario: DestinatarioNF
  frete_centavos: number
  pagamento: PagamentoNF
  avisar?: (mensagem: string) => void
}): Promise<FiscalDocumento> {
  const config = await getConfig()

  const tentativa = await prepararTentativa({
    orderId: args.orderId,
    tipo: "venda",
    ambiente: config.ambiente,
    baseKey: chaveIdempotencia(args.orderId, "venda", config.ambiente),
    avisar: args.avisar,
  })
  if ("existente" in tentativa) return tentativa.existente
  const key = tentativa.key

  const perfis = await listPerfis()
  const { payload, itens_ordenados } = montarPayloadVenda({
    config,
    perfis,
    itens: args.itens,
    destinatario: args.destinatario,
    frete_centavos: args.frete_centavos,
    pagamento: args.pagamento,
    // A chave de idempotência viaja no payload: é por ela que o fornecedor é consultado depois.
    identificador: key,
  })

  // 1) grava ANTES de transmitir
  const doc = await criarDocumento({
    medusa_order_id: args.orderId,
    tipo: "venda",
    modelo: 55,
    serie: null, // a numeração é do fornecedor; série e número reais voltam na resposta
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

  // O codigo_enviado grava o MESMO valor que foi para o payload, nunca recalculado aqui: a regra
  // "sku ?? line_item_id" mora só em montarPayloadVenda. É por ele que o XML é casado (§7.3).
  const produtos = payload.Produtos as Array<{ CodProdutoServico: string }>
  await criarItens(
    itens_ordenados.map((it, idx) => ({
      fiscal_documento_id: doc.id,
      medusa_line_item_id: it.line_item_id,
      ordem_enviada: idx + 1,
      n_item_verificado: null,
      codigo_enviado: produtos[idx].CodProdutoServico,
      ncm: it.ncm as string,
      quantidade: it.quantidade,
      valor_unitario_centavos: it.valor_unitario_centavos,
      desconto_centavos: it.desconto_centavos,
    }))
  )

  // 2) transmite, grava o resultado e reconcilia
  return transmitirEGravar({
    doc, payload, rotulo: `NF-e do pedido ${args.orderId}`, avisar: args.avisar,
  })
}
