import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"
import { medusaItensVendidos, medusaListProducts } from "@/lib/medusa"

// Visão geral do financeiro em QUADROS (sócia, 2026-10-23: "um quadro por assunto, sem detalhar"):
// coleção (investimento final para ter as peças prontas), modelagem e pilotos (por família, com a coleção onde as
// peças nasceram), marketing total, creators, social media, tráfego, fotos, site, insumos, embalagem, fixos,
// acessórios; e as VENDAS por coleção (site + fora do site), para comparar coleções quando houver mais de uma.
// Fonte: finance_expense (categorias "1 · …" a "8 · …", marketing em 5a..5e; etapa = coleção), costing_piece
// (fichas + lote), pedidos pagos do Medusa e venda_externa pagas. Tudo em centavos.
type Despesa = { id: string; data: string; descricao: string | null; valor_centavos: number; fornecedor: string | null; recorrencia: string | null; etapa: string | null; observacao: string | null; categoria: { nome: string } | null }
type Peca = { id: string; name: string; colorway: string | null; collection: string | null; lote_pecas: number; faccao_centavos: number; estampa_centavos: number; perda_pct: number; preco_venda_centavos: number | null; medusa_variant_ids: string[]; costing_model: { name: string } | null; costing_item: { kind: string; name: string; unit: string; consumption: number; unit_price_centavos: number; position: number }[] }
type VendaExt = { data: string; itens: { variant_id: string; quantidade: number; preco_centavos: number }[]; perfil?: string | null; total_centavos: number; subtotal_centavos: number }

export type Quadro = { id: string; titulo: string; total: number; linhas: { rotulo: string; valor: number; nota?: string }[]; nota?: string; lancamentos: { id: string; data: string; descricao: string | null; fornecedor: string | null; etapa: string | null; valor: number }[] }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const codigo = (cat: string | null | undefined) => (cat ?? "").split(" · ")[0].trim() // "1", "5a", ...
const lanc = (d: Despesa) => ({ id: d.id, data: d.data, descricao: d.descricao, fornecedor: d.fornecedor, etapa: d.etapa, valor: d.valor_centavos })
const soma = (l: Despesa[]) => l.reduce((s, d) => s + d.valor_centavos, 0)
const porEtapa = (l: Despesa[]) => {
  const m: Record<string, number> = {}
  for (const d of l) m[d.etapa ?? "Marca (geral)"] = (m[d.etapa ?? "Marca (geral)"] ?? 0) + d.valor_centavos
  return Object.entries(m).sort(([, a], [, b]) => b - a).map(([rotulo, valor]) => ({ rotulo, valor }))
}

export async function GET() {
  try {
    const [dr, pr, vr] = await Promise.all([
      sb("finance_expense?select=id,data,descricao,valor_centavos,fornecedor,recorrencia,etapa,observacao,categoria:finance_expense_category(nome)&order=data.desc"),
      sb("costing_piece?select=id,name,colorway,collection,lote_pecas,faccao_centavos,estampa_centavos,perda_pct,preco_venda_centavos,medusa_variant_ids,costing_model(name),costing_item(kind,name,unit,consumption,unit_price_centavos,position)&order=name.asc"),
      sb("venda_externa?select=data,itens,perfil,total_centavos,subtotal_centavos&pago=eq.true&cancelada_em=is.null"),
    ])
    if (!dr.ok) throw new Error(`despesas: HTTP ${dr.status}`)
    const despesas = (await dr.json()) as Despesa[]
    const pecas = pr.ok ? ((await pr.json()) as Peca[]) : []
    const externas = vr.ok ? ((await vr.json()) as VendaExt[]) : []
    const cat = (...codigos: string[]) => despesas.filter((d) => codigos.includes(codigo(d.categoria?.nome)))

    // Custo por variação (fichas) e coleção por variação (Medusa; fallback ficha)
    const custoVar = new Map<string, number>()
    const colecaoVar = new Map<string, string>()
    for (const p of pecas) {
      const itens = p.costing_item ?? []
      const mat = itens.reduce((s, i) => s + i.consumption * i.unit_price_centavos, 0) * (1 + (p.perda_pct || 0) / 100)
      const custo = Math.round(mat + p.faccao_centavos + p.estampa_centavos)
      for (const vid of p.medusa_variant_ids ?? []) {
        custoVar.set(vid, custo)
        if (p.collection) colecaoVar.set(vid, p.collection)
      }
    }
    let produtos: Awaited<ReturnType<typeof medusaListProducts>> = []
    try {
      produtos = await medusaListProducts()
    } catch {
      /* sem Medusa: usa só as fichas */
    }
    const nomeVar = new Map<string, string>()
    for (const p of produtos)
      for (const v of p.variants) {
        nomeVar.set(v.id, `${p.title}${v.title ? ` ${v.title}` : ""}`)
        if (!colecaoVar.has(v.id)) colecaoVar.set(v.id, p.collection ?? (p.title.toLowerCase().includes("meia") ? "Acessórios" : "Sem coleção"))
      }
    const colecaoDe = (vid: string | null) => (vid ? (colecaoVar.get(vid) ?? "Sem coleção") : "Sem coleção")

    // Vendas por coleção
    type V = { pecas: number; receita: number; custo: number; site: number; fora: number; itens: Record<string, { pecas: number; receita: number }> }
    const vendas: Record<string, V> = {}
    const add = (col: string, qtd: number, receita: number, vid: string | null, origem: "site" | "fora") => {
      const v = (vendas[col] = vendas[col] ?? { pecas: 0, receita: 0, custo: 0, site: 0, fora: 0, itens: {} })
      v.pecas += qtd
      v.receita += receita
      v.custo += (vid ? custoVar.get(vid) ?? 0 : 0) * qtd
      v[origem] += receita
      const nome = (vid ? nomeVar.get(vid) : null) ?? "peça"
      const it = (v.itens[nome] = v.itens[nome] ?? { pecas: 0, receita: 0 })
      it.pecas += qtd
      it.receita += receita
    }
    try {
      for (const it of await medusaItensVendidos()) add(colecaoDe(it.variant_id), it.quantity, Math.round(it.total * 100), it.variant_id, "site")
    } catch {
      /* sem Medusa */
    }
    let creatorsPecas = 0
    const creatorsLinhas: { rotulo: string; valor: number; nota?: string }[] = []
    for (const v of externas) {
      const fator = v.subtotal_centavos > 0 ? v.total_centavos / v.subtotal_centavos : 0
      for (const it of v.itens ?? []) {
        if (v.perfil === "creator") {
          const c = (custoVar.get(it.variant_id) ?? 0) * it.quantidade
          creatorsPecas += c
          creatorsLinhas.push({ rotulo: `${it.quantidade}× ${nomeVar.get(it.variant_id) ?? "peça"} · ${colecaoDe(it.variant_id)}`, valor: c, nota: v.data })
        } else add(colecaoDe(it.variant_id), it.quantidade, Math.round(it.quantidade * it.preco_centavos * fator), it.variant_id, "fora")
      }
    }

    // Lote por coleção (fichas × lote), separando o que a peça consumiu: tecido (kg), insumos do estoque (tiras,
    // etiquetas, tag, lacre, Zebra), rateios de compras da produção (DTF, composição) e serviços (facção,
    // acompanhamento). Sócia, 2026-10-23: "sobrou tecido nos rolos, calcule o que foi gasto".
    type Lote = { producao: number; custo: number; tecido: number; tecido_kg: Record<string, number>; insumos: number; rateios: number; servicos: number }
    const lotePorColecao: Record<string, Lote> = {}
    for (const p of pecas) {
      const col = p.collection ?? "Sem coleção"
      const l = (lotePorColecao[col] = lotePorColecao[col] ?? { producao: 0, custo: 0, tecido: 0, tecido_kg: {}, insumos: 0, rateios: 0, servicos: 0 })
      const n = p.lote_pecas
      l.producao += n
      l.custo += (custoVar.get((p.medusa_variant_ids ?? [])[0] ?? "") ?? 0) * n
      for (const i of p.costing_item ?? []) {
        const v = Math.round(i.consumption * i.unit_price_centavos) * n
        if (i.kind === "material") {
          l.tecido += v
          l.tecido_kg[i.name] = (l.tecido_kg[i.name] ?? 0) + i.consumption * n
        } else if (/rateio/i.test(i.name)) l.rateios += v
        else if (i.kind === "servico") l.servicos += v
        else l.insumos += v
      }
      l.servicos += (p.faccao_centavos + p.estampa_centavos) * n
    }

    // Quadros
    const colecoes = Array.from(new Set(despesas.filter((d) => ["1", "2", "6"].includes(codigo(d.categoria?.nome)) && d.etapa && d.etapa !== "Marca (geral)").map((d) => d.etapa as string)))
    const sobrasPorColecao: Record<string, number> = {}
    const quadrosColecao: Quadro[] = colecoes.map((col) => {
      const l = despesas.filter((d) => d.etapa === col && ["1", "2"].includes(codigo(d.categoria?.nome)))
      const producao = soma(l.filter((d) => codigo(d.categoria?.nome) === "1"))
      const desenvolvimento = soma(l.filter((d) => codigo(d.categoria?.nome) === "2"))
      const lote = lotePorColecao[col]
      // Investimento REAL na coleção (sócia, 2026-10-23): o que as peças consumiram pelas fichas (preço unitário =
      // valor pago ÷ quantidade comprada; cada peça leva só o que vai nela) × lote. Tecido: consumido contra os rolos
      // comprados (a sobra fica nos rolos). Insumos: consumidos do estoque geral. Facção, acompanhamento, DTF e
      // composição: compras integrais da produção. Modelagem e pilotos ficam fora (quadro próprio).
      const comprasTecido = soma(l.filter((d) => codigo(d.categoria?.nome) === "1" && /tecido|rolo|malha/i.test(d.descricao ?? "")))
      const comprasOutras = producao - comprasTecido
      const temFichas = !!lote && lote.producao > 0
      const tecidoConsumido = temFichas ? lote.tecido : comprasTecido
      const sobraTecido = Math.max(0, comprasTecido - tecidoConsumido)
      const kgs = temFichas ? Object.entries(lote.tecido_kg).map(([nome, kg]) => `${kg.toFixed(1)} kg ${nome.replace(/\s*\(.*\)\s*$/, "")}`).join(" · ") : ""
      const totalReal = tecidoConsumido + (temFichas ? lote.insumos : 0) + comprasOutras + desenvolvimento
      if (temFichas) sobrasPorColecao[col] = sobraTecido
      return {
        id: `colecao:${col}`,
        titulo: col,
        total: totalReal,
        linhas: [
          { rotulo: "Tecido consumido pelas peças", valor: tecidoConsumido, nota: temFichas ? `${kgs} · comprado ${brl(comprasTecido)} · sobra nos rolos ${brl(sobraTecido)}` : undefined },
          ...(temFichas ? [{ rotulo: "Tiras 3D, etiquetas, tag, lacre e Zebra (do estoque de insumos)", valor: lote.insumos }] : []),
          { rotulo: "Facção, acompanhamento, DTF, composição e zíper (compras da produção)", valor: comprasOutras },
          { rotulo: "Desenvolvimento (estilista, pilotos, envios)", valor: desenvolvimento },
        ].filter((x) => x.valor > 0),
        nota: temFichas ? `${lote.producao} peças prontas · ${brl(Math.round(totalReal / lote.producao))} investidos por peça` : undefined,
        lancamentos: l.map(lanc),
      }
    })
    const modelagem = cat("6")
    const quadroModelagem: Quadro = {
      id: "modelagem",
      titulo: "Modelagem e pilotos (investimento anual na marca)",
      total: soma(modelagem),
      linhas: modelagem.map((d) => ({ rotulo: (d.descricao ?? "").replace(/^Modelagem e pilotos - /i, ""), valor: d.valor_centavos, nota: `peças nasceram na ${d.etapa ?? "—"}` })),
      nota: "Investimento anual na marca: os moldes servem a várias coleções e cores. Não entram no investimento da coleção nem no custo da peça.",
      lancamentos: modelagem.map(lanc),
    }
    const mk = (id: string, titulo: string, codigos: string[], extra?: { total: number; linhas: Quadro["linhas"] }): Quadro => {
      const l = cat(...codigos)
      return { id, titulo, total: soma(l) + (extra?.total ?? 0), linhas: [...porEtapa(l).filter((x) => x.rotulo !== "Marca (geral)"), ...(extra?.linhas ?? [])], lancamentos: l.map(lanc) }
    }
    const social = mk("social", "Social media", ["5a"])
    const trafego = mk("trafego", "Tráfego pago", ["5b"])
    const fotos = mk("fotos", "Fotos e vídeos", ["5c"])
    const site = mk("site", "Site e e-commerce", ["5d"])
    const creators = mk("creators", "Creators e embaixadoras", ["5e"], { total: creatorsPecas, linhas: creatorsLinhas })
    // Peças dadas a creators entram como "lançamentos" do quadro (clicou, vê o que compõe a soma).
    creators.lancamentos = [
      ...creators.lancamentos,
      ...creatorsLinhas.map((l, i) => ({ id: `creator-${i}`, data: l.nota ?? "", descricao: l.rotulo, fornecedor: "peça para creator (custo)", etapa: null, valor: l.valor })),
    ]
    const marketing: Quadro = {
      id: "marketing",
      titulo: "Marketing (tudo)",
      total: social.total + trafego.total + fotos.total + site.total + creators.total,
      linhas: [
        { rotulo: "Social media", valor: social.total },
        { rotulo: "Tráfego pago", valor: trafego.total },
        { rotulo: "Fotos e vídeos", valor: fotos.total },
        { rotulo: "Site e e-commerce", valor: site.total },
        { rotulo: "Creators e embaixadoras (peças)", valor: creators.total },
      ].filter((x) => x.valor > 0),
      lancamentos: [...social.lancamentos, ...trafego.lancamentos, ...fotos.lancamentos, ...site.lancamentos, ...creators.lancamentos].sort((a, b) => (a.data < b.data ? 1 : -1)),
    }
    const insumos = mk("insumos", "Insumos de estoque", ["3"])
    const insumosConsumidos = Object.values(lotePorColecao).reduce((s2, l) => s2 + l.insumos, 0)
    if (insumosConsumidos > 0) {
      insumos.linhas.push({ rotulo: "Consumido pelas peças produzidas", valor: insumosConsumidos, nota: "tiras 3D, etiquetas, tags, lacres, Zebra" })
      insumos.linhas.push({ rotulo: "Estoque restante (compras − consumido)", valor: Math.max(0, insumos.total - insumosConsumidos), nota: "para as próximas produções" })
    }
    for (const [col, sobra] of Object.entries(sobrasPorColecao)) {
      if (sobra > 0) insumos.linhas.push({ rotulo: `Tecido que sobrou nos rolos da ${col}`, valor: sobra, nota: "estoque de tecido; não soma no total do quadro" })
    }
    const embalagem = mk("embalagem", "Embalagem", ["4"])
    const fixos = mk("fixos", "Fixos mensais e anuais", ["7"])
    const acessorios = mk("acessorios", "Acessórios da marca", ["8"])
    const totalGeral = soma(despesas) + creatorsPecas

    // Investimento por ano (para o "quadro 2026")
    const porAno: Record<string, number> = {}
    for (const d of despesas) porAno[d.data.slice(0, 4)] = (porAno[d.data.slice(0, 4)] ?? 0) + d.valor_centavos

    const vendasPorColecao = Object.entries(vendas)
      .map(([colecao, v]) => ({
        colecao,
        ...v,
        itens: Object.entries(v.itens).map(([nome, x]) => ({ nome, ...x })).sort((a, b) => b.receita - a.receita),
        investido: quadrosColecao.find((q) => q.titulo === colecao)?.total ?? 0,
        producao: lotePorColecao[colecao]?.producao ?? 0,
      }))
      .sort((a, b) => b.receita - a.receita)

    return NextResponse.json({
      total: totalGeral,
      por_ano: porAno,
      quadros: { colecoes: quadrosColecao, modelagem: quadroModelagem, marketing, creators, social, trafego, fotos, site, insumos, embalagem, fixos, acessorios },
      vendas_por_colecao: vendasPorColecao,
    })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
