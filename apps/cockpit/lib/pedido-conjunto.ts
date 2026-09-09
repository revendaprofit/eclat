// Desdobramento do desconto de um pedido (Benefício Conjunto × cupom) para o detalhe em
// /pedidos (spec §7.5, aceite §11 item 9). Puro. Valores do Medusa Admin chegam decimais; soma em
// centavos para não acumular erro de ponto flutuante e devolve decimal (unidade do `brl()` da tela).
export type ItemComAjustes = {
  adjustments?: { code?: string | null; amount?: number | null }[] | null
  metadata?: Record<string, unknown> | null
}

const PREFIXO = "CONJUNTO-"
const ehConjunto = (code?: string | null) => typeof code === "string" && code.startsWith(PREFIXO)
const cents = (v?: number | null) => Math.round((v ?? 0) * 100)

export function agruparDescontosPedido(items?: ItemComAjustes[] | null): { conjunto: number; cupom: number } {
  let conjunto = 0
  let cupom = 0
  for (const item of items ?? []) {
    for (const a of item.adjustments ?? []) {
      if (ehConjunto(a.code)) conjunto += cents(a.amount)
      else cupom += cents(a.amount)
    }
  }
  return { conjunto: conjunto / 100, cupom: cupom / 100 }
}

export function etiquetaConjunto(item: ItemComAjustes): "Conjunto" | null {
  const porAjuste = (item.adjustments ?? []).some((a) => ehConjunto(a.code))
  const porSlot = typeof item.metadata?.conjunto_slot === "string"
  return porAjuste || porSlot ? "Conjunto" : null
}
