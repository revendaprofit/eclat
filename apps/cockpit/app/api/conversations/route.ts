import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// Lista as conversas (mais recentes primeiro).
export async function GET() {
  const res = await sb(
    "conversation?select=id,contato_e164,nome_contato,alvo_tipo,nao_lidas,ultima_msg_em,lead_id&order=ultima_msg_em.desc.nullslast"
  )
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }
  return NextResponse.json(await res.json())
}
