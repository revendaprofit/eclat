import { NextResponse } from "next/server"
import { medusaCreateProduct, type NewProductInput } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"

// Cria um produto novo (com variantes + estoque inicial) via Medusa Admin API.
// custo_centavos (opcional) é salvo no Supabase para todas as variações criadas.
export async function POST(req: Request) {
  const input = (await req.json()) as NewProductInput & { custo_centavos?: number }
  if (!input.title?.trim())
    return NextResponse.json({ error: "título obrigatório" }, { status: 400 })
  if (!input.handle?.trim())
    return NextResponse.json({ error: "handle obrigatório" }, { status: 400 })
  if (!input.variants?.length)
    return NextResponse.json({ error: "ao menos uma variação é necessária" }, { status: 400 })
  try {
    const product = await medusaCreateProduct(input)

    const custo = input.custo_centavos
    if (typeof custo === "number" && Number.isInteger(custo) && custo >= 0) {
      const rows = product.variants.map((v) => ({
        medusa_variant_id: v.id,
        sku: v.sku,
        custo_centavos: custo,
        updated_at: new Date().toISOString(),
      }))
      if (rows.length)
        await sb("produto_custo?on_conflict=medusa_variant_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        })
    }
    return NextResponse.json({ id: product.id })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
