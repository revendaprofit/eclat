import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Persona: PATCH atualiza; DELETE remove (mídias caem em cascata).

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const b = await req.json()
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ["slug", "nome", "descricao", "avatar_url", "ordem", "ativo"]) {
    if (k in b) patch[k] = b[k]
  }
  const r = await sb(`persona?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(patch),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`persona?id=eq.${encodeURIComponent(id)}`, { method: "DELETE" })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
