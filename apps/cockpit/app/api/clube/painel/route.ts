import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"

// Painel do Clube: proxy do backend (GET /admin/clube) — config, regras, conexão, fila, estoque, pedidos.
export async function GET() {
  const r = await medusaAdmin("/admin/clube")
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: d?.message || d?.error || `Medusa ${r.status}` }, { status: 502 })
  return NextResponse.json(d)
}
