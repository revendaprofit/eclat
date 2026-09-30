import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { chaveContato, normalizarContato, primeiroNome } from "@/lib/avaliacao"

// POST /api/avaliacoes/manual { conversation_id, pecas? } — botão "Pedir avaliação" da conversa, para quem
// comprou fora do site. Cria o pedido já na fila (etapa agendada, a partir de agora); o backend envia
// respeitando os mesmos freios (horário, intervalo, teto diário) na próxima rodada, com o pedido de
// avaliação ligado.
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { conversation_id?: string; pecas?: string }
  if (!body.conversation_id) return NextResponse.json({ error: "Conversa não informada" }, { status: 400 })
  const rc = await sb(`conversation?id=eq.${encodeURIComponent(body.conversation_id)}&select=id,contato_e164,nome_contato`)
  const conv = rc.ok ? (await rc.json())[0] : null
  if (!conv) return NextResponse.json({ error: "Conversa não encontrada" }, { status: 404 })
  const contato = normalizarContato(conv.contato_e164)
  const chave = chaveContato(conv.contato_e164)
  if (!contato || !chave) return NextResponse.json({ error: "O número dessa conversa não é um celular do Brasil" }, { status: 400 })

  const desde = new Date(Date.now() - 60 * 86400000).toISOString()
  const rr = await sb(`avaliacao?contato_chave=eq.${chave}&criado_em=gte.${encodeURIComponent(desde)}&select=id&limit=1`)
  if (!rr.ok) {
    return NextResponse.json({ error: rr.status === 404 ? "Aplicar a migration 0015 antes." : `Supabase ${rr.status}` }, { status: 502 })
  }
  if ((await rr.json()).length) return NextResponse.json({ error: "Já pedimos avaliação a ela nos últimos 60 dias." }, { status: 409 })

  const pecas = String(body.pecas ?? "").trim().slice(0, 80) || "as peças"
  const r = await sb("avaliacao", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      origem: "manual",
      contato,
      contato_chave: chave,
      nome: primeiroNome(conv.nome_contato),
      pecas,
      conversation_id: conv.id,
      elegivel_em: new Date().toISOString(),
    }),
  })
  if (!r.ok) return NextResponse.json({ error: `Supabase ${r.status}` }, { status: 502 })
  return NextResponse.json({ ok: true })
}
