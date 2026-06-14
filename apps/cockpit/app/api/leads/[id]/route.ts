import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

const CAMPOS = ["status", "notas", "nome", "email", "origem", "whatsapp", "responsavel"]

// Atualiza campos do lead (ex.: mover de estágio no Kanban, editar notas).
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await req.json()) as Record<string, unknown>
  const patch: Record<string, unknown> = {}
  for (const k of CAMPOS) if (k in body) patch[k] = body[k]
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "nada para atualizar" }, { status: 400 })
  }
  const res = await sb(`lead?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(patch),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
  return NextResponse.json({ ok: true })
}
