// Regra comercial do frete (spec §4.4). Funções puras, tudo em centavos inteiros.
import { arredonda90 } from "./dinheiro"

export type Servico = "mini" | "pac" | "sedex"
export const SERVICOS: Servico[] = ["mini", "pac", "sedex"]
export const ID_SUPERFRETE: Record<Servico, number> = { mini: 17, pac: 1, sedex: 2 }
export type Parametros = { margem: number; pisoMg: number; pisoBrasil: number; reservaPac: number }
export type Precos = Partial<Record<Servico, number>>

export function normalizaUf(provincia?: string | null): string {
  return (provincia ?? "").trim().toUpperCase().replace(/^BR-/, "")
}

export function pisoPara(uf: string, p: Parametros): number {
  return uf === "MG" ? p.pisoMg : p.pisoBrasil
}

/** Cotação crua da SuperFrete → preço normal de vitrine (margem de embalagem + final ,90). */
export function precosNormais(cotacoes: Precos, p: Parametros): Precos {
  const normais: Precos = {}
  for (const s of SERVICOS) {
    const c = cotacoes[s]
    if (typeof c === "number") normais[s] = arredonda90(c + p.margem)
  }
  return normais
}

/**
 * Decisão 5 da spec: atingido o piso, a opção MAIS BARATA sai por 0 e as demais cobram só a
 * diferença para ela. Empate: vence a primeira na ordem mini → pac → sedex.
 */
export function aplicarFreteGratis(normais: Precos, base: number, uf: string, p: Parametros): Precos {
  const disponiveis = SERVICOS.filter((s) => typeof normais[s] === "number")
  if (!disponiveis.length || base < pisoPara(uf, p)) return { ...normais }
  const menor = Math.min(...disponiveis.map((s) => normais[s] as number))
  const finais: Precos = {}
  for (const s of disponiveis) finais[s] = Math.max(0, (normais[s] as number) - menor)
  return finais
}
