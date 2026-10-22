import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaItensVendidos } from "@/lib/medusa"

// Visão geral do financeiro (sócia, 2026-10-22): tudo o que foi investido (finance_expense, por categoria e etapa),
// o lote da Lumière (fichas de custo × lote produzido) contra o que já vendeu (pedidos do site + vendas fora do
// site), desenvolvimento, marketing por mês e demais gastos. Base: levantamento de 16/09 importado + lançamentos
// novos feitos no Cockpit. Tudo em centavos.
type Despesa = { id: string; data: string; descricao: string | null; valor_centavos: number; fornecedor: string | null; recorrencia: string | null; etapa: string | null; quantidade: number | null; custo_unitario_centavos: number | null; observacao: string | null; categoria: { nome: string } | null }
type Peca = {
  id: string; name: string; colorway: string | null; lote_pecas: number; faccao_centavos: number; estampa_centavos: number; perda_pct: number
  preco_venda_centavos: number | null; medusa_variant_ids: string[]; costing_model: { name: string; category: string | null } | null
  costing_item: { kind: string; name: string; unit: string; consumption: number; unit_price_centavos: number; position: number }[]
}

const LUMIERE = "Lumière parte 01"
const mesDe = (iso: string) => iso.slice(0, 7)

export async function GET() {
  try {
    const [dr, pr, vr] = await Promise.all([
      sb("finance_expense?select=id,data,descricao,valor_centavos,fornecedor,recorrencia,etapa,quantidade,custo_unitario_centavos,observacao,categoria:finance_expense_category(nome)&order=data.desc"),
      sb(`costing_piece?select=id,name,colorway,lote_pecas,faccao_centavos,estampa_centavos,perda_pct,preco_venda_centavos,medusa_variant_ids,costing_model(name,category),costing_item(kind,name,unit,consumption,unit_price_centavos,position)&collection=eq.${encodeURIComponent(LUMIERE)}&order=name.asc`),
      sb("venda_externa?select=data,itens,perfil,total_centavos,subtotal_centavos,desconto_centavos&pago=eq.true&cancelada_em=is.null"),
    ])
    if (!dr.ok) throw new Error(`despesas: HTTP ${dr.status}`)
    const despesas = (await dr.json()) as Despesa[]
    const pecas = pr.ok ? ((await pr.json()) as Peca[]) : []
    const externas = vr.ok ? ((await vr.json()) as { data: string; itens: { variant_id: string; quantidade: number; preco_centavos: number }[]; perfil?: string | null; total_centavos: number; subtotal_centavos: number; desconto_centavos: number }[]) : []

    // 1) Investido: por categoria, por etapa, total
    let total = 0
    const porCategoria: Record<string, number> = {}
    const porEtapa: Record<string, number> = {}
    const porMes: Record<string, Record<string, number>> = {} // mês → categoria → centavos
    for (const d of despesas) {
      total += d.valor_centavos
      const cat = d.categoria?.nome ?? "Sem categoria"
      porCategoria[cat] = (porCategoria[cat] ?? 0) + d.valor_centavos
      const et = d.etapa ?? "Marca (geral)"
      porEtapa[et] = (porEtapa[et] ?? 0) + d.valor_centavos
      const m = mesDe(d.data)
      porMes[m] = porMes[m] ?? {}
      porMes[m][cat] = (porMes[m][cat] ?? 0) + d.valor_centavos
    }

    // 2) Lote Lumière: ficha × lote, vendas por variação (site + fora do site)
    const vendidoPorVariante = new Map<string, { qtd: number; receita: number }>()
    const soma = (vid: string | null, qtd: number, receita: number) => {
      if (!vid) return
      const a = vendidoPorVariante.get(vid) ?? { qtd: 0, receita: 0 }
      a.qtd += qtd
      a.receita += receita
      vendidoPorVariante.set(vid, a)
    }
    let itensSite: Awaited<ReturnType<typeof medusaItensVendidos>> = []
    try {
      itensSite = await medusaItensVendidos()
    } catch {
      /* Medusa fora: a visão continua, sem as vendas do site */
    }
    for (const it of itensSite) soma(it.variant_id, it.quantity, Math.round(it.total * 100))
    for (const v of externas) {
      // receita por item proporcional ao desconto da venda
      const fator = v.subtotal_centavos > 0 ? v.total_centavos / v.subtotal_centavos : 0
      for (const it of v.itens ?? []) soma(it.variant_id, it.quantidade, Math.round(it.quantidade * it.preco_centavos * fator))
    }
    const lote = pecas.map((p) => {
      const itens = [...(p.costing_item ?? [])].sort((a, b) => a.position - b.position)
      const materiais = itens.reduce((s, i) => s + i.consumption * i.unit_price_centavos, 0) * (1 + (p.perda_pct || 0) / 100)
      const custoUnit = Math.round(materiais + p.faccao_centavos + p.estampa_centavos)
      let vendidas = 0
      let receita = 0
      for (const vid of p.medusa_variant_ids ?? []) {
        const a = vendidoPorVariante.get(vid)
        if (a) {
          vendidas += a.qtd
          receita += a.receita
        }
      }
      return {
        id: p.id,
        modelo: p.costing_model?.name ?? p.name,
        cor: p.colorway,
        nome: p.name,
        lote: p.lote_pecas,
        custo_unitario: custoUnit,
        custo_lote: custoUnit * p.lote_pecas,
        preco_venda: p.preco_venda_centavos,
        vendidas,
        receita,
        em_estoque: Math.max(0, p.lote_pecas - vendidas),
        composicao: {
          itens: itens.map((i) => ({ kind: i.kind, nome: i.name, unidade: i.unit, consumo: i.consumption, preco_unit: i.unit_price_centavos, custo: Math.round(i.consumption * i.unit_price_centavos) })),
          faccao: p.faccao_centavos,
          estampa: p.estampa_centavos,
          perda_pct: p.perda_pct,
        },
      }
    })
    const investidoLumiere = porEtapa[LUMIERE] ?? 0
    const custoLote = lote.reduce((s, p) => s + p.custo_lote, 0)
    const producao = lote.reduce((s, p) => s + p.lote, 0)
    const vendidas = lote.reduce((s, p) => s + p.vendidas, 0)
    const receita = lote.reduce((s, p) => s + p.receita, 0)
    const custoVendido = lote.reduce((s, p) => s + p.custo_unitario * p.vendidas, 0)

    // 3) Marketing por mês (categoria 5) + peças de creators (custo) por mês
    const marketingPorMes: Record<string, { gastos: number; creators: number }> = {}
    for (const d of despesas) {
      if (!(d.categoria?.nome ?? "").startsWith("5")) continue
      const m = mesDe(d.data)
      marketingPorMes[m] = marketingPorMes[m] ?? { gastos: 0, creators: 0 }
      marketingPorMes[m].gastos += d.valor_centavos
    }
    const custoPorVariante = new Map<string, number>()
    for (const p of lote) for (const vid of pecas.find((x) => x.id === p.id)?.medusa_variant_ids ?? []) custoPorVariante.set(vid, p.custo_unitario)
    for (const v of externas) {
      if (v.perfil !== "creator") continue
      const m = mesDe(v.data)
      marketingPorMes[m] = marketingPorMes[m] ?? { gastos: 0, creators: 0 }
      for (const it of v.itens ?? []) marketingPorMes[m].creators += (custoPorVariante.get(it.variant_id) ?? 0) * it.quantidade
    }

    return NextResponse.json({
      total,
      por_categoria: porCategoria,
      por_etapa: porEtapa,
      por_mes: porMes,
      lumiere: {
        investido: investidoLumiere,
        custo_lote: custoLote,
        producao,
        vendidas,
        em_estoque: Math.max(0, producao - vendidas),
        receita,
        custo_vendido: custoVendido,
        recuperado_pct: investidoLumiere > 0 ? receita / investidoLumiere : 0,
        pecas: lote,
      },
      marketing_por_mes: marketingPorMes,
      despesas,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
