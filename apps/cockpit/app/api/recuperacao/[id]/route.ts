import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// POST /api/recuperacao/[id] — a equipe tira essa pessoa da automação (nada mais é enviado).
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = await sb(`recuperacao?id=eq.${encodeURIComponent(id)}&etapa=neq.encerrada`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ etapa: "encerrada", motivo_fim: "parado_pela_equipe", atualizado_em: new Date().toISOString() }),
  })
  if (!r.ok) return NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
