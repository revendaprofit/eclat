// Regras de frete do lado da vitrine (spec 2026-09-18-frete-superfrete-design.md §4.5–4.6).
// A conta que VALE é a do backend (modules/superfrete/preco.ts); aqui é só exibição.
export type RegrasDeFrete = { piso_mg: number; piso_brasil: number }
export type ServicoDeFrete = "mini" | "pac" | "sedex"
export type Prazos = Partial<Record<ServicoDeFrete, { min: number; max: number }>>

const centavos = (v?: number | null) => Math.round((v ?? 0) * 100)

export type ItemDeBase = {
  unit_price?: number | null
  quantity?: number | null
  adjustments?: { amount?: number | null }[] | null
}

/**
 * Mesma base do backend (modules/superfrete/base-carrinho.ts `calcularBase`): soma preço × quantidade
 * de cada linha, subtrai os adjustments DA PRÓPRIA LINHA (cupom e Benefício Conjunto — "amount" é o
 * desconto da linha inteira, não por unidade) e só arredonda em 0 no TOTAL. NUNCA usar
 * `cart.discount_total`: esse campo do Medusa soma também descontos de MÉTODO DE FRETE, que não fazem
 * parte da base do frete grátis (achado da revisão do Task 12).
 */
export function baseDoCarrinho(cart: { items?: ItemDeBase[] | null }): number {
  let base = 0
  for (const item of cart.items ?? []) {
    base += centavos(item.unit_price) * (item.quantity ?? 0)
    for (const a of item.adjustments ?? []) base -= centavos(a.amount)
  }
  return Math.max(0, base)
}

export function progressoFreteGratis(base: number, uf: string | null | undefined, regras: RegrasDeFrete) {
  const sigla = (uf ?? "").trim().toUpperCase().replace(/^BR-/, "")
  const piso = sigla === "MG" ? regras.piso_mg : regras.piso_brasil
  if (piso <= 0) {
    return { piso, falta: 0, atingiu: true, percentual: 100 }
  }
  const falta = Math.max(0, piso - base)
  return { piso, falta, atingiu: falta === 0, percentual: Math.min(100, Math.floor((base / piso) * 100)) }
}

export function textoPrazo(p?: { min: number; max: number }): string | null {
  if (!p) return null
  if (p.min === p.max) return `Chega em ${p.max} ${p.max === 1 ? "dia útil" : "dias úteis"}`
  return `Chega em ${p.min} a ${p.max} dias úteis`
}

export function servicoDaOpcao(opcao: { type?: { code?: string | null } | null }): ServicoDeFrete | null {
  const code = opcao.type?.code
  return code === "mini" || code === "pac" || code === "sedex" ? code : null
}

/** Casas decimais para exibir um valor em centavos: reais redondos sem decimais, com centavos sempre com 2. */
export function casasDoValor(centavosDoValor: number): 0 | 2 {
  return centavosDoValor % 100 === 0 ? 0 : 2
}
