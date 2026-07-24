import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Editorial (tabela editorial_post). GET lista tudo (inclui rascunhos);
// POST cria. Escrita via service_role (bypassa RLS).

export async function GET() {
  const r = await sb(
    "editorial_post?select=id,slug,title,excerpt,cover_url,tags,status,published_at,updated_at&order=updated_at.desc"
  )
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const body = await req.json()
  const now = new Date().toISOString()
  const row = {
    slug: String(body.slug || "").trim(),
    title: String(body.title || "").trim(),
    excerpt: body.excerpt || null,
    body_md: body.body_md || "",
    cover_url: body.cover_url || null,
    tags: Array.isArray(body.tags) ? body.tags : [],
    status: body.status === "published" ? "published" : "draft",
    published_at: body.status === "published" ? now : null,
    updated_at: now,
  }
  if (!row.slug || !row.title) {
    return NextResponse.json(
      { error: "slug e title são obrigatórios" },
      { status: 400 }
    )
  }
  const r = await sb("editorial_post", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? { ok: true })
}
