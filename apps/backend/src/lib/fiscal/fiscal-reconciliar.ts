// Lê o XML autorizado e grava o nItem REAL de cada item (spec §7.3).
//
// A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor.
// Contrato posicional implícito quebra em silêncio — então aqui a verdade vem do XML assinado
// pela SEFAZ. O casamento é feito pelo NCM de cada item (é o único campo que sobra tanto no
// documento gravado quanto no XML — o schema não guarda o código do produto por item): itens do
// mesmo pedido com o mesmo NCM são pareados na ordem em que aparecem dos dois lados. Não é
// perfeito quando há mais de um item com o mesmo NCM, mas é muito mais seguro que confiar
// cegamente na posição de envio, que é exatamente o contrato implícito que estamos evitando.
//
// Divergência entre ordem_enviada e nItem NÃO é fatal: grava-se o valor da SEFAZ (que é o que
// vale) e registra-se um alerta. Tratar como erro travaria a devolução por um motivo que não é
// erro nosso.

import { atualizarDocumento, atualizarNItem, lerDocumento, listarItens, listarPorStatus } from "./fiscal-db"
import { baixarXml } from "./fiscal-client"
import { extrairChaveDoXml, extrairItensDoXml, type ItemXml } from "./fiscal-xml"
import { ErroFiscal, type FiscalDocumentoItem } from "./tipos"

export async function reconciliarDocumento(
  documentoId: string
): Promise<{ verificado: boolean; divergencias: string[] }> {
  const doc = await lerDocumento(documentoId)
  if (!doc.chave_acesso) {
    throw new ErroFiscal(
      `Documento ${documentoId} não tem chave de acesso — não há XML para reconciliar.`
    )
  }

  const xml = await baixarXml(doc.chave_acesso)
  const itensXml = extrairItensDoXml(xml)
  const itensDoc = await listarItens(documentoId)

  if (itensXml.length !== itensDoc.length) {
    throw new ErroFiscal(
      `Divergência na quantidade de itens: o XML autorizado traz ${itensXml.length}, o documento tem ${itensDoc.length}. Não é seguro reconciliar.`
    )
  }

  // Confere que o XML baixado é mesmo o desta nota antes de gravar qualquer coisa. Um XML de
  // outro documento (chave trocada na resposta do fornecedor) gravaria n_item_verificado de
  // outra nota — corrupção silenciosa que só apareceria meses depois, na devolução, como
  // rejeição da SEFAZ.
  const chaveDoXml = extrairChaveDoXml(xml)
  if (chaveDoXml !== doc.chave_acesso) {
    throw new ErroFiscal(
      `A chave do XML autorizado (${chaveDoXml}) não bate com a chave de acesso do documento ${documentoId} (${doc.chave_acesso}). Não é seguro reconciliar — o XML pode ser de outro documento.`
    )
  }

  // Agrupa o XML por NCM, preservando a ordem crescente de nItem dentro de cada grupo.
  const xmlPorNcm = new Map<string, ItemXml[]>()
  for (const it of itensXml) {
    const grupo = xmlPorNcm.get(it.ncm) ?? []
    grupo.push(it)
    xmlPorNcm.set(it.ncm, grupo)
  }

  // Casa cada item do documento (na ordem_enviada crescente, vinda do listarItens) com o
  // próximo item do XML do mesmo NCM ainda não usado.
  const cursorPorNcm = new Map<string, number>()
  const pares: Array<{ item: FiscalDocumentoItem; nItem: number }> = []

  for (const item of itensDoc) {
    const candidatos = xmlPorNcm.get(item.ncm) ?? []
    const cursor = cursorPorNcm.get(item.ncm) ?? 0
    const casado = candidatos[cursor]

    if (!casado) {
      throw new ErroFiscal(
        `Item ${item.medusa_line_item_id} (NCM ${item.ncm}, ordem ${item.ordem_enviada}) não foi encontrado no XML autorizado.`
      )
    }

    cursorPorNcm.set(item.ncm, cursor + 1)
    pares.push({ item, nItem: casado.n_item })
  }

  const divergencias: string[] = []
  for (const { item, nItem } of pares) {
    if (nItem !== item.ordem_enviada) {
      divergencias.push(
        `Item ${item.medusa_line_item_id}: enviado na posição ${item.ordem_enviada}, autorizado como nItem ${nItem}. Vale o da SEFAZ.`
      )
    }
  }

  for (const { item, nItem } of pares) {
    await atualizarNItem(item.id, nItem)
  }

  await atualizarDocumento(documentoId, {
    status: "verificado",
    verificado_em: new Date().toISOString(),
  })

  return { verificado: true, divergencias }
}

// Varredura de segurança (spec §7.3): o webhook pode se perder; obrigação fiscal não pode
// depender de entrega de rede.
export async function reconciliarPendentes(
  limite = 50
): Promise<{ processados: number; verificados: number }> {
  const pendentes = await listarPorStatus(
    ["autorizado_nao_verificado", "transmitido_sem_confirmacao"],
    limite
  )
  let verificados = 0
  for (const doc of pendentes) {
    if (!doc.chave_acesso) continue
    try {
      const r = await reconciliarDocumento(doc.id)
      if (r.verificado) verificados++
    } catch {
      // Falha de um documento não pode parar a varredura dos outros.
      // O documento permanece pendente e reaparece na próxima passada.
    }
  }
  return { processados: pendentes.length, verificados }
}
