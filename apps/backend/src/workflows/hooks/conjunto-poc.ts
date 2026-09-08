// PROVA DE CONCEITO (F0 do Benefício Conjunto) — descartável, substituído pelo módulo na F1.
// Só atua com CONJUNTO_POC=1 (runner de teste). Marca K unidades da linha mais barata do carrinho
// com conjunto_desconto="poc" e todas as outras com "nenhum"; K vem de cart.metadata.conjunto_poc_k
// (default 1). Uma linha com quantity q vira duas entradas de contexto quando min(K,q) < q
// (1ª: min(K,q) unidades marcadas "poc"; 2ª: o restante "nenhum") para provar o §6.3 da spec —
// inclusive quando K < q-1, ou seja, quando a divisão marca só uma FRAÇÃO da linha, não a linha
// inteira menos uma unidade.
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"

type Item = Record<string, any> & { id: string; quantity: number | string; subtotal: number | string }

const unitario = (i: Item) => Number(i.subtotal) / Number(i.quantity)

export function marcarUnidades(items: Item[], k = 1): Item[] {
  if (!items.length) return items
  const maisBarata = items.slice().sort((a, b) => unitario(a) - unitario(b) || a.id.localeCompare(b.id))[0]
  const saida: Item[] = []
  for (const it of items) {
    if (it.id !== maisBarata.id) {
      saida.push({ ...it, conjunto_desconto: "nenhum" })
      continue
    }
    const q = Number(it.quantity)
    const marcadas = Math.min(Math.max(1, k), q)
    if (marcadas >= q) {
      saida.push({ ...it, conjunto_desconto: "poc" })
      continue
    }
    const u = unitario(it)
    saida.push({ ...it, quantity: marcadas, subtotal: u * marcadas, conjunto_desconto: "poc" })
    saida.push({ ...it, quantity: q - marcadas, subtotal: u * (q - marcadas), conjunto_desconto: "nenhum" })
  }
  return saida
}

updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }) => {
  if (process.env.CONJUNTO_POC !== "1") return new StepResponse({})
  try {
    const items = ((cart as any)?.items ?? []) as Item[]
    const k = Math.max(1, Number((cart as any)?.metadata?.conjunto_poc_k ?? 1))
    return new StepResponse({ items: marcarUnidades(items, k) })
  } catch (e) {
    console.error("[conjunto-poc]", e)
    return new StepResponse({})
  }
})
