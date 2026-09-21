// Cupom de primeira compra: só para CPF que NUNCA comprou (decisão do dono, 2026-09-21).
// Quem já tem pedido na loja — com ou sem cupom — não usa mais; logo, cada CPF usa no máximo um.
// Exceção consciente à regra geral "cupom nunca preso a cliente" (2026-09-20): os cupons comuns seguem
// limitados só por usos no total; os de primeira compra ganham, ALÉM disso, a trava por CPF.
//
// Por que CPF e não cadastro/e-mail: a loja vende sem login e o e-mail troca fácil; o CPF é obrigatório
// no passo de endereço (nota fiscal) e é validado por dígito — é a única identidade estável do pedido.
//
// Como um cupom vira "de primeira compra": pelo CÓDIGO. Todo código que começa com `BEMVINDA` é de
// primeira compra; `CUPONS_PRIMEIRA_COMPRA` (env, separado por vírgula) acrescenta outros sem deploy.
// Convenção em vez de tabela: promoção do Medusa não tem metadata, e isto não pede schema novo.
const PREFIXO = "BEMVINDA"

const extras = (): string[] =>
  (process.env.CUPONS_PRIMEIRA_COMPRA || "")
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)

export function ehCupomDePrimeiraCompra(codigo: string | null | undefined): boolean {
  const c = (codigo || "").trim().toUpperCase()
  if (!c) return false
  return c.startsWith(PREFIXO) || extras().includes(c)
}

export function cuponsDePrimeiraCompra(codigos: Array<string | null | undefined>): string[] {
  return codigos.filter(ehCupomDePrimeiraCompra).map((c) => (c as string).trim().toUpperCase())
}

export const normalizarCpf = (v: unknown): string => (typeof v === "string" ? v : "").replace(/\D/g, "")

export function mensagemCupomSoPrimeiraCompra(codigo: string): string {
  return `O cupom ${codigo} vale só para a primeira compra, e este CPF já tem pedido na loja. Remova o cupom da sacola para continuar`
}

/**
 * Decide se o carrinho pode seguir. `pedidosDoCpf` = quantos pedidos NÃO cancelados esse CPF já tem.
 * Carrinho com cupom de primeira compra + CPF com qualquer pedido anterior → recusado.
 */
export function avaliarCupomPrimeiraCompra(
  cuponsDoCarrinho: Array<string | null | undefined>,
  pedidosDoCpf: number
): { permitido: true } | { permitido: false; codigo: string } {
  const noCarrinho = cuponsDePrimeiraCompra(cuponsDoCarrinho)
  if (!noCarrinho.length || pedidosDoCpf <= 0) return { permitido: true }
  return { permitido: false, codigo: noCarrinho[0] }
}
