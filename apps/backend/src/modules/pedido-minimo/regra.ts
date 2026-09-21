// Pedido mínimo da loja (decisão do dono, 2026-09-20: R$ 150 em PEÇAS).
// Conta o preço cheio das peças (preço × quantidade), sem descontos e sem frete: o mínimo é sobre
// o tamanho do pedido, não sobre o quanto a cliente pagou depois do cupom. Dinheiro em centavos.

export const PEDIDO_MINIMO_CENTAVOS = 15000

export type LinhaDoCarrinho = { unit_price?: number | string | null; quantity?: number | string | null }

const centavos = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

/** Soma preço × quantidade de cada linha, em centavos. */
export function subtotalDasPecas(items: LinhaDoCarrinho[] | null | undefined): number {
  let total = 0
  for (const item of items ?? []) {
    const q = Number(item?.quantity)
    total += centavos(item?.unit_price) * (Number.isFinite(q) && q > 0 ? q : 0)
  }
  return Math.max(0, total)
}

export type Avaliacao = { atingiu: boolean; subtotal: number; minimo: number; falta: number }

export function avaliarMinimo(
  items: LinhaDoCarrinho[] | null | undefined,
  minimo: number = PEDIDO_MINIMO_CENTAVOS
): Avaliacao {
  const subtotal = subtotalDasPecas(items)
  // Carrinho vazio não é "abaixo do mínimo": é carrinho vazio, e quem barra isso é o próprio fluxo.
  if (subtotal === 0 || minimo <= 0) return { atingiu: true, subtotal, minimo, falta: 0 }
  const falta = Math.max(0, minimo - subtotal)
  return { atingiu: falta === 0, subtotal, minimo, falta }
}

/** Texto em pt-BR para a cliente (vitrine e erro do servidor usam o mesmo). */
export function mensagemDoMinimo(falta: number, minimo: number): string {
  const reais = (c: number) => (c / 100).toFixed(2).replace(".", ",")
  return `Pedido mínimo de R$ ${reais(minimo)} em peças. Faltam R$ ${reais(falta)}.`
}
