import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Fichas de pré-custo (costing_piece). GET lista (com itens); POST cria peça.

export async function GET() {
  const r = await sb(
    "costing_piece?select=*,costing_item(*),costing_model(name,category,reference_image_url)&order=name.asc"
  )
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const body = await req.json()
  const row: Record<string, unknown> = {
    name: String(body.name || "").trim(),
    collection_id: body.collection_id || null,
    model_id: body.model_id || null,
    colorway: body.colorway || null,
    reference_image_url: body.reference_image_url || null,
    notes: body.notes || null,
  }
  if (!row.name)
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
  // herda os parâmetros padrão da coleção
  if (row.collection_id) {
    const rc = await sb(
      `costing_collection?id=eq.${encodeURIComponent(String(row.collection_id))}&select=perda_pct,imposto_pct,taxa_pagamento_pct,marketing_pct,frete_embalagem_centavos,markup`
    )
    if (rc.ok) {
      const [col] = (await rc.json()) as Record<string, unknown>[]
      if (col) Object.assign(row, col)
    }
  }
  const r = await sb("costing_piece", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}
