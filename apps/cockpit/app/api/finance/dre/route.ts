import { NextResponse } from "next/server"
import { medusaOrdersForDre } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"
import { taxasDePagamento } from "@/lib/pagamento"
import { PAGAMENTOS_CONFIRMADOS } from "@/lib/pagamento-despacho"

// DRE do período (tudo em CENTAVOS):
//   Receita produtos + Frete − COGS − Taxas de pagamento − Despesas = Resultado
// Receita = pedidos PAGOS ou AUTORIZADOS (exclui cancelados). Frete = linha separada (neutro).
// Taxas de pagamento = tarifa REAL cobrada pelo gateway em cada pedido (Parte 4, spec §10) —
// despesa financeira, não COGS (decisão de 2026-06-15).
const reais2cent = (v: number) => Math.round((v ?? 0) * 100)

export async function GET(req: Request) {
  const u = new URL(req.url)
  const de = u.searchParams.get("de")
  const ate = u.searchParams.get("ate")
  if (!de || !ate) return NextResponse.json({ error: "informe de e ate" }, { status: 400 })

  try {
    // 1) pedidos qualificados
    const orders = (await medusaOrdersForDre(de, ate)).filter(
      (o) => o.status !== "canceled" && PAGAMENTOS_CONFIRMADOS.has(o.payment_status)
    )

    // 2) custos (COGS) — mapa variant_id → centavos
    const cr = await sb("produto_custo?select=medusa_variant_id,custo_centavos")
    const custoMap: Record<string, number> = {}
    if (cr.ok)
      for (const row of (await cr.json()) as { medusa_variant_id: string; custo_centavos: number }[])
        custoMap[row.medusa_variant_id] = row.custo_centavos

    let receita = 0
    let frete = 0
    let cogs = 0
    let itensSemCusto = 0
    for (const o of orders) {
      receita += reais2cent(o.item_subtotal)
      frete += reais2cent(o.shipping_total)
      for (const it of o.items ?? []) {
        const c = it.variant_id ? custoMap[it.variant_id] : undefined
        if (c == null) itensSemCusto += it.quantity
        else cogs += c * it.quantity
      }
    }

    // 3) despesas do período (por categoria)
    const dr = await sb(
      `finance_expense?select=valor_centavos,finance_expense_category(nome)&data=gte.${de}&data=lte.${ate}`
    )
    let despesas = 0
    const porCategoria: Record<string, number> = {}
    if (dr.ok)
      for (const e of (await dr.json()) as {
        valor_centavos: number
        finance_expense_category: { nome: string } | null
      }[]) {
        despesas += e.valor_centavos
        const k = e.finance_expense_category?.nome ?? "Sem categoria"
        porCategoria[k] = (porCategoria[k] ?? 0) + e.valor_centavos
      }

    // 4) taxas de pagamento (tarifa real gravada pelo provider em cada pagamento)
    const taxas = taxasDePagamento(orders)

    const lucro_bruto = receita - cogs
    const resultado = receita + frete - cogs - taxas.total_centavos - despesas
    const margem_bruta = receita > 0 ? lucro_bruto / receita : 0

    return NextResponse.json({
      periodo: { de, ate },
      pedidos: orders.length,
      receita_produtos: receita,
      frete,
      cogs,
      lucro_bruto,
      margem_bruta,
      taxas_pagamento: taxas.total_centavos,
      pagamentos_sem_tarifa: taxas.sem_tarifa,
      despesas,
      despesas_por_categoria: porCategoria,
      resultado,
      itens_sem_custo: itensSemCusto,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
