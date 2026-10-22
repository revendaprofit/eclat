import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { enviarERegistrar } from "@/lib/whatsapp-registro"
import { PAGAMENTOS, textoLembretePagamento, textoUnboxing, type Pagamento, type VendaExterna } from "@/lib/venda-externa"

// Ações sobre uma venda fora do site:
//   { acao: "pago" }       marca como paga (para a cobrança)
//   { acao: "lembrar" }    manda o lembrete de pagamento agora (além do automático das 9h)
//   { acao: "unboxing" }   manda o convite ao unboxing agora
//   { acao: "cancelar" }   cancela (não devolve estoque sozinho: a equipe ajusta em Produtos, se for o caso)
//   { acao: "editar", pagamento?, pago?, vencimento?, observacoes? }
//                          sócia, 2026-10-22: "pode chegar o dia do pagamento e acontecer algo" — muda forma, paga/não
//                          paga, data combinada e observações. Data nova zera o lembrete (sai de novo no novo dia).
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = (await req.json().catch(() => ({}))) as { acao?: string; pagamento?: string; pago?: boolean; vencimento?: string | null; observacoes?: string | null }
  const { acao } = body
  const r = await sb(`venda_externa?id=eq.${encodeURIComponent(id)}&select=*&limit=1`)
  const v = r.ok ? ((await r.json()) as VendaExterna[])[0] : undefined
  if (!v) return NextResponse.json({ error: "Venda não encontrada." }, { status: 404 })
  const agora = new Date().toISOString()
  const patch = async (campos: Record<string, unknown>) => {
    const p = await sb(`venda_externa?id=eq.${encodeURIComponent(id)}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify(campos) })
    return p.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: `Supabase ${p.status}` }, { status: 502 })
  }
  if (acao === "pago") return patch({ pago: true, pago_em: agora })
  if (acao === "editar") {
    const campos: Record<string, unknown> = {}
    if (body.pagamento !== undefined) {
      if (!PAGAMENTOS.some((p) => p.id === body.pagamento)) return NextResponse.json({ error: "Forma de pagamento inválida." }, { status: 400 })
      if (body.pagamento === "cartao" && v.pagamento !== "cartao") return NextResponse.json({ error: "Para mudar para cartão, cancele e lance de novo (precisa das parcelas e da taxa)." }, { status: 400 })
      campos.pagamento = body.pagamento as Pagamento
      if (body.pagamento !== "cartao") {
        campos.parcelas = null
        campos.taxa_percentual = null
        campos.taxa_centavos = 0
        campos.liquido_centavos = v.total_centavos
      }
    }
    if (body.pago !== undefined) {
      campos.pago = !!body.pago
      campos.pago_em = body.pago ? agora : null
    }
    if (body.vencimento !== undefined) {
      if (body.vencimento && !/^\d{4}-\d{2}-\d{2}$/.test(body.vencimento)) return NextResponse.json({ error: "Data combinada inválida." }, { status: 400 })
      campos.vencimento = body.vencimento || null
      if (body.vencimento && body.vencimento !== v.vencimento) campos.lembrete_enviado_em = null
    }
    if (body.observacoes !== undefined) campos.observacoes = String(body.observacoes ?? "").trim() || null
    const pagoFinal = campos.pago !== undefined ? campos.pago : v.pago
    const vencFinal = campos.vencimento !== undefined ? campos.vencimento : v.vencimento
    if (!pagoFinal && !vencFinal) return NextResponse.json({ error: "Venda em aberto precisa da data combinada do pagamento (é ela que dispara o lembrete)." }, { status: 400 })
    if (!Object.keys(campos).length) return NextResponse.json({ error: "Nada para mudar." }, { status: 400 })
    return patch(campos)
  }
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
