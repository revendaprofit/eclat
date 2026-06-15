import { NextResponse } from "next/server"
import {
  medusaListProducts,
  medusaListCollections,
  medusaListCategories,
  medusaCreateProduct,
  medusaUpdateVariantPrice,
  medusaUpdateStock,
  type NewProductInput,
} from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"

// Importa planilha (linhas já mapeadas pelo cliente). Casa por SKU:
//  - SKU existente  → atualiza preço / estoque / custo
//  - SKU novo       → cria PRODUTO novo agrupando linhas por título (variações)
//                     (variação nova em produto já existente é pulada e reportada)

type Row = {
  sku?: string
  titulo?: string
  descricao?: string
  colecao?: string
  categoria?: string
  tamanho?: string
  cor?: string
  preco?: string
  custo?: string
  estoque?: string
  status?: string
}

const norm = (s?: string) => (s ?? "").trim()
const lower = (s?: string) => norm(s).toLowerCase()

function parseMoney(s?: string): number | null {
  let t = norm(s).replace(/r\$/i, "").replace(/\s/g, "")
  if (!t) return null
  if (t.includes(".") && t.includes(",")) t = t.replace(/\./g, "").replace(",", ".")
  else t = t.replace(",", ".")
  const n = Number(t)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function parseInt0(s?: string): number | null {
  const t = norm(s).replace(/\D/g, "")
  if (t === "") return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 0 ? n : null
}
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export async function POST(req: Request) {
  const { rows } = (await req.json()) as { rows?: Row[] }
  if (!rows?.length) return NextResponse.json({ error: "nenhuma linha" }, { status: 400 })

  try {
    const [produtos, colecoes, categorias] = await Promise.all([
      medusaListProducts(),
      medusaListCollections(),
      medusaListCategories(),
    ])

    // índices auxiliares
    const skuMap = new Map<
      string,
      { productId: string; variantId: string; inventory_item_id: string | null; price: number | null; stock: number | null }
    >()
    const existingHandles = new Set<string>()
    for (const p of produtos) {
      existingHandles.add(slugify(p.title))
      for (const v of p.variants) {
        if (v.sku) skuMap.set(v.sku, {
          productId: p.id,
          variantId: v.id,
          inventory_item_id: v.inventory_item_id,
          price: v.price,
          stock: v.stock,
        })
      }
    }
    const colByName = new Map(colecoes.map((c) => [lower(c.name), c.id]))
    const catByName = new Map(categorias.map((c) => [lower(c.name), c.id]))

    const summary = { atualizados: 0, criados: 0, custos: 0, pulados: [] as { ref: string; motivo: string }[] }
    const custosUpsert: { medusa_variant_id: string; sku: string | null; custo_centavos: number; updated_at: string }[] = []

    // ---- particiona ----
    const novosPorTitulo = new Map<string, Row[]>()
    for (const row of rows) {
      const sku = norm(row.sku)
      const found = sku ? skuMap.get(sku) : undefined
      if (found) {
        // UPDATE
        const preco = parseMoney(row.preco)
        const estoque = parseInt0(row.estoque)
        const custo = parseMoney(row.custo)
        if (preco != null && preco !== found.price)
          await medusaUpdateVariantPrice(found.productId, found.variantId, preco)
        if (estoque != null && found.inventory_item_id && estoque !== found.stock)
          await medusaUpdateStock(found.inventory_item_id, estoque)
        if (custo != null)
          custosUpsert.push({
            medusa_variant_id: found.variantId,
            sku: sku || null,
            custo_centavos: Math.round(custo * 100),
            updated_at: new Date().toISOString(),
          })
        summary.atualizados++
      } else {
        // CREATE candidate (agrupa por título)
        const titulo = norm(row.titulo)
        if (!titulo) {
          summary.pulados.push({ ref: sku || "(linha sem título/SKU)", motivo: "sem SKU correspondente e sem título para criar" })
          continue
        }
        if (!novosPorTitulo.has(titulo)) novosPorTitulo.set(titulo, [])
        novosPorTitulo.get(titulo)!.push(row)
      }
    }

    // ---- cria produtos novos ----
    for (const [titulo, grupo] of novosPorTitulo) {
      const handle = slugify(titulo)
      if (existingHandles.has(handle)) {
        summary.pulados.push({ ref: titulo, motivo: "produto já existe (variação nova em produto existente não é suportada nesta versão)" })
        continue
      }
      const tamanhos = [...new Set(grupo.map((r) => norm(r.tamanho)).filter(Boolean))]
      const cores = [...new Set(grupo.map((r) => norm(r.cor)).filter(Boolean))]
      const options: { title: string; values: string[] }[] = []
      if (tamanhos.length) options.push({ title: "Tamanho", values: tamanhos })
      if (cores.length) options.push({ title: "Cor", values: cores })
      if (!options.length) options.push({ title: "Padrão", values: ["Único"] })

      const variants: NewProductInput["variants"] = grupo.map((r, i) => {
        const t = norm(r.tamanho)
        const c = norm(r.cor)
        const opts: Record<string, string> = {}
        if (t) opts.Tamanho = t
        if (c) opts.Cor = c
        if (!t && !c) opts.Padrão = "Único"
        const tituloVar = [t, c].filter(Boolean).join(" / ") || "Padrão"
        return {
          title: tituloVar,
          sku: norm(r.sku) || `${slugify(titulo).toUpperCase().replace(/-/g, "").slice(0, 6)}-${i + 1}`,
          options: opts,
          price: parseMoney(r.preco) ?? 0,
          stock: parseInt0(r.estoque) ?? 0,
        }
      })

      const first = grupo[0]
      const collection_id = colByName.get(lower(first.colecao)) || undefined
      const category_ids = [
        ...new Set(grupo.map((r) => catByName.get(lower(r.categoria))).filter(Boolean) as string[]),
      ]
      // Status: "publicado"/"published" → published; qualquer outro/vazio → draft
      const st = lower(first.status)
      const status = st === "publicado" || st === "published" ? "published" : "draft"

      const created = await medusaCreateProduct({
        title: titulo,
        handle,
        description: norm(first.descricao) || undefined,
        status,
        collection_id,
        category_ids,
        options,
        variants,
      })
      existingHandles.add(handle)
      summary.criados++

      // custos das variações criadas (por SKU)
      const skuToVariant = new Map(created.variants.map((v) => [v.sku, v.id]))
      for (const r of grupo) {
        const custo = parseMoney(r.custo)
        const vid = skuToVariant.get(norm(r.sku))
        if (custo != null && vid)
          custosUpsert.push({
            medusa_variant_id: vid,
            sku: norm(r.sku) || null,
            custo_centavos: Math.round(custo * 100),
            updated_at: new Date().toISOString(),
          })
      }
    }

    // ---- grava custos em lote ----
    if (custosUpsert.length) {
      const r = await sb("produto_custo?on_conflict=medusa_variant_id", {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(custosUpsert),
      })
      if (r.ok) summary.custos = custosUpsert.length
    }

    return NextResponse.json(summary)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
