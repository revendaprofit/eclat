// Leitura do estoque real (Medusa = fonte da verdade) e detecção de eventos por comparação
// com o snapshot anterior (Supabase). Só LÊ o comércio. Ver architecture/clube.md.
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { getSnapshot, upsertSnapshot, type SnapshotRow } from "./clube-db"

/* eslint-disable @typescript-eslint/no-explicit-any */

export type VarianteEstoque = SnapshotRow & { imagem_url: string | null; sku: string | null }

const SIZE_RE = /tamanho|size/i
const COLOR_RE = /\bcor\b|color|colour/i

function opcao(v: any, re: RegExp): string | null {
  const o = (v?.options ?? []).find((x: any) => re.test(String(x?.option?.title ?? "")))
  return o?.value ?? null
}

export function normalizarCor(s: string | null | undefined): string {
  return String(s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

// Foto da cor: a loja salva as imagens como products/<handle>/<cor>-NN-<hash>.jpg.
export function fotoDaCor(imagens: string[], thumbnail: string | null, cor: string | null): string | null {
  if (cor) {
    const slug = normalizarCor(cor).replace(/\s+/g, "-")
    const hit = imagens.find((u) => u.toLowerCase().includes(`/${slug}-`) || u.toLowerCase().includes(`/${slug}.`))
    if (hit) return hit
  }
  return thumbnail || imagens[0] || null
}

// Lê produtos publicados + variantes + quantidade disponível.
export async function lerEstoque(container: MedusaContainer): Promise<VarianteEstoque[]> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id", "handle", "title", "status", "thumbnail", "images.url",
      "variants.id", "variants.title", "variants.sku", "variants.manage_inventory", "variants.allow_backorder",
      "variants.options.value", "variants.options.option.title",
      "variants.inventory_items.inventory_item_id",
    ],
    filters: { status: "published" },
    pagination: { take: 500, skip: 0 },
  })

  // Quantidades por inventory_item (módulo de estoque)
  const itemIds: string[] = []
  for (const p of products) for (const v of p.variants ?? []) for (const ii of v.inventory_items ?? []) if (ii?.inventory_item_id) itemIds.push(ii.inventory_item_id)
  const qtyPorItem = new Map<string, number>()
  if (itemIds.length) {
    const inventory: any = container.resolve(Modules.INVENTORY)
    const levels: any[] = await inventory.listInventoryLevels({ inventory_item_id: [...new Set(itemIds)] })
    for (const l of levels) {
      const disponivel = typeof l.available_quantity === "number" ? l.available_quantity : Number(l.stocked_quantity ?? 0) - Number(l.reserved_quantity ?? 0)
      qtyPorItem.set(l.inventory_item_id, (qtyPorItem.get(l.inventory_item_id) ?? 0) + disponivel)
    }
  }

  const out: VarianteEstoque[] = []
  for (const p of products) {
    const imagens: string[] = (p.images ?? []).map((i: any) => i?.url).filter(Boolean)
    for (const v of p.variants ?? []) {
      const cor = opcao(v, COLOR_RE)
      let qty = 0
      if (v.manage_inventory === false || v.allow_backorder === true) qty = 999
      else for (const ii of v.inventory_items ?? []) qty += qtyPorItem.get(ii.inventory_item_id) ?? 0
      out.push({
        variant_id: v.id,
        product_id: p.id,
        product_handle: p.handle,
        product_title: p.title,
        cor,
        tamanho: opcao(v, SIZE_RE),
        qty,
        publicado: true,
        sku: v.sku ?? null,
        imagem_url: fotoDaCor(imagens, p.thumbnail ?? null, cor),
      })
    }
  }
  return out
}

export type EventoEstoque =
  | { tipo: "ultima_unidade"; item: VarianteEstoque }
  | { tipo: "reposicao"; item: VarianteEstoque }
  | { tipo: "esgotado"; item: VarianteEstoque }
  | { tipo: "novidade"; item: VarianteEstoque; motivo: "produto" | "cor" }

// Compara o estoque atual com o snapshot e devolve os eventos. Primeira rodada (snapshot vazio)
// só grava o snapshot — nunca dispara nada sobre estado antigo.
export async function detectarEventos(atual: VarianteEstoque[], limiar: number): Promise<{ eventos: EventoEstoque[]; primeiraRodada: boolean }> {
  const anterior = await getSnapshot()
  const antMap = new Map(anterior.map((r) => [r.variant_id, r]))
  const primeiraRodada = anterior.length === 0
  const eventos: EventoEstoque[] = []

  if (!primeiraRodada) {
    const produtosAntigos = new Set(anterior.map((r) => r.product_id))
    const coresAntigas = new Set(anterior.map((r) => `${r.product_id}|${normalizarCor(r.cor)}`))
    const novidadesVistas = new Set<string>()
    for (const item of atual) {
      const ant = antMap.get(item.variant_id)
      if (!ant) {
        if (!produtosAntigos.has(item.product_id) && !novidadesVistas.has(item.product_id!)) {
          novidadesVistas.add(item.product_id!)
          eventos.push({ tipo: "novidade", item, motivo: "produto" })
        } else if (!coresAntigas.has(`${item.product_id}|${normalizarCor(item.cor)}`) && !novidadesVistas.has(`${item.product_id}|${normalizarCor(item.cor)}`)) {
          novidadesVistas.add(`${item.product_id}|${normalizarCor(item.cor)}`)
          eventos.push({ tipo: "novidade", item, motivo: "cor" })
        }
        continue
      }
      if (ant.qty > limiar && item.qty <= limiar && item.qty > 0) eventos.push({ tipo: "ultima_unidade", item })
      if (ant.qty === 0 && item.qty > 0) eventos.push({ tipo: "reposicao", item })
      if (ant.qty > 0 && item.qty === 0) eventos.push({ tipo: "esgotado", item })
    }
  }

  await upsertSnapshot(atual.map(({ imagem_url: _i, sku: _s, ...r }) => r))
  return { eventos, primeiraRodada }
}

// "Esgotado" só vale quando TODOS os tamanhos daquela cor zeraram.
export function corEsgotada(atual: VarianteEstoque[], item: VarianteEstoque): boolean {
  return atual
    .filter((x) => x.product_id === item.product_id && normalizarCor(x.cor) === normalizarCor(item.cor))
    .every((x) => x.qty === 0)
}

export async function contarPedidos(container: MedusaContainer): Promise<{ total: number; hoje: number }> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { metadata } = await query.graph({ entity: "order", fields: ["id"], pagination: { take: 1, skip: 0 } })
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const { metadata: mHoje } = await query.graph({
    entity: "order", fields: ["id"], filters: { created_at: { $gte: hoje.toISOString() } }, pagination: { take: 1, skip: 0 },
  })
  return { total: metadata?.count ?? 0, hoje: mHoje?.count ?? 0 }
}
