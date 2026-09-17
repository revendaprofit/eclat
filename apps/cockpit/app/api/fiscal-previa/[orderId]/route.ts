import { NextResponse } from "next/server"
import { medusaAdmin } from "@/lib/medusa"
import { ehIdDePedido } from "@/lib/fiscal"

// I1 (achado importante da revisão final de 2026-09-17): o roteiro de homologação manda fazer
// "prévia de venda" pelo Cockpit, mas `previa` só existia em POST /admin/fiscal/emitir, e
// `emitir` fica de propósito FORA da allowlist do proxy genérico /api/fiscal/* (essa rota
// transmite nota de verdade à SEFAZ — ver o comentário em lib/fiscal.ts). Esta rota dedicada, no
// padrão de app/api/fiscal-danfe/[id]/route.ts, é o único caminho do navegador até /admin/fiscal/
// emitir, e o corpo que ela manda é FIXO no servidor: `previa: true` sempre, nunca controlável
// pelo cliente. O orderId é validado ANTES de qualquer chamada — ele é o único segmento variável
// de um caminho que recebe o token de admin.
export async function GET(_req: Request, ctx: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await ctx.params
  if (!ehIdDePedido(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 })
  }
  try {
    const r = await medusaAdmin("/admin/fiscal/emitir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order_id: orderId, previa: true }),
    })
    if (!r.ok) {
      const data = await r.json().catch(() => ({}))
      return NextResponse.json(data, { status: r.status })
    }
    const data = await r.json()
    return new NextResponse(data?.previa?.xml ?? "", {
      status: 200,
      headers: { "Content-Type": "application/xml; charset=utf-8" },
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
