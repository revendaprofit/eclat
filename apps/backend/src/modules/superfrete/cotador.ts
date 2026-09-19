// Cotador único do processo: cliente + cache. O provider (container do módulo de fulfillment) e a
// rota /store/frete/prazos (container da aplicação) precisam enxergar o MESMO cache, então ele vive
// num singleton de módulo Node, montado a partir do ambiente na primeira chamada.
import { CacheDeCotacao } from "./cache"
import { ClienteSuperfrete, type Cotacao } from "./cliente"
import type { Pacote } from "./embalagem"

export type Cotador = { cotar(cepDestino: string, pacote: Pacote): Promise<Cotacao[]> }

const TTL_MS = 10 * 60 * 1000
let instancia: Cotador | null = null

export function obterCotador(): Cotador {
  if (instancia) return instancia
  const token = process.env.SUPERFRETE_TOKEN
  const cepOrigem = process.env.SUPERFRETE_FROM_POSTAL_CODE
  const contato = process.env.SUPERFRETE_CONTACT_EMAIL
  if (!token || !cepOrigem || !contato) {
    throw new Error("Frete: defina SUPERFRETE_TOKEN, SUPERFRETE_FROM_POSTAL_CODE e SUPERFRETE_CONTACT_EMAIL no ambiente.")
  }
  const cliente = new ClienteSuperfrete({
    token,
    cepOrigem,
    contato,
    sandbox: process.env.SUPERFRETE_SANDBOX === "true",
    baseUrl: process.env.SUPERFRETE_BASE_URL || undefined,
  })
  const cache = new CacheDeCotacao<Cotacao[]>(TTL_MS)
  instancia = {
    cotar: (cep, p) =>
      cache.obter(`${cep.replace(/\D/g, "")}|${p.largura}|${p.altura}|${p.comprimento}|${p.peso_kg}`, () => cliente.cotar(cep, p)),
  }
  return instancia
}

/** Só para testes: força remontar o cotador com o ambiente atual. */
export function zerarCotador(): void {
  instancia = null
}
