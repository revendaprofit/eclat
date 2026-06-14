import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { sendWhatsappText } from "@/lib/evolution"

// Envia uma mensagem de texto pelo WhatsApp e registra como message (out).
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { text } = (await req.json()) as { text?: string }

  if (!text?.trim()) {
    return NextResponse.json({ error: "texto vazio" }, { status: 400 })
  }

  // descobre o contato da conversa
  const cRes = await sb(`conversation?id=eq.${id}&select=contato_e164&limit=1`)
  const conv = (await cRes.json()) as Array<{ contato_e164: string }>
  const numero = conv?.[0]?.contato_e164
  if (!numero) {
    return NextResponse.json({ error: "conversa não encontrada" }, { status: 404 })
  }

  // envia via Evolution
  const sent = await sendWhatsappText(numero, text)
  if (!sent.ok) {
    return NextResponse.json({ error: `Evolution: ${sent.error}` }, { status: 502 })
  }

  // registra a mensagem (out). Idempotente pelo id da Evolution (evita duplicar com o webhook).
  await sb("message?on_conflict=evolution_msg_id", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    body: JSON.stringify({
      conversation_id: id,
      direcao: "out",
      tipo: "texto",
      texto: text,
      origem: "humano",
      status: "sent",
      timestamp: new Date().toISOString(),
      evolution_msg_id: sent.evolutionMsgId ?? `local-${Date.now()}`,
    }),
  })

  return NextResponse.json({ ok: true })
}
