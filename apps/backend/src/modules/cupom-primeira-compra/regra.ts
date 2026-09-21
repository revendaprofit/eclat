// Cupom de primeira compra: UM por CPF (decisão do dono, 2026-09-21).
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

export function mensagemCupomJaUsado(codigo: string): string {
  return `O cupom ${codigo} é de primeira compra e já foi usado neste CPF. Remova o cupom da sacola para continuar`
}

/**
 * Decide se o carrinho pode seguir. `pedidosDoCpf` = pedidos NÃO cancelados desse CPF, com os cupons de cada um.
 * Bloqueia quando o carrinho traz um cupom de primeira compra e o CPF já tem pedido com QUALQUER cupom de
 * primeira compra (trocar BEMVINDA10 por BEMVINDA15 não abre um segundo desconto).
 */
export function avaliarCupomPrimeiraCompra(
  cuponsDoCarrinho: Array<string | null | undefined>,
  pedidosDoCpf: Array<{ cupons: Array<string | null | undefined> }>
): { permitido: true } | { permitido: false; codigo: string } {
  const noCarrinho = cuponsDePrimeiraCompra(cuponsDoCarrinho)
  if (!noCarrinho.length) return { permitido: true }
  const jaUsou = pedidosDoCpf.some((p) => cuponsDePrimeiraCompra(p.cupons).length > 0)
  return jaUsou ? { permitido: false, codigo: noCarrinho[0] } : { permitido: true }
}
