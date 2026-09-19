// Regras de frete do lado da vitrine (spec 2026-09-18-frete-superfrete-design.md §4.5–4.6).
// A conta que VALE é a do backend (modules/superfrete/preco.ts); aqui é só exibição.
export type RegrasDeFrete = { piso_mg: number; piso_brasil: number }
export type ServicoDeFrete = "mini" | "pac" | "sedex"
export type Prazos = Partial<Record<ServicoDeFrete, { min: number; max: number }>>

const centavos = (v?: number | null) => Math.round((v ?? 0) * 100)

/** Mesma base do backend: valor das peças já com desconto, sem o frete. */
export function baseDoCarrinho(cart: { item_subtotal?: number | null; discount_total?: number | null }): number {
  return Math.max(0, centavos(cart.item_subtotal) - centavos(cart.discount_total))
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
