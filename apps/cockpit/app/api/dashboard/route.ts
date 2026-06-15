import { NextResponse } from "next/server"
import { medusaListOrders, medusaListProducts, medusaListCustomers } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"

// Consolida as filas de ação do dia (Fase 6). Tudo em uma chamada server-side.
const ESTOQUE_BAIXO = 5
const PAGOS = new Set(["captured", "authorized", "partially_captured"])
const REATIVACAO_DIAS = 60

export async function GET() {
  try {
    const [orders, produtos, customers] = await Promise.all([
      medusaListOrders(),
      medusaListProducts(),
      medusaListCustomers(),
    ])

    // vendas de hoje (faturamento de pedidos pagos/autorizados criados hoje)
    const hoje = new Date().toLocaleDateString("en-CA") // YYYY-MM-DD local
    let vendasHojePedidos = 0
    let vendasHojeReceita = 0
    let aEnviar = 0
    const ultimoPedidoPorCliente = new Map<string, string>()
    const pedidosPorCliente = new Map<string, number>()
    for (const o of orders) {
      if (o.status !== "canceled" && PAGOS.has(o.payment_status)) {
        if ((o.created_at ?? "").slice(0, 10) === hoje) {
          vendasHojePedidos++
          vendasHojeReceita += Math.round((o.total ?? 0) * 100)
        }
        if (o.customer_id) {
          pedidosPorCliente.set(o.customer_id, (pedidosPorCliente.get(o.customer_id) ?? 0) + 1)
          const prev = ultimoPedidoPorCliente.get(o.customer_id)
          if (!prev || (o.created_at ?? "") > prev)
            ultimoPedidoPorCliente.set(o.customer_id, o.created_at ?? "")
        }
      }
      if (o.status !== "canceled" && o.fulfillment_status === "not_fulfilled") aEnviar++
    }

    // estoque baixo (variações ≤ 5)
    const estoqueBaixo: { produto: string; variacao: string; sku: string | null; estoque: number }[] = []
    for (const p of produtos)
      for (const v of p.variants)
        if (v.stock != null && v.stock <= ESTOQUE_BAIXO)
          estoqueBaixo.push({ produto: p.title, variacao: v.title ?? "", sku: v.sku, estoque: v.stock })
    estoqueBaixo.sort((a, b) => a.estoque - b.estoque)

    // reativação: clientes recorrentes (≥2) sem comprar há +60d
    const agora = Date.now()
    let reativacao = 0
    for (const c of customers) {
      const n = pedidosPorCliente.get(c.id) ?? 0
      const ult = ultimoPedidoPorCliente.get(c.id)
      if (n >= 2 && ult && (agora - new Date(ult).getTime()) / 86400000 > REATIVACAO_DIAS)
        reativacao++
    }

    // CRM (Supabase) — não falha o dashboard se recusar
    let leadsNovos = 0
    let conversasPendentes = 0
    try {
      const lr = await sb("lead?status=eq.novo&select=id")
      if (lr.ok) leadsNovos = ((await lr.json()) as unknown[]).length
      const cr = await sb("conversation?nao_lidas=gt.0&select=id")
      if (cr.ok) conversasPendentes = ((await cr.json()) as unknown[]).length
    } catch {
      /* opcional */
    }

    return NextResponse.json({
      vendas_hoje: { pedidos: vendasHojePedidos, receita_centavos: vendasHojeReceita },
      a_enviar: aEnviar,
      leads_novos: leadsNovos,
      conversas_pendentes: conversasPendentes,
      estoque_baixo: { count: estoqueBaixo.length, itens: estoqueBaixo.slice(0, 6) },
      reativacao,
      clientes_total: customers.length,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
