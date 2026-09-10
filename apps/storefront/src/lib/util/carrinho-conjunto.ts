// Módulo puro do Benefício Conjunto no carrinho/checkout/pedido (F4, spec §7.5). Sem I/O, sem
// React. O carrinho é a verdade: aqui só se agrupa o que o Medusa já calculou (ajustes das linhas
// com código `CONJUNTO-<regra_id>`) e se monta a apresentação (etiquetas, aviso, gatilhos).
import type { HttpTypes } from "@medusajs/types"
import { type ColecaoStore, type RegraStore, descricaoRegra, precoMinDisponivel, slotMetadata } from "./conjuntos"

// Mesmo prefixo de `CODIGO_PREFIXO` no backend (`utils/promocao.ts`).
export const PREFIXO_CONJUNTO = "CONJUNTO-"

// Título da seção "Feche mais um conjunto" (ruling 4) — também usado como item_list_name dos
// eventos de analytics ao adicionar uma candidata (`candidata.tsx`). Módulo puro: nunca importar
// de um componente cliente.
export const LISTA_GATILHO = "Feche mais um conjunto"

export type AjusteLinha = { code?: string | null; amount?: number | null }
export type LinhaComAjustes = {
  id: string
  quantity: number
  adjustments?: AjusteLinha[] | null
  metadata?: Record<string, unknown> | null
}
/** Centavos inteiros. */
export type GruposDesconto = { conjunto: number; cupom: number }

// Resposta de GET /store/conjuntos/oportunidades?cart_id= (F1; dinheiro em centavos no backend).
export type UnidadeStore = { item_id: string; product_id: string; preco_unitario: number; desconto_unitario: number }
export type ConjuntoFormadoStore = { id: string; tipo: "curado" | "colecao"; regra_id: string; unidades: UnidadeStore[] }
export type OportunidadeStore = { collection_id: string; categoria_faltante: string; a_partir_do_item_id: string; candidatos: string[] }

export type Gatilho = {
  collection_id: string
  colecaoNome: string
  categoria_faltante: string
  categoriaNome: string
  regra: RegraStore
  candidatas: HttpTypes.StoreProduct[]
}

export function ehAjusteConjunto(code?: string | null): boolean {
  return typeof code === "string" && code.indexOf(PREFIXO_CONJUNTO) === 0
}

const centavos = (v?: number | null): number => Math.round((v ?? 0) * 100)

// Ruling 2: "Benefício Conjunto" = ajustes CONJUNTO-*; "Cupom" = todos os outros ajustes de linha.
export function agruparDescontos(itens?: LinhaComAjustes[] | null): GruposDesconto {
  const g: GruposDesconto = { conjunto: 0, cupom: 0 }
  for (const item of itens ?? []) {
    for (const a of item.adjustments ?? []) {
      if (ehAjusteConjunto(a.code)) g.conjunto += centavos(a.amount)
      else g.cupom += centavos(a.amount)
    }
  }
  return g
}

// Ruling 1: etiqueta por linha a partir dos conjuntos formados (rota `oportunidades`).
export function etiquetasDoCarrinho(
  conjuntos: ConjuntoFormadoStore[],
  itens: { id: string; quantity: number }[]
): Record<string, string> {
  const total = conjuntos.length
  if (!total) return {}
  const porItem: Record<string, { numeros: number[]; unidades: number }> = {}
  conjuntos.forEach((c, idx) => {
    for (const u of c.unidades ?? []) {
      if (!porItem[u.item_id]) porItem[u.item_id] = { numeros: [], unidades: 0 }
      const e = porItem[u.item_id]
      if (e.numeros.indexOf(idx + 1) === -1) e.numeros.push(idx + 1)
      e.unidades += 1
    }
  })
  const out: Record<string, string> = {}
  for (const item of itens) {
    const e = porItem[item.id]
    if (!e) continue
    const base = total === 1 ? "Conjunto" : e.numeros.map((n) => `Conjunto ${n}/${total}`).join(" · ")
    out[item.id] = e.unidades < item.quantity ? `${base} (${e.unidades} de ${item.quantity})` : base
  }
  return out
}

// Ruling 1 (páginas de pedido e Cockpit): sem carrinho, a etiqueta vem do ajuste ou do slot.
export function etiquetaDoPedido(item: LinhaComAjustes): string | null {
  const porAjuste = (item.adjustments ?? []).some((a) => ehAjusteConjunto(a.code))
  const porSlot = typeof item.metadata?.conjunto_slot === "string"
  return porAjuste || porSlot ? "Conjunto" : null
}

// Ruling 3: promoções CONJUNTO-* são automáticas, não cupons — não aparecem na lista.
export function cuponsVisiveis<T extends { code?: string | null }>(promotions?: T[] | null): T[] {
  return (promotions ?? []).filter((p) => !ehAjusteConjunto(p.code))
}

export function avisoCupom(cart: {
  promotions?: { code?: string | null }[] | null
  items?: LinhaComAjustes[] | null
}): boolean {
  return cuponsVisiveis(cart.promotions).length > 0 && agruparDescontos(cart.items).conjunto > 0
}

// Ruling 4: candidatas na ordem do backend, só disponíveis; nomes com fallback para o handle.
export function montarGatilhos(
  oportunidades: OportunidadeStore[],
  produtos: Map<string, HttpTypes.StoreProduct>,
  colecoes: ColecaoStore[],
  nomesColecoes: Map<string, string>,
  nomesCategorias: Map<string, string>
): Gatilho[] {
  const out: Gatilho[] = []
  for (const o of oportunidades) {
    const col = colecoes.find((c) => c.collection_id === o.collection_id)
    if (!col) continue
    const candidatas = o.candidatos
      .map((id) => produtos.get(id))
      .filter((p): p is HttpTypes.StoreProduct => !!p && precoMinDisponivel(p) !== null)
    if (!candidatas.length) continue
    // Ruling 6: sem nome de categoria resolvível, a oportunidade é descartada — nunca mostrar
    // o slug/handle em prosa (colecaoNome vazio segue permitido: título sem "da coleção …").
    const categoriaNome = nomesCategorias.get(o.categoria_faltante)
    if (!categoriaNome) continue
    out.push({
      collection_id: o.collection_id,
      colecaoNome: nomesColecoes.get(o.collection_id) ?? "",
      categoria_faltante: o.categoria_faltante,
      categoriaNome,
      regra: col.regra,
      candidatas,
    })
  }
  return out
}

export function tituloGatilho(g: Gatilho): string {
  const colecao = g.colecaoNome ? ` da coleção ${g.colecaoNome}` : ""
  return `Mais uma peça de ${g.categoriaNome}${colecao} fecha outro conjunto — ${descricaoRegra(g.regra, 2)}.`
}

// Linha separada para a peça do gatilho (Global Constraints), mesmo formato dos slots da F3.
export function slotGatilho(categoriaFaltante: string, agora: number = Date.now()): { conjunto_slot: string } {
  return slotMetadata(`gatilho-${categoriaFaltante}`, 0, agora)
}
