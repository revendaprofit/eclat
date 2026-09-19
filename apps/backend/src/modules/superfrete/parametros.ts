// Parâmetros da regra de frete: padrão da spec §4.4, sobrescrito por env (Railway) sem deploy de código.
import type { Parametros } from "./preco"

const PADRAO: Parametros = { margem: 200, pisoMg: 49900, pisoBrasil: 59900, reservaPac: 2490 }

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
  }
}
