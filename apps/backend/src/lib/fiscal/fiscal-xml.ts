// Lê o nItem REAL de cada item do XML autorizado pela SEFAZ (spec §7.3).
//
// Por que isso existe: a Brasil NFe não devolve o nItem — ela o gera a partir da ordem em que
// enviamos os itens. Isso é um contrato posicional implícito, e contrato implícito quebra em
// silêncio. O XML autorizado é a única fonte confiável: nele o nItem está assinado pela SEFAZ.
// Sem esse valor, a NFD é rejeitada pela regra VC03-20.
//
// Parse por regex, de propósito: o recorte é minúsculo e fechado (atributo nItem, cProd, NCM,
// chNFe), e adicionar um parser XML como dependência do backend não se paga aqui.

import { ErroFiscal } from "./tipos"

export type ItemXml = { n_item: number; codigo: string; ncm: string }

// Achado 5.8: sem o prefixo de namespace opcional, um XML que chegasse como <nfe:det> (em vez de
// <det>) casava ZERO itens em silêncio e nenhum documento reconciliava. "(?:\w+:)?" aceita "<det>"
// e "<nfe:det>" com a mesma regra, nas quatro tags que este parser lê.
const DET_RE = /<(?:\w+:)?det\b([^>]*)>([\s\S]*?)<\/(?:\w+:)?det>/g
const N_ITEM_RE = /\bnItem\s*=\s*["'](\d+)["']/
const C_PROD_RE = /<(?:\w+:)?cProd>([\s\S]*?)<\/(?:\w+:)?cProd>/
const NCM_RE = /<(?:\w+:)?NCM>([\s\S]*?)<\/(?:\w+:)?NCM>/
const CHAVE_RE = /<(?:\w+:)?chNFe>(\d{44})<\/(?:\w+:)?chNFe>/

export function extrairItensDoXml(xml: string): ItemXml[] {
  const itens: ItemXml[] = []

  for (const m of xml.matchAll(DET_RE)) {
    const atributos = m[1]
    const corpo = m[2]

    const nItem = N_ITEM_RE.exec(atributos)
    if (!nItem) {
      throw new ErroFiscal(
        "XML autorizado traz um item sem o atributo nItem. Sem ele a devolução seria rejeitada pela SEFAZ (VC03-20)."
      )
    }

    itens.push({
      n_item: Number(nItem[1]),
      codigo: (C_PROD_RE.exec(corpo)?.[1] ?? "").trim(),
      ncm: (NCM_RE.exec(corpo)?.[1] ?? "").trim(),
    })
  }

  if (itens.length === 0) {
    throw new ErroFiscal("XML autorizado não trouxe nenhum item (<det>).")
  }

  return itens.sort((a, b) => a.n_item - b.n_item)
}

export function extrairChaveDoXml(xml: string): string {
  const m = CHAVE_RE.exec(xml)
  if (!m) {
    throw new ErroFiscal("XML autorizado não traz a chave de acesso (<chNFe> com 44 dígitos).")
  }
  return m[1]
}
