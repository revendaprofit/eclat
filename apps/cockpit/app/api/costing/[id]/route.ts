import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Ficha de pré-custo: GET (peça+itens), PATCH (campos + substitui BOM), DELETE.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(
    `costing_piece?id=eq.${encodeURIComponent(id)}&select=*,costing_item(*)`
  )
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  if (!rows[0]) return NextResponse.json({ error: "não encontrada" }, { status: 404 })
  return NextResponse.json(rows[0])
}

const PIECE_FIELDS = [
  "name",
  "collection",
  "reference_image_url",
  "status",
  "faccao_centavos",
  "estampa_centavos",
  "modelagem_total_centavos",
  "modelagem_pecas",
  "perda_pct",
  "imposto_pct",
  "taxa_pagamento_pct",
  "marketing_pct",
  "frete_embalagem_centavos",
  "markup",
  "preco_venda_centavos",
  "medusa_variant_ids",
  "notes",
] as const

type ItemInput = {
  kind?: string
  name?: string
  unit?: string
  consumption?: number
  unit_price_centavos?: number
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of PIECE_FIELDS) if (k in body) patch[k] = body[k]

  const r = await sb(`costing_piece?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })

  // BOM: estratégia substituir-tudo (simples e à prova de drift)
  if (Array.isArray(body.items)) {
    const del = await sb(`costing_item?piece_id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
    if (!del.ok)
      return NextResponse.json({ error: await del.text() }, { status: 502 })
    const items = (body.items as ItemInput[])
      .filter((i) => i && String(i.name || "").trim())
      .map((i, idx) => ({
        piece_id: id,
        kind: ["material", "aviamento", "servico"].includes(String(i.kind))
          ? i.kind
          : "material",
        name: String(i.name).trim(),
        unit: ["kg", "m", "un"].includes(String(i.unit)) ? i.unit : "un",
        consumption: Number(i.consumption) || 0,
        unit_price_centavos: Math.max(0, Math.round(Number(i.unit_price_centavos) || 0)),
        position: idx,
      }))
    if (items.length) {
      const ins = await sb("costing_item", {
        method: "POST",
        headers: { Prefer: "return=minimal" },
        body: JSON.stringify(items),
      })
      if (!ins.ok)
        return NextResponse.json({ error: await ins.text() }, { status: 502 })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`costing_piece?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
