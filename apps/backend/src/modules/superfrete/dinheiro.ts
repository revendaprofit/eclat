// Dinheiro do frete. Invariante 3 do CLAUDE.md: tudo que é nosso roda em centavos inteiros.
// Duas bordas convertem, e só elas: a SuperFrete devolve `price` em reais decimais, e o Medusa v2
// guarda valores na unidade maior decimal (16.9 = R$ 16,90) — ver mercadopago/dinheiro.ts.

/** Reais decimais (número ou string, ex.: 17.43) → centavos inteiros. */
export function paraCentavos(valor: string | number): number {
  const numero = Number(valor)
  if (!Number.isFinite(numero)) throw new Error(`Valor inválido para o frete: ${String(valor)}`)
  return Math.round(numero * 100)
}

/** Centavos inteiros → unidade maior decimal, que é o que o Medusa espera em `calculated_amount`. */
export function paraValorMedusa(centavos: number): number {
  return centavos / 100
}

/** Menor valor ≥ `centavos` que termina em ,90 (spec §4.4). */
export function arredonda90(centavos: number): number {
  const resto = centavos % 100
  return resto <= 90 ? centavos - resto + 90 : centavos - resto + 190
}
