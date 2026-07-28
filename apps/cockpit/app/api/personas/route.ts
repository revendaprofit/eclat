import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Personas "Minha ÉCLAT". GET lista todas (inclui inativas); POST cria.

export async function GET() {
  const r = await sb("persona?select=*&order=ordem.asc")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const b = await req.json()
  const row = {
    slug: String(b.slug || "").trim().toLowerCase(),
    nome: String(b.nome || "").trim(),
    descricao: b.descricao || null,
    avatar_url: b.avatar_url || null,
    ordem: Number(b.ordem ?? 0),
    ativo: b.ativo !== false,
  }
  if (!row.slug || !row.nome) {
    return NextResponse.json({ error: "slug e nome são obrigatórios" }, { status: 400 })
  }
  const r = await sb("persona", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? { ok: true })
}
