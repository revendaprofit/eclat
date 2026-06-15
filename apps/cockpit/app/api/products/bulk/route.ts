import { NextResponse } from "next/server"
import {
  medusaListProducts,
  medusaUpdateProductStatus,
  medusaUpdateVariantPrice,
  medusaUpdateStock,
} from "@/lib/medusa"

// Ações em massa sobre produtos selecionados.
// O servidor relê o estado atual (preço/estoque) para aplicar com segurança.
type Body = {
  ids?: string[]
  action?: "publish" | "unpublish" | "price_set" | "stock_delta" | "stock_set"
  value?: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

export async function POST(req: Request) {
  const { ids, action, value } = (await req.json()) as Body
  if (!ids?.length || !action) {
    return NextResponse.json({ error: "ids e action são obrigatórios" }, { status: 400 })
  }

  const precisaValor = action === "price_set" || action === "stock_delta" || action === "stock_set"
  if (precisaValor && typeof value !== "number") {
    return NextResponse.json({ error: "valor obrigatório para esta ação" }, { status: 400 })
  }

  try {
    const setIds = new Set(ids)
    let afetados = 0

    if (action === "publish" || action === "unpublish") {
      const status = action === "publish" ? "published" : "draft"
      for (const id of ids) {
        await medusaUpdateProductStatus(id, status)
        afetados++
      }
      return NextResponse.json({ ok: true, afetados })
    }

    // ações que dependem do estado atual das variantes
    const produtos = (await medusaListProducts()).filter((p) => setIds.has(p.id))
    for (const p of produtos) {
      for (const v of p.variants) {
        if (action === "price_set") {
          const novo = round2(value as number)
          if (novo >= 0 && novo !== v.price) {
            await medusaUpdateVariantPrice(p.id, v.id, novo)
            afetados++
          }
        } else if (action === "stock_delta") {
          if (!v.inventory_item_id || v.stock == null) continue
          const novo = Math.max(0, v.stock + (value as number))
          if (novo !== v.stock) {
            await medusaUpdateStock(v.inventory_item_id, novo)
            afetados++
          }
        } else if (action === "stock_set") {
          if (!v.inventory_item_id) continue
          const novo = Math.max(0, Math.round(value as number))
          if (novo !== v.stock) {
            await medusaUpdateStock(v.inventory_item_id, novo)
            afetados++
          }
        }
      }
    }
    return NextResponse.json({ ok: true, afetados })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
