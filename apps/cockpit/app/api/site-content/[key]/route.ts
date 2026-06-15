import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Conteúdo editorial da vitrine (site_content). GET lê; PUT faz upsert por key.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const r = await sb(`site_content?key=eq.${encodeURIComponent(key)}&select=value`)
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as { value: unknown }[]
  return NextResponse.json(rows[0]?.value ?? {})
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params
  const value = await req.json()
  const r = await sb("site_content?on_conflict=key", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify({ key, value, updated_at: new Date().toISOString() }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
