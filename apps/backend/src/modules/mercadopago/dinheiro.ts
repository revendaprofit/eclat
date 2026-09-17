// Conversão de valores entre o Medusa e o Mercado Pago.
//
// O Medusa v2 guarda `amount` na unidade maior decimal (ex.: 199.90 pra R$ 199,90) — não em
// centavos. A Orders API do Mercado Pago recebe o valor NA MESMA unidade decimal, mas sempre
// como STRING com 2 casas fixas (confirmado na F0: `"total_amount": "199.90"`, nunca número).
//
// Tudo que é NOSSO (tarifa gravada no pedido, DRE) converte para centavos inteiros na borda —
// Invariante 3 do CLAUDE.md: dinheiro sempre em centavos inteiros, nunca float.
import type { BigNumberInput } from "@medusajs/framework/types"

/** Formata um valor do Medusa (BigNumberInput) como a Orders API do MP espera: string, 2 casas. */
export function paraValorMp(valor: BigNumberInput): string {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) {
    throw new Error(`Valor inválido para o Mercado Pago: ${String(valor)}`)
  }
  return numero.toFixed(2)
}

/** Converte um valor decimal (string ou número, ex.: "9.96") em centavos inteiros. */
export function paraCentavos(valorDecimal: string | number): number {
  return Math.round(Number(valorDecimal) * 100)
}
