import { NextResponse } from "next/server"
import { medusaAdmin, medusaMergeOrderMetadata } from "@/lib/medusa"
import { carrierCustoDoFrete } from "@/lib/shipping"

// Busca na SuperFrete o custo das etiquetas já pagas que ainda não têm `metadata.frete.custo_centavos`
// (sócia, 29/10: o frete pago pela empresa entra no DRE). Só consulta (GET order/info), nunca gasta saldo.
// Botão no Financeiro quando o DRE aponta etiquetas sem custo.
type Pedido = { id: string; display_id: number; metadata?: { frete?: Record<string, unknown> | null } | null }

export async function POST() {
  const r = await medusaAdmin(`/admin/orders?limit=1000&order=-created_at&fields=id,display_id,metadata`)
  if (!r.ok) return NextResponse.json({ error: `pedidos falhou (HTTP ${r.status})` }, { status: 502 })
  const pedidos = ((await r.json()).orders ?? []) as Pedido[]
  const resultado: { display_id: number; custo_centavos?: number; erro?: string }[] = []
  for (const p of pedidos) {
    const f = p.metadata?.frete
    if (!f || f.status !== "paga" || typeof f.superfrete_id !== "string" || typeof f.custo_centavos === "number") continue
    try {
      const { custo_centavos } = await carrierCustoDoFrete(f.superfrete_id)
      if (custo_centavos === undefined) {
        resultado.push({ display_id: p.display_id, erro: "SuperFrete não devolveu o preço" })
        continue
      }
      await medusaMergeOrderMetadata(p.id, { frete: { ...f, custo_centavos } })
      resultado.push({ display_id: p.display_id, custo_centavos })
    } catch (e) {
      resultado.push({ display_id: p.display_id, erro: (e as Error).message })
    }
  }
  return NextResponse.json({ atualizados: resultado.filter((x) => x.custo_centavos !== undefined).length, resultado })
}
