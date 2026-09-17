import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chaveIdempotencia, digestDevolvidos, JA_RESOLVIDO } from "../../../../lib/fiscal/fiscal-emissao"
import { montarItensDoPedido } from "../../../../lib/fiscal/fiscal-pedido"
import { montarPayloadDevolucao } from "../../../../lib/fiscal/fiscal-payload-devolucao"
import { previsualizar, transmitir } from "../../../../lib/fiscal/fiscal-client"
import {
  acharPorIdempotencia, atualizarDocumento, criarDocumento, criarItens,
  documentoDeVendaDoPedido, getConfig, listPerfis, listarDevolucoesDoDocumento, listarItens,
} from "../../../../lib/fiscal/fiscal-db"
import { ErroFiscal } from "../../../../lib/fiscal/tipos"

type ItemDevolvido = { line_item_id: string; quantidade: number }

// POST /admin/fiscal/emitir-devolucao { order_id, itens: [{ line_item_id, quantidade }], previa? }
//
// Capacidade de NFD manual (spec §3 e §8) — o botão "Emitir NFD" do Cockpit chama esta rota.
// A emissão automática (Projeto B) não existe ainda; aqui é sempre o operador que decide.
//
// A chave de idempotência é {order_id}:devolucao:{ambiente}:{digest do conjunto devolvido}
// (achado crítico da revisão de 2026-09-17: uma chave só por pedido fazia a segunda remessa de
// devolução colidir com a primeira e devolver, em silêncio, o documento ERRADO com HTTP 200 —
// sem transmitir nada da segunda). Com o digest, a MESMA devolução repetida continua idempotente
// (mesmo conjunto → mesma chave → devolve o documento existente); uma devolução DIFERENTE do
// mesmo pedido gera chave nova e emite de verdade. A trava complementar de quantidade (abaixo)
// impede devolver o mesmo item duas vezes só porque o conjunto mudou.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const { order_id, itens, previa } = (req.body || {}) as {
    order_id?: string
    itens?: ItemDevolvido[]
    previa?: boolean
  }

  if (!order_id) {
    return res.status(400).json({ error: "order_id é obrigatório." })
  }
  if (!Array.isArray(itens) || itens.length === 0) {
    return res.status(400).json({ error: "itens é obrigatório e precisa ter ao menos um item." })
  }
  for (const it of itens) {
    if (!it || typeof it.line_item_id !== "string" || typeof it.quantidade !== "number") {
      return res.status(400).json({
        error: "cada item precisa de line_item_id (string) e quantidade (number).",
      })
    }
  }

  try {
    const doc = await documentoDeVendaDoPedido(order_id)
    if (!doc) {
      throw new ErroFiscal(`O pedido ${order_id} não tem NF-e de venda emitida.`)
    }

    // A trava de "documento não verificado" já é responsabilidade de montarPayloadDevolucao —
    // não duplicamos a regra aqui, só deixamos a função lançar o ErroFiscal dela.
    const [itensOrigem, dadosPedido, config, perfis, devolucoesAnteriores] = await Promise.all([
      listarItens(doc.id),
      montarItensDoPedido(req.scope, order_id),
      getConfig(),
      listPerfis(),
      listarDevolucoesDoDocumento(doc.id),
    ])

    // Soma, por item, o que já foi devolvido em NFDs anteriores RESOLVIDAS deste mesmo pedido —
    // só essas contam: uma "transmitido_sem_confirmacao" ainda não se sabe se virou nota de
    // verdade, e uma "rejeitado" não devolveu nada de fato.
    const quantidadesJaDevolvidas = new Map<string, number>()
    for (const devolucao of devolucoesAnteriores) {
      if (!JA_RESOLVIDO.has(devolucao.status)) continue
      const itensDaDevolucao = await listarItens(devolucao.id)
      for (const it of itensDaDevolucao) {
        quantidadesJaDevolvidas.set(
          it.medusa_line_item_id,
          (quantidadesJaDevolvidas.get(it.medusa_line_item_id) ?? 0) + it.quantidade
        )
      }
    }

    const { payload, itens_documento } = montarPayloadDevolucao({
      config,
      perfis,
      documentoOrigem: doc,
      itensOrigem,
      devolvidos: itens,
      itensPedido: dadosPedido.itens,
      // A UF do destinatário ORIGINAL (a mesma da venda) — não a UF atual do cadastro.
      ufDestinatarioOriginal: dadosPedido.destinatario.uf,
      quantidadesJaDevolvidas,
    })

    if (previa) {
      return res.json({ previa: await previsualizar(payload), payload })
    }

    if (!config.emissao_ativa) {
      throw new ErroFiscal(
        "A emissão está desligada em Fiscal → Configuração (emissao_ativa). Ligue-a para transmitir notas."
      )
    }

    // Idempotência: uma chave por pedido+tipo+ambiente+conjunto devolvido. Documento já
    // resolvido para o MESMO conjunto não é reemitido; um conjunto diferente gera chave nova.
    const key = `${chaveIdempotencia(order_id, "devolucao", config.ambiente)}:${digestDevolvidos(itens)}`
    const existente = await acharPorIdempotencia(key)
    if (existente && JA_RESOLVIDO.has(existente.status)) {
      return res.json({ documento: existente })
    }
    if (existente && existente.status === "transmitido_sem_confirmacao") {
      throw new ErroFiscal(
        "Já existe uma transmissão sem confirmação para a devolução deste pedido. Resolva-a " +
          "(reconciliação ou /admin/fiscal/resolver) antes de tentar de novo — reemitir criaria nota duplicada."
      )
    }

    // 1) grava documento + itens ANTES de transmitir — mesma ordem inegociável de emitirVenda.
    const docDevolucao = await criarDocumento({
      medusa_order_id: order_id,
      tipo: "devolucao",
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
      documento_origem_id: doc.id,
    })

    await criarItens(
      itens_documento.map((it) => ({
        ...it,
        fiscal_documento_id: docDevolucao.id,
        n_item_verificado: null,
      }))
    )

    // 2) transmite
    await atualizarDocumento(docDevolucao.id, { status: "transmitido_sem_confirmacao" })

    let r
    try {
      r = await transmitir(payload)
    } catch (e) {
      // Fica em transmitido_sem_confirmacao de propósito — mesma razão de emitirVenda: a
      // resolução (reconciliação ou /admin/fiscal/resolver) decide, nunca reemitir às cegas.
      throw new ErroFiscal(
        `Falha ao transmitir a NFD do pedido ${order_id}. O documento ficou pendente de resolução. Detalhe: ${(e as Error).message}`
      )
    }

    // 3) grava o resultado
    const atualizado = await atualizarDocumento(docDevolucao.id, {
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

    return res.json({ documento: atualizado })
  } catch (e) {
    const erro = e as Error
    logger.warn(`[fiscal] emitir-devolucao ${order_id}: ${erro.message}`)
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
