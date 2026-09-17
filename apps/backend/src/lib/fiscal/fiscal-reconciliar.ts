// Lê o XML autorizado e grava o nItem REAL de cada item (spec §7.3).
//
// A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor.
// Contrato posicional implícito quebra em silêncio — então aqui a verdade vem do XML assinado
// pela SEFAZ. O casamento é feito pelo `codigo_enviado` (o mesmo `codigo`/SKU que foi no payload,
// gravado em fiscal-emissao.ts), que é a chave única por linha do documento — NÃO por NCM nem por
// posição. Dois itens do mesmo pedido podem ter o mesmo NCM (rotineiro em moda: dois tops
// diferentes, mesmo NCM) com SKUs diferentes; casar por NCM+posição reintroduz exatamente a
// suposição posicional implícita que este arquivo existe para evitar — e o pior: quando o XML
// vem com os produtos trocados de posição mas os nItem alinhados com a ordem do documento,
// aquele casamento não sinaliza divergência nenhuma, e o n_item_verificado de cada item fica
// trocado em silêncio (achado crítico da revisão de 2026-09-16).
//
// O NCM entra só como conferência SECUNDÁRIA e não fatal, depois que o par já foi decidido pelo
// código: se o NCM do XML não bate com o do documento, é sinal de que o cadastro do produto mudou
// entre a emissão e a reconciliação — vira alerta, não trava a devolução.
//
// Divergência entre ordem_enviada e nItem NÃO é fatal: grava-se o valor da SEFAZ (que é o que
// vale) e registra-se um alerta. Tratar como erro travaria a devolução por um motivo que não é
// erro nosso.
//
// Já a falta de par por código, ou dois itens do documento com o mesmo codigo_enviado, SÃO
// fatais: não se adivinha casamento. Falha visível na fila de reconciliação é infinitamente
// melhor que gravar n_item_verificado trocado em silêncio.

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

  // codigo_enviado precisa ser único por documento: sem isso não há casamento seguro por código.
  const codigosVistos = new Set<string>()
  for (const item of itensDoc) {
    if (codigosVistos.has(item.codigo_enviado)) {
      throw new ErroFiscal(
        `Mais de um item do documento ${documentoId} foi enviado com o código "${item.codigo_enviado}". Não é possível casar com segurança pelo código — corrija o cadastro antes de reconciliar.`
      )
    }
    codigosVistos.add(item.codigo_enviado)
  }

  const xmlPorCodigo = new Map<string, ItemXml>()
  for (const it of itensXml) {
    xmlPorCodigo.set(it.codigo, it)
  }

  const pares: Array<{ item: FiscalDocumentoItem; xml: ItemXml }> = []
  for (const item of itensDoc) {
    const casado = xmlPorCodigo.get(item.codigo_enviado)
    if (!casado) {
      throw new ErroFiscal(
        `Item ${item.medusa_line_item_id} (código "${item.codigo_enviado}") não foi encontrado no XML autorizado. Não é seguro reconciliar.`
      )
    }
    pares.push({ item, xml: casado })
  }

  const divergencias: string[] = []
  for (const { item, xml: casado } of pares) {
    if (casado.n_item !== item.ordem_enviada) {
      divergencias.push(
        `Item ${item.medusa_line_item_id}: enviado na posição ${item.ordem_enviada}, autorizado como nItem ${casado.n_item}. Vale o da SEFAZ.`
      )
    }
    // Conferência secundária, não fatal: o par já foi decidido pelo código; o NCM aqui só avisa
    // sobre possível mudança de cadastro entre a emissão e a reconciliação.
    if (casado.ncm !== item.ncm) {
      divergencias.push(
        `Item ${item.medusa_line_item_id}: NCM enviado ${item.ncm}, NCM no XML autorizado ${casado.ncm}. Confira o cadastro do produto.`
      )
    }
  }

  for (const { item, xml: casado } of pares) {
    await atualizarNItem(item.id, casado.n_item)
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
