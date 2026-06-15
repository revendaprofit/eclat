import { NextResponse } from "next/server"
import { medusaUpdateVariantPrice, medusaUpdateStock } from "@/lib/medusa"

// Atualiza preço (BRL) e/ou estoque de uma variante.
// Preço → Medusa Admin (variante). Estoque → inventory item / location level.
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; variantId: string }> }
) {
  const { id, variantId } = await params
  const body = (await req.json()) as {
    price?: number
    stock?: number
    inventory_item_id?: string
  }

  try {
    if (typeof body.price === "number") {
      if (!(body.price >= 0))
        return NextResponse.json({ error: "preço inválido" }, { status: 400 })
      await medusaUpdateVariantPrice(id, variantId, body.price)
    }
    if (typeof body.stock === "number") {
      if (!body.inventory_item_id)
        return NextResponse.json(
          { error: "inventory_item_id obrigatório para ajustar estoque" },
          { status: 400 }
        )
      if (!(body.stock >= 0) || !Number.isInteger(body.stock))
        return NextResponse.json({ error: "estoque inválido" }, { status: 400 })
      await medusaUpdateStock(body.inventory_item_id, body.stock)
    }
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
