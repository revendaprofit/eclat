import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const b = (await req.json()) as Record<string, unknown>
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const k of ["data", "categoria_id", "descricao", "valor_centavos", "fornecedor", "recorrencia"])
    if (k in b) patch[k] = b[k]
  const r = await sb(`finance_expense?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`finance_expense?id=eq.${id}`, { method: "DELETE" })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
