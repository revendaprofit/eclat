// Desconto no Pix (decisão do dono, 2026-09-30): 5% que SOMA com cupom e com o Benefício Conjunto e
// NÃO conta para a base do frete grátis. É uma promoção comum do Medusa com código fixo (padrão
// PIX5, criada por scripts/desconto-pix.mjs); a vitrine aplica o código ao escolher Pix e tira ao
// escolher cartão, e o backend recusa cobrança de cartão com o código no carrinho.
// Onde o código é tratado de forma especial (procure por `ehCodigoPix`):
//   - beneficio-conjunto: não vira "cupom" (não disputa com o conjunto nem ganha regra de exclusão)
//   - superfrete/base-carrinho: o desconto dele não reduz a base do frete grátis
//   - api/middlewares/desconto-pix: cartão com o código no carrinho = recusado
export const CODIGO_PIX_PADRAO = "PIX5"

export function codigoPix(env: Record<string, string | undefined> = process.env): string {
  return (env.DESCONTO_PIX_CODIGO || CODIGO_PIX_PADRAO).trim().toUpperCase()
}

export function ehCodigoPix(code: unknown, env: Record<string, string | undefined> = process.env): boolean {
  return typeof code === "string" && code.trim().toUpperCase() === codigoPix(env)
}

/** Cobrança de cartão com o desconto do Pix no carrinho: recusa (a vitrine tira o código antes). */
export function cartaoComDescontoPix(metodo: unknown, codigos: unknown[], env: Record<string, string | undefined> = process.env): boolean {
  return metodo === "cartao" && codigos.some((c) => ehCodigoPix(c, env))
}

export const MENSAGEM_CARTAO_COM_PIX =
  "O desconto do Pix vale só para pagamento no Pix. Volte à etapa de pagamento e escolha o cartão de novo para atualizar o valor."
