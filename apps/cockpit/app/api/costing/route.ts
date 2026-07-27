import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Fichas de pré-custo (costing_piece). GET lista (com itens); POST cria peça.

export async function GET() {
  const r = await sb(
    "costing_piece?select=*,costing_item(*)&order=collection.asc,name.asc"
  )
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const body = await req.json()
  const row = {
    name: String(body.name || "").trim(),
    collection: body.collection || null,
    reference_image_url: body.reference_image_url || null,
    notes: body.notes || null,
  }
  if (!row.name)
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
  const r = await sb("costing_piece", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}
