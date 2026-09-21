// Pedido mínimo da loja (decisão do dono, 2026-09-20: R$ 150 em PEÇAS). A conta que VALE é a do
// backend (`apps/backend/src/modules/pedido-minimo/regra.ts`, mesma fórmula) — aqui é para avisar
// a cliente e travar o botão antes de ela perder tempo no checkout.
//
// Conta o preço CHEIO das peças (preço × quantidade), sem descontos e sem frete: o mínimo é sobre
// o tamanho do pedido, não sobre o quanto ela paga depois do cupom.

export const PEDIDO_MINIMO_CENTAVOS = 15000

export type LinhaDePeca = { unit_price?: number | null; quantity?: number | null }

const centavos = (v?: number | null) => Math.round((v ?? 0) * 100)

export function subtotalDasPecas(cart: { items?: LinhaDePeca[] | null }): number {
  let total = 0
  for (const item of cart?.items ?? []) total += centavos(item.unit_price) * (item.quantity ?? 0)
  return Math.max(0, total)
}

export type AvaliacaoDoMinimo = { atingiu: boolean; subtotal: number; minimo: number; falta: number; percentual: number }

export function avaliarMinimo(
  cart: { items?: LinhaDePeca[] | null },
  minimo: number = PEDIDO_MINIMO_CENTAVOS
): AvaliacaoDoMinimo {
  const subtotal = subtotalDasPecas(cart)
  // Carrinho vazio tem a própria tela ("sua sacola está vazia"); não é caso de aviso de mínimo.
  if (subtotal === 0 || minimo <= 0) {
    return { atingiu: true, subtotal, minimo, falta: 0, percentual: 100 }
  }
  const falta = Math.max(0, minimo - subtotal)
  return {
    atingiu: falta === 0,
    subtotal,
    minimo,
    falta,
    percentual: Math.min(100, Math.floor((subtotal / minimo) * 100)),
  }
}
