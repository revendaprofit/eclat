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

    // 3b) vendas fora do site (Supabase venda_externa), pagas, pela data da venda — entram na receita e no COGS
    // (sócia, 2026-10-15). Tabela ausente (migration 0016 não aplicada) não derruba o DRE.
    let vendasForaSite = 0
    let receitaForaSite = 0
    let taxasForaSite = 0 // taxa da maquininha nas vendas no cartão (16/10): despesa financeira, como a do gateway
    // Peças para creators (sócia, 2026-10-22): o custo da peça NÃO é COGS, é marketing — linha própria, com o nome
    // da creator e as peças. Só o custo da peça entra (tudo o mais é combinado direto no WhatsApp, sem custo).
    let marketingCreators = 0
    const creators: { data: string; nome: string; pecas: string; custo_centavos: number }[] = []
    // Uso próprio (sócia, 2026-10-23): peças que a sócia pega para ela e para a família. Não é venda nem COGS:
    // o custo puro da peça sai numa linha própria, como as creators.
    let usoProprio = 0
    const usoProprioLista: { data: string; nome: string; pecas: string; custo_centavos: number }[] = []
    try {
      const vr = await sb(`venda_externa?select=data,cliente_nome,perfil,total_centavos,taxa_centavos,itens&pago=eq.true&cancelada_em=is.null&data=gte.${de}&data=lte.${ate}`)
      if (vr.ok)
        for (const v of (await vr.json()) as { data: string; cliente_nome: string; perfil?: string | null; total_centavos: number; taxa_centavos?: number | null; itens: { variant_id: string; produto?: string; variacao?: string | null; quantidade: number }[] }[]) {
          vendasForaSite++
          receitaForaSite += v.total_centavos
          taxasForaSite += v.taxa_centavos ?? 0
          const ehCreator = v.perfil === "creator"
          const ehUsoProprio = v.perfil === "uso_proprio"
          let custoDaVenda = 0
          for (const it of v.itens ?? []) {
            const c = custoMap[it.variant_id]
            if (c == null) itensSemCusto += it.quantidade
            else if (ehCreator || ehUsoProprio) custoDaVenda += c * it.quantidade
            else cogs += c * it.quantidade
          }
          const pecas = (v.itens ?? []).map((it) => `${it.quantidade}× ${it.produto ?? "peça"}${it.variacao ? ` ${it.variacao}` : ""}`).join(", ")
          if (ehCreator) {
            marketingCreators += custoDaVenda
            creators.push({ data: v.data, nome: v.cliente_nome, pecas, custo_centavos: custoDaVenda })
          } else if (ehUsoProprio) {
            usoProprio += custoDaVenda
            usoProprioLista.push({ data: v.data, nome: v.cliente_nome, pecas, custo_centavos: custoDaVenda })
          }
        }
    } catch {
      /* opcional */
    }
    receita += receitaForaSite

    // 4) taxas de pagamento (tarifa real gravada pelo provider em cada pagamento)
    const taxas = taxasDePagamento(orders)
    const taxasTotal = taxas.total_centavos + taxasForaSite

    const lucro_bruto = receita - cogs
    const resultado = receita + frete - cogs - taxasTotal - despesas - marketingCreators - usoProprio
    const margem_bruta = receita > 0 ? lucro_bruto / receita : 0

    return NextResponse.json({
      periodo: { de, ate },
      pedidos: orders.length,
      receita_produtos: receita,
      vendas_fora_site: vendasForaSite,
      receita_fora_site: receitaForaSite,
      frete,
      cogs,
      lucro_bruto,
      margem_bruta,
      taxas_pagamento: taxasTotal,
      taxas_fora_site: taxasForaSite,
      marketing_creators: marketingCreators,
      creators,
      uso_proprio: usoProprio,
      uso_proprio_lista: usoProprioLista,
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
