import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { validarConfigAvaliacao } from "@/lib/avaliacao"

// PUT /api/avaliacoes/config — interruptor, dias e textos do pedido de avaliação.
export async function PUT(req: Request) {
  const v = validarConfigAvaliacao((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if ("erro" in v) return NextResponse.json({ error: v.erro }, { status: 400 })
  const r = await sb("avaliacao_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...v.campos, updated_at: new Date().toISOString() }),
  })
  if (!r.ok) return NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  return NextResponse.json((await r.json())[0] ?? {})
}
