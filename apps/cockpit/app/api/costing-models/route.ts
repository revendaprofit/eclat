import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Catálogo de modelos (moldes). GET lista; POST cria/atualiza por nome.

export async function GET() {
  const r = await sb("costing_model?select=*&order=name.asc")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const body = await req.json()
  const row = {
    name: String(body.name || "").trim(),
    category: body.category || null,
    reference_image_url: body.reference_image_url || null,
    notes: body.notes || null,
  }
  if (!row.name)
    return NextResponse.json({ error: "name é obrigatório" }, { status: 400 })
  const r = await sb("costing_model?on_conflict=name", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}
