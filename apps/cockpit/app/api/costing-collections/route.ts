import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Coleções/famílias de custo. GET lista; POST cria (com parâmetros padrão).

export async function GET() {
  const r = await sb("costing_collection?select=*&order=created_at.desc")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

const PARAM_FIELDS = [
  "perda_pct",
  "imposto_pct",
  "taxa_pagamento_pct",
  "marketing_pct",
  "frete_embalagem_centavos",
  "markup",
] as const

export async function POST(req: Request) {
  const body = await req.json()
  const row: Record<string, unknown> = {
    name: String(body.name || "").trim(),
    launch_date: body.launch_date || null,
    notes: body.notes || null,
  }
  if (!row.name)
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
  for (const k of PARAM_FIELDS) if (k in body) row[k] = body[k]
  const r = await sb("costing_collection", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}
