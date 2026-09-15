import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"

// POST /api/clube/preview { texto, midia?, dados? } → prévia com dados de agora (proxy do backend)
export async function POST(req: Request) {
  const body = await req.json()
  const r = await medusaAdmin("/admin/clube/preview", { method: "POST", body: JSON.stringify(body) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: d?.message || d?.error || `Medusa ${r.status}` }, { status: 502 })
  return NextResponse.json(d)
}
