import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Lista os leads (com a conversa vinculada, se houver).
export async function GET() {
  const res = await sb(
    "lead?select=id,nome,whatsapp,email,origem,status,notas,medusa_customer_id,created_at,conversation(id)&order=created_at.desc"
  )
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
  return NextResponse.json(await res.json())
}

// Captação: cria um lead manualmente.
export async function POST(req: Request) {
  const body = (await req.json()) as Record<string, string>
  if (!body.nome?.trim()) {
    return NextResponse.json({ error: "nome obrigatório" }, { status: 400 })
  }
  const res = await sb("lead", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      nome: body.nome.trim(),
      whatsapp: body.whatsapp || null,
      email: body.email || null,
      origem: body.origem || null,
      status: "novo",
    }),
  })
  if (!res.ok) return NextResponse.json({ error: await res.text() }, { status: 500 })
  const data = await res.json()
  return NextResponse.json(Array.isArray(data) ? data[0] : data)
}
