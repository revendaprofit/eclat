import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { enviarERegistrar } from "@/lib/whatsapp-registro"
import { textoLembretePagamento, textoUnboxing, type VendaExterna } from "@/lib/venda-externa"

// Ações sobre uma venda fora do site:
//   { acao: "pago" }       marca como paga (para a cobrança)
//   { acao: "lembrar" }    manda o lembrete de pagamento agora (além do automático das 9h)
//   { acao: "unboxing" }   manda o convite ao unboxing agora
//   { acao: "cancelar" }   cancela (não devolve estoque sozinho: a equipe ajusta em Produtos, se for o caso)
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { acao } = (await req.json().catch(() => ({}))) as { acao?: string }
  const r = await sb(`venda_externa?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
  const v = r.ok ? ((await r.json()) as VendaExterna[])[0] : undefined
  if (!v) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 })
  const agora = new Date().toISOString()
  const patch = async (campos: Record<string, unknown>) => {
    const p = await sb(`venda_externa?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos) })
    return p.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `Supabase ${p.status}` }, { status: 502 })
  }
  if (acao === "pago") return patch({ pago: true, pago_em: agora })
  if (acao === "cancelar") return patch({ cancelada_em: agora })
  if (acao === "lembrar") {
    if (v.pago) return NextResponse.json({ error: "Esta venda já está paga." }, { status: 400 })
    const env = await enviarERegistrar({ numero: v.cliente_whatsapp, texto: textoLembretePagamento(v.cliente_nome, v.total_centavos, v.vencimento ?? v.data), nome: v.cliente_nome, medusa_customer_id: v.medusa_customer_id })
    if (!env.ok) return NextResponse.json({ error: env.error ?? "WhatsApp falhou" }, { status: 502 })
    return patch({ lembrete_enviado_em: agora })
  }
  if (acao === "unboxing") {
    const env = await enviarERegistrar({ numero: v.cliente_whatsapp, texto: textoUnboxing(v.cliente_nome), nome: v.cliente_nome, medusa_customer_id: v.medusa_customer_id })
    if (!env.ok) return NextResponse.json({ error: env.error ?? "WhatsApp falhou" }, { status: 502 })
    return patch({ unboxing_enviado_em: agora })
  }
  return NextResponse.json({ error: "Ação desconhecida." }, { status: 400 })
}
