import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { raizPorCategoria, type CategoriaMin } from "./utils/categorias"
import { montarConjuntos } from "./utils/montar-conjuntos"
import { MARCA_EM_CONJUNTO, MARCA_LIVRE } from "./utils/promocao"
import type { Linha, ResultadoMontagem } from "./utils/tipos"

type ItemCtx = Record<string, any> & { id: string; quantity: number | string; subtotal: number | string; product?: { id?: string; collection_id?: string | null; categories?: { id: string }[] | null } | null }

// Cache curto da árvore de categorias (muda raramente; o gancho roda a cada mudança de carrinho).
// Exportada (ruling P1) porque as Tasks 6/7 (rotas de vitrine) reaproveitam a mesma leitura de raízes.
let cacheCats: { em: number; mapa: Map<string, string> } | null = null
export async function mapaRaizes(container: MedusaContainer): Promise<Map<string, string>> {
  if (cacheCats && Date.now() - cacheCats.em < 60_000) return cacheCats.mapa
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "handle", "parent_category_id"] })
  const mapa = raizPorCategoria(data as CategoriaMin[])
  cacheCats = { em: Date.now(), mapa }
  return mapa
}

// Elegível = preço > 0 (spec §5). Linhas com preco_unitario <= 0 (brinde, item zerado) ficam de
// fora da montagem de conjuntos, mas continuam no carrinho — marcarContexto as marca "nenhum"
// naturalmente (não sobram unidades formadas para elas em `resultado`).
export function linhasDoCarrinho(items: ItemCtx[], raizes: Map<string, string>): Linha[] {
  return items
    .map((it) => {
      const q = Math.max(1, Number(it.quantity))
      const unit = Number(it.subtotal) / q
      const cat = (it.product?.categories ?? []).map((c) => raizes.get(c.id)).find((h): h is string => !!h) ?? null
      return { item_id: it.id, product_id: it.product?.id ?? "", collection_id: it.product?.collection_id ?? null, categoria_raiz: cat, preco_unitario: Math.round(unit * 100), quantidade: q }
    })
    .filter((l) => l.preco_unitario > 0)
}

export async function avaliarCarrinho(container: MedusaContainer, cart: { items?: ItemCtx[] | null }): Promise<{ resultado: ResultadoMontagem; linhas: Linha[] }> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const [{ regras, pares, curados }, raizes] = await Promise.all([svc.carregarAtivos(), mapaRaizes(container)])
  const linhas = linhasDoCarrinho(cart.items ?? [], raizes)
  return { resultado: montarConjuntos(linhas, regras, pares, curados), linhas }
}

// Campos monetários de uma entrada de item que `escalar` pode reescalar (Controller ruling P4).
// `unit_price` fica de fora de propósito: é valor POR unidade, não muda quando a quantidade da
// entrada muda. `quantity` é tratado à parte (não é um campo monetário).
const CAMPOS_MONETARIOS = [
  "subtotal", "total", "original_total", "original_subtotal",
  "discount_total", "discount_subtotal",
  "tax_total", "original_tax_total", "discount_tax_total",
] as const

// Copia `it` como uma entrada de contexto com `n` das `q` unidades originais da linha, escalando
// por `n / q` todo campo monetário presente (e o `.value` do respectivo `raw_<campo>`, se houver) —
// não só `subtotal`. Hoje o motor de promoções só olha `subtotal`/`quantity` porque as promoções
// do Benefício Conjunto não são `is_tax_inclusive`, mas se algum dia existir uma que seja, os
// outros campos (tax_total, discount_total etc.) entram na conta do motor e precisam já estar
// escalados aqui — do contrário eles carregariam o valor da linha inteira numa fração dela.
function escalar(it: ItemCtx, n: number, q: number): ItemCtx {
  const copia: ItemCtx = { ...it, quantity: n }
  for (const campo of CAMPOS_MONETARIOS) {
    const valor = (it as any)[campo]
    if (valor !== undefined && valor !== null && Number.isFinite(Number(valor))) {
      ;(copia as any)[campo] = (Number(valor) / q) * n
    }
    const rawCampo = `raw_${campo}`
    const raw = (it as any)[rawCampo]
    if (raw && typeof raw === "object" && Number.isFinite(Number(raw.value))) {
      ;(copia as any)[rawCampo] = { ...raw, value: String((Number(raw.value) / q) * n) }
    }
  }
  return copia
}

// Contexto para o motor de promoções (spec §6.1, ruling 4): cada linha vira até 3 entradas com o
// mesmo id — unidades com desconto (conjunto_desconto = regra_id), em conjunto sem desconto
// ("conjunto") e livres ("nenhum"). Não inclui `conjunto_id`: o motor de promoções não usa esse
// campo, e uma mesma linha pode ter unidades em conjuntos DIFERENTES (ex.: top×2 pareado com
// legging num conjunto e com short em outro — caso 3 do spec de carrinho), então um único
// `conjunto_id` por item_id mentiria para qualquer consumidor que confiasse nele. Quem precisar
// saber que conjunto formou cada unidade (vitrine) usa `/store/conjuntos/oportunidades` (Task 7),
// que devolve `ConjuntoFormado[]` já com os `item_id`s corretos por conjunto.
export function marcarContexto(items: ItemCtx[], resultado: ResultadoMontagem): ItemCtx[] {
  const porItem = new Map<string, Map<string, number>>() // item_id → marca → unidades
  for (const c of resultado.conjuntos) for (const u of c.unidades) {
    const marca = u.desconto_unitario > 0 ? c.regra_id : MARCA_EM_CONJUNTO
    const m = porItem.get(u.item_id) ?? new Map<string, number>()
    m.set(marca, (m.get(marca) ?? 0) + 1)
    porItem.set(u.item_id, m)
  }
  const saida: ItemCtx[] = []
  for (const it of items) {
    const q = Math.max(1, Number(it.quantity))
    const marcas = porItem.get(it.id)
    if (!marcas) { saida.push({ ...it, conjunto_desconto: MARCA_LIVRE }); continue }
    let usadas = 0
    for (const [marca, n] of Array.from(marcas.entries())) {
      saida.push({ ...escalar(it, n, q), conjunto_desconto: marca })
      usadas += n
    }
    if (usadas < q) saida.push({ ...escalar(it, q - usadas, q), conjunto_desconto: MARCA_LIVRE })
  }
  return saida
}
