import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { nome } = (await req.json()) as { nome?: string }
  if (!nome?.trim()) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })
  const r = await sb(`finance_expense_category?id=eq.${id}`, {
    method: "PATCH",
    body: JSON.stringify({ nome: nome.trim() }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const r = await sb(`finance_expense_category?id=eq.${id}`, { method: "DELETE" })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json({ ok: true })
}
