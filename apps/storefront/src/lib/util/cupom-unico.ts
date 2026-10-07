// Um cupom por sacola (R5 da spec de parcerias, 2026-09-25). Antes o campo ACUMULAVA códigos
// (PATY10 + BEMVINDA10 entravam juntos e os dois descontos somavam). Ao aplicar um código, ele
// SUBSTITUI o que estava; os automáticos (Benefício Conjunto, `CONJUNTO-*`) o Medusa reaplica
// sozinho, então não precisam ser reenviados.
export function codigosAoAplicar(novo: string): string[] {
  const c = novo.trim().toUpperCase()
  return c ? [c] : []
}

// Aviso mostrado quando o novo cupom tirou outro da sacola.
export function avisoTroca(anteriores: string[], novo: string): string | null {
  const c = novo.trim().toUpperCase()
  const trocados = anteriores.filter((a) => a.toUpperCase() !== c)
  if (!c || !trocados.length) return null
  return `O cupom ${c} substituiu ${trocados.join(", ")}: só um cupom por pedido.`
}
