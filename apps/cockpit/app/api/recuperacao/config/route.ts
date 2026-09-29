import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { validarConfig } from "@/lib/recuperacao"

// PUT /api/recuperacao/config — interruptores (WhatsApp, e-mail), persona, cupom, horário e limites.
export async function PUT(req: Request) {
  const v = validarConfig((await req.json().catch(() => ({}))) as Record<string, unknown>)
  if ("erro" in v) return NextResponse.json({ error: v.erro }, { status: 400 })
  const r = await sb("recuperacao_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ ...v.campos, updated_at: new Date().toISOString() }),
  })
  if (!r.ok) return NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  return NextResponse.json((await r.json())[0] ?? {})
}
