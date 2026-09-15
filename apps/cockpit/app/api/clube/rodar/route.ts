import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"

// POST /api/clube/rodar — roda detector + entrega agora (sem esperar o ciclo de 5 min)
export async function POST() {
  const r = await medusaAdmin("/admin/clube", { method: "POST", body: JSON.stringify({ acao: "rodar" }) })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) return NextResponse.json({ error: d?.message || d?.error || `Medusa ${r.status}` }, { status: 502 })
  return NextResponse.json(d)
}
