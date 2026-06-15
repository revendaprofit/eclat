import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Preço de CUSTO (COGS) por variação — vive no Supabase (financeiro), em centavos.
// GET → mapa { [variant_id]: custo_centavos }. POST → upsert de uma ou várias variações.

export async function GET() {
  const r = await sb("produto_custo?select=medusa_variant_id,custo_centavos")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as { medusa_variant_id: string; custo_centavos: number }[]
  const map: Record<string, number> = {}
  rows.forEach((row) => (map[row.medusa_variant_id] = row.custo_centavos))
  return NextResponse.json(map)
}

type Item = { variant_id: string; sku?: string | null; custo_centavos: number }

export async function POST(req: Request) {
  const body = (await req.json()) as { items?: Item[] } | Item
  const items: Item[] = Array.isArray((body as { items?: Item[] }).items)
    ? (body as { items: Item[] }).items
    : [body as Item]

  const rows = items
    .filter((i) => i.variant_id && Number.isInteger(i.custo_centavos) && i.custo_centavos >= 0)
    .map((i) => ({
      medusa_variant_id: i.variant_id,
      sku: i.sku ?? null,
      custo_centavos: i.custo_centavos,
      updated_at: new Date().toISOString(),
    }))
  if (rows.length === 0)
    return NextResponse.json({ error: "nenhum custo válido" }, { status: 400 })

  // upsert por medusa_variant_id (unique)
  const r = await sb("produto_custo?on_conflict=medusa_variant_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true, afetados: rows.length })
}
