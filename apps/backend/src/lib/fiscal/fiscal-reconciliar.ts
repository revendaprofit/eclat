// Lê o XML autorizado e grava o nItem REAL de cada item (spec §7.3).
//
// A Brasil NFe gera o nItem pela ordem em que enviamos os itens, mas não devolve o valor.
// A resposta síncrona de EnviarNotaFiscal já traz o XML autorizado (Base64Xml), então a emissão
// reconcilia NA HORA, passando o XML em mãos (spec §7.3). O download só acontece na varredura
// e na resolução manual.
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
import { baixarArquivo, localizarPorIdentificador } from "./fiscal-client"
import { tipoAmbiente } from "./fiscal-payload"
import { extrairChaveDoXml, extrairItensDoXml, type ItemXml } from "./fiscal-xml"
import { ErroFiscal, type FiscalDocumento, type FiscalDocumentoItem, type StatusDocumento } from "./tipos"

// Status que já não mudam mais: reconciliar de novo só baixaria XML à toa. Fonte única — o
// webhook (src/api/webhooks/brasilnfe/route.ts) importa daqui em vez de redefinir (achado C1 da
// revisão final de 2026-09-17).
export const STATUS_TERMINAIS = new Set<StatusDocumento>(["verificado", "rejeitado", "denegado"])

export async function reconciliarDocumento(
  documentoId: string,
  xmlEmMaos?: string
): Promise<{ verificado: boolean; divergencias: string[] }> {
  const doc = await lerDocumento(documentoId)

  // C1 (crítico, revisão final de 2026-09-17): o único caminho que grava um documento terminal
  // COM chave_acesso é a varredura, quando o fornecedor devolve Status 3 (denegado) —
  // localizarNoFornecedor grava status:"denegado" junto com a chave. Sem esta recusa, um clique
  // em "Reconciliar" nesse documento baixava o XML, casava os itens pelo código e promovia a nota
  // denegada a "verificado" — liberando NFD e um novo despacho contra uma nota que a SEFAZ
  // recusou. "verificado" NÃO entra aqui: re-reconciliar um documento já verificado é idempotente
  // (mesmo XML, mesmo casamento) e o webhook depende disso continuar permitido pela lib.
  if (doc.status === "denegado" || doc.status === "rejeitado") {
    throw new ErroFiscal(
      `Documento ${documentoId} está ${doc.status} — não há nota autorizada para reconciliar.`
    )
  }

  if (!doc.chave_acesso) {
    throw new ErroFiscal(
      `Documento ${documentoId} não tem chave de acesso — não há XML para reconciliar.`
    )
  }

  // Origem do XML, em ordem: em mãos (emissão síncrona) → já gravado → download.
  let xml = xmlEmMaos ?? doc.xml_autorizado ?? null
  let veioDeDownload = false
  if (!xml) {
    xml = (await baixarArquivo(doc.chave_acesso, "xml")).toString("utf8")
    veioDeDownload = true
  }
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
    // O XML é o documento legal: se veio de download, fica guardado conosco.
    ...(veioDeDownload ? { xml_autorizado: xml } : {}),
  })

  return { verificado: true, divergencias }
}

// Procura no fornecedor uma nota emitida com o IdentificadorInterno deste documento (é a nossa
// idempotency_key, enviada no payload). Serve à varredura e à barreira de duplicidade da emissão.
//
// NUNCA conclui que a nota "não foi emitida": ausência na consulta não é prova (a nota pode não
// estar indexada ainda). Só a resolução manual (/admin/fiscal/resolver) declara isso.
export async function localizarNoFornecedor(doc: FiscalDocumento): Promise<FiscalDocumento | null> {
  const achada = await localizarPorIdentificador({
    identificador: doc.idempotency_key,
    ambiente: tipoAmbiente(doc.ambiente),
    desde: doc.created_at ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  })
  if (!achada) return null

  if (achada.status === 3) {
    await atualizarDocumento(doc.id, {
      status: "denegado",
      chave_acesso: achada.chave_acesso,
      rejeicao_motivo: "Uso denegado — localizado na Brasil NFe pela varredura.",
    })
    return null
  }
  // status 2 = cancelada: a nota existiu mas não vale mais. Não adota e não mexe — o operador
  // decide em Fiscal → Fila.
  if (achada.status !== 1) return null

  return atualizarDocumento(doc.id, {
    status: "autorizado_nao_verificado",
    chave_acesso: achada.chave_acesso,
    numero: achada.numero,
    serie: achada.serie,
    rejeicao_codigo: null,
    rejeicao_motivo: null,
  })
}

// Varredura de segurança (spec §7.3). A emissão síncrona reconcilia na hora; a varredura cobre o
// que ela não fecha sozinha: transmissão sem resposta (localiza pelo IdentificadorInterno) e
// reconciliação que falhou ou ficou sem XML.
export async function reconciliarPendentes(
  limite = 50
): Promise<{ processados: number; verificados: number }> {
  const pendentes = await listarPorStatus(
    ["autorizado_nao_verificado", "transmitido_sem_confirmacao"],
    limite
  )
  let verificados = 0
  for (const pendente of pendentes) {
    try {
      let doc: FiscalDocumento | null = pendente
      // Sem chave: a transmissão não teve resposta. Pergunta ao fornecedor se a nota existe.
      if (!doc.chave_acesso) doc = await localizarNoFornecedor(doc)
      if (!doc) continue
      const r = await reconciliarDocumento(doc.id)
      if (r.verificado) verificados++
    } catch {
      // Falha de um documento não pode parar a varredura dos outros.
      // O documento permanece pendente e reaparece na próxima passada.
    }
  }
  return { processados: pendentes.length, verificados }
}
