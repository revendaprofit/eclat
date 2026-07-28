import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Fotos por produto × persona.
// GET ?product_id=... lista; PUT upsert {product_id, persona_id, images:[urls]}.

export async function GET(req: Request) {
  const url = new URL(req.url)
  const productId = url.searchParams.get("product_id")
  const q = productId
    ? `product_persona_media?product_id=eq.${encodeURIComponent(productId)}&select=*`
    : "product_persona_media?select=*&order=updated_at.desc&limit=200"
  const r = await sb(q)
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function PUT(req: Request) {
  const b = await req.json()
  const product_id = String(b.product_id || "").trim()
  const persona_id = String(b.persona_id || "").trim()
  const images = Array.isArray(b.images) ? b.images.filter(Boolean) : []
  if (!product_id || !persona_id) {
    return NextResponse.json(
      { error: "product_id e persona_id são obrigatórios" },
      { status: 400 }
    )
  }
  const r = await sb("product_persona_media?on_conflict=product_id,persona_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify({
      product_id,
      persona_id,
      images,
      updated_at: new Date().toISOString(),
    }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = (await r.json()) as unknown[]
  return NextResponse.json(rows[0] ?? { ok: true })
}
