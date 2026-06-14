import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Mensagens de uma conversa (ordem cronológica). Marca como lida ao abrir.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const res = await sb(
    `message?conversation_id=eq.${id}&select=id,direcao,tipo,texto,media_url,media_mime,timestamp,origem,status&order=timestamp.asc`
  )
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }
  const messages = await res.json()

  // zera não-lidas
  await sb(`conversation?id=eq.${id}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ nao_lidas: 0 }),
  })

  return NextResponse.json(messages)
}
