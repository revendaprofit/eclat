import type { Curado, Regra } from "./tipos"

export const CODIGO_PREFIXO = "CONJUNTO-"
export const ATRIBUTO = "items.conjunto_desconto"
export const MARCA_LIVRE = "nenhum"
export const MARCA_EM_CONJUNTO = "conjunto"
export const REGRA_EXCLUSAO = { attribute: ATRIBUTO, operator: "eq", values: [MARCA_LIVRE] } as const
export const MAX_QUANTITY = 1000

export const codigoDaRegra = (regraId: string) => `${CODIGO_PREFIXO}${regraId}`

// Quantas unidades tem um conjunto desta regra (para repartir `total_valor`): 2 no par; n produtos no curado.
export function nUnidadesDaRegra(regra: Regra, curados: Curado[]): number {
  if (regra.escopo !== "curado") return 2
  return Math.max(2, curados.find((c) => c.regra_id === regra.id)?.product_ids.length ?? 2)
}

// Payload da promoção automática (spec §6.2, contrato da F0). Valor em unidades da moeda.
export function payloadPromocao(regra: Regra, nUnidades: number) {
  const percentual = regra.tipo_desconto.endsWith("percentual")
  const valor = percentual ? regra.valor : regra.tipo_desconto === "total_valor" ? Math.round(regra.valor / nUnidades) / 100 : regra.valor / 100
  return {
    code: codigoDaRegra(regra.id),
    type: "standard" as const,
    is_automatic: true,
    status: regra.ativa ? ("active" as const) : ("inactive" as const),
    application_method: {
      type: percentual ? ("percentage" as const) : ("fixed" as const),
      target_type: "items" as const,
      allocation: "each" as const,
      max_quantity: MAX_QUANTITY,
      value: valor,
      currency_code: "brl",
      target_rules: [{ attribute: ATRIBUTO, operator: "eq" as const, values: [regra.id] }],
    },
  }
}
