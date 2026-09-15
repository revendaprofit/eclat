import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// PATCH /api/clube/mensagens/:id — editar texto/mídia/horário ou mudar status:
//   { acao: "aprovar" | "descartar" | "rascunho" | "enviar_agora" } ou campos { texto, titulo, midia, enviar_em }
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const b = (await req.json()) as Record<string, unknown>
  const fields: Record<string, unknown> = {}
  const agora = new Date().toISOString()
  for (const k of ["texto", "titulo", "midia", "enviar_em"]) if (k in b) fields[k] = b[k] === "" ? null : b[k]
  switch (b.acao) {
    case "aprovar":
      Object.assign(fields, { status: "aprovada", aprovado_em: agora, erro: null })
      break
    case "enviar_agora":
      Object.assign(fields, { status: "aprovada", aprovado_em: agora, enviar_em: agora, erro: null, dados: { ...((b.dados as object) || {}), jitter_aplicado: true } })
      break
    case "descartar":
      fields.status = "descartada"
      break
    case "rascunho":
      Object.assign(fields, { status: "rascunho", aprovado_em: null, erro: null })
      break
  }
  if (!Object.keys(fields).length) return NextResponse.json({ error: "nada para alterar" }, { status: 400 })
  const r = await sb(`clube_mensagens?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(fields),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const rows = await r.json()
  return NextResponse.json(rows[0] ?? {})
}
