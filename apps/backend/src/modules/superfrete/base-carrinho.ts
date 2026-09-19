// Base do frete grátis (spec §4.4): valor das peças JÁ COM descontos, sem o frete, em centavos.
//
// Achado do levantamento: o `context` que o Medusa entrega a `calculatePrice` vem de
// `cartFieldsForCalculateShippingOptionsPrices` (core-flows) — `items.*` SEM `items.adjustments`.
// O provider, que vive no container do módulo de fulfillment, também não recebe o Query da
// aplicação. A saída é o container global do framework, preenchido no boot do Medusa.
import { container } from "@medusajs/framework"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { paraCentavos } from "./dinheiro"

export type ItemDaBase = { unit_price: unknown; quantity: unknown; adjustments?: { amount?: unknown }[] | null }

/** O Medusa entrega números ora crus, ora como BigNumber ({ numeric }) ou bruto ({ value }). */
function numero(v: unknown): number {
  if (typeof v === "object" && v !== null) {
    const o = v as { numeric?: unknown; value?: unknown }
    if (typeof o.numeric === "number") return o.numeric
    if (o.value !== undefined) return Number(o.value)
  }
  return Number(v)
}

export function calcularBase(itens: ItemDaBase[]): number {
  let base = 0
  for (const item of itens) {
    base += paraCentavos(numero(item.unit_price)) * numero(item.quantity)
    // `adjustment.amount` é o desconto da LINHA inteira, não por unidade.
    for (const a of item.adjustments ?? []) base -= paraCentavos(numero(a.amount ?? 0))
  }
  return Math.max(0, base)
}

export async function buscarBaseDoCarrinho(cartId: string): Promise<number> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.unit_price", "items.quantity", "items.adjustments.amount"],
    filters: { id: cartId },
  })
  return calcularBase((data[0]?.items ?? []) as ItemDaBase[])
}
