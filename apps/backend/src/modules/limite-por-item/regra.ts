// Limite de unidades por variante no carrinho (sócia, 2026-11-01).
//
// Por quê: em 14/10 e 31/10 apareceram carrinhos com 11 e 13 unidades de um mesmo tamanho — exatamente o
// estoque da variante. Alguém clicava em "Adicionar" até o site recusar, para descobrir quanto temos.
// Com um teto por tamanho, a sondagem para em 5 e não revela o estoque; cliente de verdade não leva
// mais que isso de um tamanho só. Pedido maior é combinado pelo WhatsApp.
//
// O teto vale por VARIANTE (soma das linhas daquele variant_id no carrinho), e o presente (R$ 0) não conta.
// Configurável pelo ambiente (CARRINHO_MAX_POR_VARIANTE), sem deploy.

export const LIMITE_PADRAO_POR_VARIANTE = 5

export type LinhaDoCarrinho = { variant_id?: string | null; quantity?: number | string | null; unit_price?: number | string | null }

export function limiteDoAmbiente(env: NodeJS.ProcessEnv = process.env): number {
  const n = Number(env.CARRINHO_MAX_POR_VARIANTE)
  return Number.isInteger(n) && n > 0 ? n : LIMITE_PADRAO_POR_VARIANTE
}

const inteiro = (v: unknown): number => {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

/** Unidades já no carrinho daquela variante (linhas de presente, preço 0, ficam de fora). */
export function unidadesDaVariante(items: LinhaDoCarrinho[] | null | undefined, variantId: string): number {
  let total = 0
  for (const item of items ?? []) {
    if (item?.variant_id !== variantId) continue
    if (inteiro(item?.unit_price) === 0 && Number(item?.unit_price) === 0) continue
    total += inteiro(item?.quantity)
  }
  return total
}

export type Avaliacao = { permitido: boolean; total: number; limite: number }

/** Adicionar `nova` unidades a quem já tem `existente`: passa do teto? */
export function avaliarLimite(existente: number, nova: number, limite: number = LIMITE_PADRAO_POR_VARIANTE): Avaliacao {
  const total = inteiro(existente) + inteiro(nova)
  return { permitido: total <= limite, total, limite }
}

/** Texto em pt-BR para a cliente (o erro do servidor chega assim à vitrine). */
export function mensagemDoLimite(limite: number): string {
  return `Máximo de ${limite} unidades por tamanho na sacola. Para pedidos maiores, fale com a gente no WhatsApp.`
}
