import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

export async function GET() {
  const r = await sb("finance_expense_category?select=id,nome&order=nome.asc")
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  return NextResponse.json(await r.json())
}

export async function POST(req: Request) {
  const { nome } = (await req.json()) as { nome?: string }
  if (!nome?.trim()) return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })
  const r = await sb("finance_expense_category", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ nome: nome.trim() }),
  })
  if (!r.ok) return NextResponse.json({ error: await r.text() }, { status: 502 })
  const d = await r.json()
  return NextResponse.json(Array.isArray(d) ? d[0] : d)
}
