import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Editorial: GET (um post, p/ edição), PATCH (atualiza), DELETE.

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`editorial_post?id=eq.${encodeURIComponent(id)}&select=*`)
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  if (!rows[0]) return NextResponse.json({ error: "não encontrado" }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = await req.json()
  const now = new Date().toISOString()

  const patch: Record<string, unknown> = { updated_at: now }
  for (const k of ["slug", "title", "excerpt", "body_md", "cover_url", "tags"]) {
    if (k in body) patch[k] = body[k]
  }
  if ("status" in body) {
    patch.status = body.status === "published" ? "published" : "draft"
    if (patch.status === "published") {
      // mantém a data original se o cliente enviar; senão é a 1ª publicação
      patch.published_at = body.published_at || now
    } else {
      patch.published_at = null
    }
  }

  const r = await sb(`editorial_post?id=eq.${encodeURIComponent(id)}`, {
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
  const r = await sb(`editorial_post?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
