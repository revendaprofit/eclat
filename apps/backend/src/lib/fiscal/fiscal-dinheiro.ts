// Dinheiro na fronteira com a API da Brasil NFe (spec §7.1.1).
//
// Tudo entra em centavos inteiros (Invariante 3). A API espera NÚMERO JSON em reais, então a
// conversão acontece uma única vez, aqui, no último instante — a partir de uma string decimal
// montada com aritmética inteira. Nenhuma soma, multiplicação ou arredondamento passa por float.

import { ErroFiscal } from "./tipos"

// Centavos inteiros -> "1234.56". Sem float em nenhum ponto.
export function reais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const abs = Math.abs(centavos)
  return `${sinal}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`
}

export function numeroReais(centavos: number): number {
  if (!Number.isInteger(centavos)) {
    throw new ErroFiscal(`Valor monetário inválido (${centavos}): a camada fiscal só aceita centavos inteiros.`)
  }
  return Number(reais(centavos))
}

// Rateia o frete entre os itens pelo método do maior resto: cada item recebe o piso da sua
// parte proporcional, e os centavos que sobram vão para os maiores restos (empate: o primeiro
// item). A soma das partes é EXATAMENTE o frete — a SEFAZ rejeita nota cujos totais não fecham.
export function ratearFrete(freteCentavos: number, pesosCentavos: number[]): number[] {
  if (!Number.isInteger(freteCentavos) || freteCentavos < 0) {
    throw new ErroFiscal(`Frete inválido (${freteCentavos}): precisa ser inteiro em centavos, >= 0.`)
  }
  if (pesosCentavos.length === 0) {
    throw new ErroFiscal("Não há itens entre os quais ratear o frete.")
  }
  const positivos = pesosCentavos.map((p) => Math.max(0, p))
  const soma = positivos.reduce((a, b) => a + b, 0)
  // Pedido com todos os itens zerados (100% de desconto): divide igualmente.
  const pesos = soma === 0 ? positivos.map(() => 1) : positivos
  const total = soma === 0 ? pesos.length : soma

  const partes = pesos.map((p) => Math.floor((freteCentavos * p) / total))
  const restos = pesos.map((p, i) => ({ i, resto: (freteCentavos * p) % total }))
  restos.sort((a, b) => b.resto - a.resto || a.i - b.i)

  const falta = freteCentavos - partes.reduce((a, b) => a + b, 0)
  for (let k = 0; k < falta; k++) partes[restos[k].i]++
  return partes
}
