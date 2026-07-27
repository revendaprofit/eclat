import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Coleção de custo: PATCH (nome/status/parâmetros), DELETE (fichas ficam órfãs).

const FIELDS = [
  "name",
  "launch_date",
  "status",
  "perda_pct",
  "imposto_pct",
  "taxa_pagamento_pct",
  "marketing_pct",
  "frete_embalagem_centavos",
  "markup",
  "notes",
] as const

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of FIELDS) if (k in body) patch[k] = body[k]
  const r = await sb(`costing_collection?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`costing_collection?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
