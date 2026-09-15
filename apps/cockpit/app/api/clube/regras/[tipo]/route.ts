import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

const CAMPOS = ["ativa", "modo", "template", "limiar", "cooldown_horas", "agrupar", "anexar_foto"]

// PUT /api/clube/regras/:tipo — liga/desliga, modo automático/aprovar, template, limiar, cooldown.
export async function PUT(req: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params
  const body = (await req.json()) as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  for (const k of CAMPOS) if (k in body) fields[k] = body[k]
  const r = await sb(`clube_regras?tipo=eq.${encodeURIComponent(tipo)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(fields),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? {})
}
