import { NextResponse } from "next/server"
import { medusaListCustomers, medusaListOrders } from "@/lib/medusa"

// Lista clientes (Medusa) + agrega nº de pedidos e total gasto a partir dos pedidos.
export async function GET() {
  try {
    const [customers, orders] = await Promise.all([
      medusaListCustomers(),
      medusaListOrders(),
    ])
    const agg = new Map<string, { pedidos: number; total: number; ultimo: string | null }>()
    for (const o of orders) {
      if (!o.customer_id) continue
      const a = agg.get(o.customer_id) ?? { pedidos: 0, total: 0, ultimo: null }
      a.pedidos++
      a.total += o.total ?? 0
      if (!a.ultimo || (o.created_at ?? "") > a.ultimo) a.ultimo = o.created_at ?? null
      agg.set(o.customer_id, a)
    }
    const out = customers.map((c) => ({
      ...c,
      pedidos: agg.get(c.id)?.pedidos ?? 0,
      total_gasto: agg.get(c.id)?.total ?? 0,
      ultimo_pedido_em: agg.get(c.id)?.ultimo ?? null,
    }))
    return NextResponse.json(out)
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
