import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

const CAMPOS = ["ativo", "aviso_jid", "janela_inicio", "janela_fim", "max_por_dia", "atraso_max_min", "falhas_seguidas"]

// PUT /api/clube/config — atualiza a configuração global (master switch, janela, tetos).
export async function PUT(req: Request) {
  const body = (await req.json()) as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  for (const k of CAMPOS) if (k in body) fields[k] = body[k]
  if (typeof fields.aviso_jid === "string") fields.aviso_jid = fields.aviso_jid.replace(/\D/g, "") || null
  if (fields.ativo === true) fields.falhas_seguidas = 0 // religar zera o contador de falhas
  const r = await sb("clube_config?id=eq.1", {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(fields),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? {})
}
