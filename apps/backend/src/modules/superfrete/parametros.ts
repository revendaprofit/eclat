// Parâmetros da regra de frete: padrão da spec §4.4, sobrescrito por env (Railway) sem deploy de código.
import type { Parametros } from "./preco"

// pisoMg: R$ 499 → R$ 399 (10/10) → R$ 129 em 2026-10-27 (sócia: "MG acima do valor de uma peça", a camiseta
// é a peça mais barata; meia sozinha não ganha). Se FRETE_GRATIS_MG_CENTAVOS estiver no Railway, ela manda.
// metadeBrasil: fora de MG, frete pela metade a partir de R$ 250 (27/10); env FRETE_METADE_BRASIL_CENTAVOS.
const PADRAO: Parametros = { margem: 200, pisoMg: 12900, pisoBrasil: 59900, reservaPac: 2490, metadeBrasil: 25000 }

function inteiro(valor: string | undefined, padrao: number): number {
  const n = Number(valor)
  return valor !== undefined && valor !== "" && Number.isInteger(n) && n >= 0 ? n : padrao
}

export function parametrosDoAmbiente(env: NodeJS.ProcessEnv = process.env): Parametros {
  return {
    margem: inteiro(env.FRETE_MARGEM_CENTAVOS, PADRAO.margem),
    pisoMg: inteiro(env.FRETE_GRATIS_MG_CENTAVOS, PADRAO.pisoMg),
    pisoBrasil: inteiro(env.FRETE_GRATIS_BRASIL_CENTAVOS, PADRAO.pisoBrasil),
    reservaPac: inteiro(env.FRETE_RESERVA_PAC_CENTAVOS, PADRAO.reservaPac),
    metadeBrasil: inteiro(env.FRETE_METADE_BRASIL_CENTAVOS, PADRAO.metadeBrasil),
  }
}
