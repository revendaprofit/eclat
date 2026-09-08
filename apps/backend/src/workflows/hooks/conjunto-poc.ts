// PROVA DE CONCEITO (F0 do Benefício Conjunto) — descartável, substituído pelo módulo na F1.
// Só atua com CONJUNTO_POC=1 (runner de teste). Marca a unidade mais barata do carrinho com
// conjunto_desconto="poc" e todas as outras com "nenhum"; uma linha com N unidades vira duas
// entradas de contexto (1 marcada, N-1 não) para provar o §6.3 da spec.
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"

type Item = Record<string, any> & { id: string; quantity: number | string; subtotal: number | string }

const unitario = (i: Item) => Number(i.subtotal) / Number(i.quantity)

export function marcarUnidades(items: Item[]): Item[] {
  if (!items.length) return items
  const maisBarata = items.slice().sort((a, b) => unitario(a) - unitario(b) || a.id.localeCompare(b.id))[0]
  const saida: Item[] = []
  for (const it of items) {
    if (it.id !== maisBarata.id) {
      saida.push({ ...it, conjunto_desconto: "nenhum" })
      continue
    }
    const q = Number(it.quantity)
    if (q <= 1) {
      saida.push({ ...it, conjunto_desconto: "poc" })
      continue
    }
    const u = unitario(it)
    saida.push({ ...it, quantity: 1, subtotal: u, conjunto_desconto: "poc" })
    saida.push({ ...it, quantity: q - 1, subtotal: u * (q - 1), conjunto_desconto: "nenhum" })
  }
  return saida
}

updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }) => {
  if (process.env.CONJUNTO_POC !== "1") return new StepResponse({})
  try {
    const items = ((cart as any)?.items ?? []) as Item[]
    return new StepResponse({ items: marcarUnidades(items) })
  } catch (e) {
    console.error("[conjunto-poc]", e)
    return new StepResponse({})
  }
})
