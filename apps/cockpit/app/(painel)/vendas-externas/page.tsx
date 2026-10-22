"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from "react"
import { Aviso, Carregando, Metrica, Secao, TituloPagina } from "@/components/ui"
import {
  CANAIS,
  EMBAIXADORA_PERCENTUAL,
  PAGAMENTOS,
  PARCELAS_MAX,
  PERFIS,
  SITUACOES,
  descontoEmCentavos,
  liquidoDoCartao,
  situacao,
  subtotalDe,
  taxasVazias,
  type Canal,
  type ItemVenda,
  type Pagamento,
  type Perfil,
  type TaxasCartao,
  type TipoDesconto,
  type VendaExterna,
} from "@/lib/venda-externa"

// Vendas fora do site (sócia, 2026-10-15/16): venda fechada no WhatsApp/presencial entra aqui com cliente, peças,
// desconto (R$ ou %), perfil (cliente / embaixadora 20% / creator custo zero ou %), pagamento e, no cartão, as
// parcelas com a taxa da maquininha (líquido real no financeiro). A prazo: lembrete automático às 9h do dia.
// O check "convite ao unboxing" manda a mensagem na hora. O estoque baixa no Medusa ao salvar.
type Produto = { id: string; title: string; variants: { id: string; title: string | null; sku: string | null; price: number | null; stock: number | null; inventory_item_id: string | null }[] }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—")
const hoje = () => new Date().toLocaleDateString("en-CA")
const inputCls = "border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const chipCls = (ativo: boolean) => `text-meta px-3 py-1.5 rounded-full border transition-colors ${ativo ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "bg-white border-eclat-pedra/50 hover:bg-eclat-areia/40"}`
const wa = (tel: string) => `https://wa.me/${tel}`
const rotuloParcelas = (n: number) => (n === 0 ? "Débito" : `${n}x no crédito`)

export default function VendasExternasPage() {
  const [vendas, setVendas] = useState<VendaExterna[]>([])
  const [hojeBr, setHojeBr] = useState(hoje())
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [taxas, setTaxas] = useState<TaxasCartao>(taxasVazias())
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [mostrarTaxas, setMostrarTaxas] = useState(false)
  // Editar (sócia, 2026-10-22): forma, pago/não pago, data combinada, observações — sem relançar.
  const [editando, setEditando] = useState<string | null>(null)
  const [ePag, setEPag] = useState<Pagamento>("pix")
  const [ePago, setEPago] = useState(true)
  const [eVenc, setEVenc] = useState("")
  const [eObs, setEObs] = useState("")
  const abrirEdicao = (v: VendaExterna) => {
    setEditando(v.id)
    setEPag(v.pagamento)
    setEPago(v.pago)
    setEVenc(v.vencimento ?? "")
    setEObs(v.observacoes ?? "")
  }
  const salvarEdicao = async (id: string) => {
    setErro(null)
    try {
      const r = await fetch(`/api/vendas-externas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: "editar", pagamento: ePag, pago: ePago, vencimento: eVenc || null, observacoes: eObs }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setEditando(null)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const [salvando, setSalvando] = useState(false)

  // formulário
  const [fData, setFData] = useState(hoje())
  const [fCanal, setFCanal] = useState<Canal>("whatsapp")
  const [fPerfil, setFPerfil] = useState<Perfil>("cliente")
  const [fNome, setFNome] = useState("")
  const [fWhats, setFWhats] = useState("")
  const [fEmail, setFEmail] = useState("")
  const [fItens, setFItens] = useState<ItemVenda[]>([])
  const [fBusca, setFBusca] = useState("")
  const [fTipoDesc, setFTipoDesc] = useState<TipoDesconto>("valor")
  const [fDesconto, setFDesconto] = useState("") // R$ ou %, conforme o tipo
  const [fPag, setFPag] = useState<Pagamento>("pix")
  const [fParcelas, setFParcelas] = useState<number>(1)
  const [fVenc, setFVenc] = useState("")
  const [fObs, setFObs] = useState("")
  const [fEstoque, setFEstoque] = useState(true)
  const [fUnboxing, setFUnboxing] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [rv, rp] = await Promise.all([fetch("/api/vendas-externas", { cache: "no-store" }), fetch("/api/products", { cache: "no-store" })])
      const dv = await rv.json()
      if (!rv.ok) throw new Error(dv.error || `HTTP ${rv.status}`)
      setVendas(dv.vendas)
      setHojeBr(dv.hoje)
      if (dv.taxas) setTaxas(dv.taxas)
      const dp = await rp.json()
      if (rp.ok && Array.isArray(dp)) setProdutos(dp)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  const opcoes = useMemo(() => {
    const q = fBusca.trim().toLowerCase()
    if (!q) return []
    const out: { produto: Produto; v: Produto["variants"][number] }[] = []
    for (const p of produtos)
      for (const v of p.variants)
        if (`${p.title} ${v.title ?? ""} ${v.sku ?? ""}`.toLowerCase().includes(q)) out.push({ produto: p, v })
    return out.slice(0, 12)
  }, [fBusca, produtos])

  const adicionar = (p: Produto, v: Produto["variants"][number]) => {
    setFItens((atual) => {
      const i = atual.findIndex((x) => x.variant_id === v.id)
      if (i >= 0) return atual.map((x, k) => (k === i ? { ...x, quantidade: x.quantidade + 1 } : x))
      return [...atual, { variant_id: v.id, produto: p.title, variacao: v.title, sku: v.sku, quantidade: 1, preco_centavos: Math.round((v.price ?? 0) * 100), inventory_item_id: v.inventory_item_id }]
    })
    setFBusca("")
  }

  // Perfil: embaixadora trava 20%; creator pede % (100 = custo zero). Cliente: livre.
  const escolherPerfil = (p: Perfil) => {
    setFPerfil(p)
    if (p === "embaixadora") {
      setFTipoDesc("percentual")
      setFDesconto(String(EMBAIXADORA_PERCENTUAL))
    } else if (p === "creator") {
      setFTipoDesc("percentual")
      setFDesconto("100")
    } else {
      setFTipoDesc("valor")
      setFDesconto("")
    }
  }

  const subtotal = subtotalDe(fItens)
  const descNum = Number(String(fDesconto).replace(",", ".")) || 0
  const descontoCent = descontoEmCentavos(subtotal, fTipoDesc, Math.round(descNum * 100), descNum)
  const total = Math.max(0, subtotal - descontoCent)
  const pagEfetivo: Pagamento = total === 0 ? "cortesia" : fPag
  const cartao = pagEfetivo === "cartao" ? liquidoDoCartao(total, fParcelas, taxas) : null
  const taxaFaltando = pagEfetivo === "cartao" && !cartao

  const limpar = () => {
    setFNome(""); setFWhats(""); setFEmail(""); setFItens([]); setFTipoDesc("valor"); setFDesconto(""); setFPerfil("cliente"); setFPag("pix"); setFParcelas(1); setFVenc(""); setFObs(""); setFEstoque(true); setFUnboxing(true); setFData(hoje()); setFCanal("whatsapp")
  }

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await fetch("/api/vendas-externas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: fData, canal: fCanal, perfil: fPerfil, cliente_nome: fNome, cliente_whatsapp: fWhats, cliente_email: fEmail, itens: fItens,
          tipo_desconto: fTipoDesc, desconto_centavos: fTipoDesc === "valor" ? Math.round(descNum * 100) : 0, desconto_percentual: fTipoDesc === "percentual" ? descNum : 0,
          pagamento: pagEfetivo, parcelas: pagEfetivo === "cartao" ? fParcelas : undefined, vencimento: fVenc || undefined, observacoes: fObs, baixar_estoque: fEstoque, enviar_unboxing: fUnboxing,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setAviso(d.avisos?.length ? `Venda lançada. Atenção: ${d.avisos.join(" · ")}` : `Venda lançada${fUnboxing ? " e convite ao unboxing enviado" : ""}.`)
      limpar()
      setMostrarForm(false)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const salvarTaxas = async () => {
    setErro(null)
    try {
      const r = await fetch("/api/vendas-externas/taxas-cartao", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(taxas) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      setTaxas(d)
      setAviso("Taxas da maquininha salvas.")
      setMostrarTaxas(false)
    } catch (e) {
      setErro((e as Error).message)
    }
  }
  const setTaxa = (k: "debito" | string, v: string) => {
    const n = v.trim() === "" ? null : Number(v.replace(",", "."))
    const val = n == null || !Number.isFinite(n) ? null : n
    setTaxas((t) => (k === "debito" ? { ...t, debito: val } : { ...t, credito: { ...t.credito, [k]: val } }))
  }

  const acao = async (id: string, a: "pago" | "lembrar" | "unboxing" | "cancelar") => {
    if (a === "cancelar" && !confirm("Cancelar esta venda? O estoque não volta sozinho.")) return
    setErro(null)
    try {
      const r = await fetch(`/api/vendas-externas/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acao: a }) })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`)
      await carregar()
    } catch (e) {
      setErro((e as Error).message)
    }
  }

  const ativas = vendas.filter((v) => !v.cancelada_em)
  const aReceber = ativas.filter((v) => !v.pago)
  const vencidas = aReceber.filter((v) => situacao(v, hojeBr) === "atrasada" || situacao(v, hojeBr) === "vence_hoje")
  const mesAtual = hojeBr.slice(0, 7)
  const doMes = ativas.filter((v) => v.data.startsWith(mesAtual))
  const liquidoDe = (v: VendaExterna) => v.liquido_centavos ?? v.total_centavos - (v.taxa_centavos ?? 0)

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Vendas fora do site"
        descricao="Venda fechada no WhatsApp ou presencial. Ao salvar, o estoque baixa no Medusa; venda a prazo recebe o lembrete de pagamento no dia combinado, às 9h, sozinho. No cartão, o líquido entra no financeiro já sem a taxa da maquininha."
        acoes={
          <>
            <button onClick={() => setMostrarTaxas((m) => !m)} className="text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">💳 Taxas da maquininha</button>
            <button onClick={() => setMostrarForm((m) => !m)} className="text-meta px-3 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">{mostrarForm ? "Fechar" : "+ Lançar venda"}</button>
          </>
        }
      />
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tom="atencao">{aviso}</Aviso>}

      {mostrarTaxas && (
        <Secao titulo="Taxas da maquininha (%)">
          <div className="rounded-xl border border-eclat-pedra/40 bg-white/60 p-4 flex flex-col gap-3">
            <p className="text-meta text-eclat-texto-3">O que a operadora desconta em cada forma. Ex.: 3,49 para 3,49%. Vazio = não configurada (a venda no cartão não fecha sem a taxa).</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Débito<input value={taxas.debito ?? ""} onChange={(e) => setTaxa("debito", e.target.value)} className={inputCls} inputMode="decimal" placeholder="%" /></label>
              {Array.from({ length: PARCELAS_MAX }, (_, i) => String(i + 1)).map((k) => (
                <label key={k} className="flex flex-col gap-1 text-meta text-eclat-texto-3">{k}x<input value={taxas.credito[k] ?? ""} onChange={(e) => setTaxa(k, e.target.value)} className={inputCls} inputMode="decimal" placeholder="%" /></label>
              ))}
            </div>
            <div className="flex justify-end"><button onClick={salvarTaxas} className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">Salvar taxas</button></div>
          </div>
        </Secao>
      )}

      {mostrarForm && (
        <Secao titulo="Nova venda">
          <div className="rounded-xl border border-eclat-pedra/40 bg-white/60 p-4 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-meta text-eclat-texto-3 mr-1">Quem compra:</span>
              {PERFIS.map((p) => (
                <button key={p.id} type="button" onClick={() => escolherPerfil(p.id)} className={chipCls(fPerfil === p.id)}>
                  {p.id === "embaixadora" ? `Embaixadora · ${EMBAIXADORA_PERCENTUAL}% off` : p.id === "creator" ? "Creator · custo zero ou %" : p.label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Data<input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={inputCls} /></label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Canal
                <select value={fCanal} onChange={(e) => setFCanal(e.target.value as Canal)} className={inputCls}>
                  {CANAIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3 md:col-span-2">Nome<input value={fNome} onChange={(e) => setFNome(e.target.value)} className={inputCls} placeholder="Nome e sobrenome" /></label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">WhatsApp (com DDD)<input value={fWhats} onChange={(e) => setFWhats(e.target.value)} className={inputCls} placeholder="(31) 99999-0000" inputMode="tel" /></label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">E-mail (opcional)<input value={fEmail} onChange={(e) => setFEmail(e.target.value)} className={inputCls} type="email" /></label>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-meta text-eclat-texto-3">Peças</label>
              <input value={fBusca} onChange={(e) => setFBusca(e.target.value)} className={inputCls} placeholder="Digite o nome, a variação ou o SKU e escolha na lista" />
              {opcoes.length > 0 && (
                <ul className="border border-eclat-pedra/40 rounded-md bg-white divide-y divide-eclat-pedra/20 max-h-64 overflow-auto">
                  {opcoes.map(({ produto, v }) => (
                    <li key={v.id}>
                      <button type="button" onClick={() => adicionar(produto, v)} className="w-full text-left px-3 py-2 hover:bg-eclat-areia/40 flex justify-between gap-3 text-corpo">
                        <span>{produto.title} <span className="text-eclat-texto-3">{v.title}</span> <span className="text-meta text-eclat-texto/50">{v.sku}</span></span>
                        <span className="whitespace-nowrap text-eclat-texto-2">{v.price != null ? brl(Math.round(v.price * 100)) : "—"} · {v.stock ?? "?"} un.</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {fItens.length > 0 && (
                <table className="w-full text-corpo">
                  <thead><tr className="text-meta text-eclat-texto-3"><th className="text-left font-normal">Peça</th><th className="text-left font-normal">Qtd</th><th className="text-left font-normal">Preço (R$)</th><th className="text-right font-normal">Total</th><th></th></tr></thead>
                  <tbody>
                    {fItens.map((it, i) => (
                      <tr key={it.variant_id} className="border-b border-eclat-pedra/20">
                        <td className="py-1.5 pr-2">{it.produto} <span className="text-eclat-texto-3">{it.variacao}</span></td>
                        <td className="py-1.5 w-20"><input type="number" min={1} value={it.quantidade} onChange={(e) => setFItens(fItens.map((x, k) => (k === i ? { ...x, quantidade: Math.max(1, Number(e.target.value) || 1) } : x)))} className={inputCls + " w-16"} /></td>
                        <td className="py-1.5 w-32"><input value={(it.preco_centavos / 100).toFixed(2)} onChange={(e) => setFItens(fItens.map((x, k) => (k === i ? { ...x, preco_centavos: Math.round(Number(e.target.value.replace(",", ".")) * 100) || 0 } : x)))} className={inputCls + " w-28"} inputMode="decimal" /></td>
                        <td className="py-1.5 text-right w-28">{brl(it.quantidade * it.preco_centavos)}</td>
                        <td className="py-1.5 w-10 text-right"><button onClick={() => setFItens(fItens.filter((_, k) => k !== i))} className="text-eclat-texto-3 hover:text-red-700">✕</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div className="flex flex-col gap-1 text-meta text-eclat-texto-3">
                <span>Desconto</span>
                <div className="flex gap-1">
                  <div className="flex rounded-md border border-eclat-pedra/50 overflow-hidden">
                    <button type="button" disabled={fPerfil !== "cliente"} onClick={() => { setFTipoDesc("valor"); setFDesconto("") }} className={`px-2 text-meta ${fTipoDesc === "valor" ? "bg-eclat-grafite text-eclat-luz" : "bg-white"} disabled:opacity-50`}>R$</button>
                    <button type="button" disabled={fPerfil !== "cliente"} onClick={() => { setFTipoDesc("percentual"); setFDesconto("") }} className={`px-2 text-meta ${fTipoDesc === "percentual" ? "bg-eclat-grafite text-eclat-luz" : "bg-white"} disabled:opacity-50`}>%</button>
                  </div>
                  <input value={fDesconto} onChange={(e) => setFDesconto(e.target.value)} disabled={fPerfil === "embaixadora"} className={inputCls + " w-full disabled:opacity-60"} inputMode="decimal" placeholder={fTipoDesc === "valor" ? "0,00" : "0"} />
                </div>
                {fPerfil === "creator" && <span className="text-meta text-eclat-texto/60">100 = custo zero (cortesia). Menos que 100 = ela paga a diferença.</span>}
              </div>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Pagamento
                <select value={pagEfetivo} disabled={total === 0} onChange={(e) => setFPag(e.target.value as Pagamento)} className={inputCls + " disabled:opacity-60"}>
                  {PAGAMENTOS.filter((p) => p.id !== "cortesia" || total === 0).map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              {pagEfetivo === "cartao" && (
                <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Parcelas
                  <select value={fParcelas} onChange={(e) => setFParcelas(Number(e.target.value))} className={inputCls}>
                    {Array.from({ length: PARCELAS_MAX + 1 }, (_, n) => <option key={n} value={n}>{rotuloParcelas(n)}</option>)}
                  </select>
                </label>
              )}
              {pagEfetivo === "a_prazo" && (
                <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Data combinada do pagamento<input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} min={hojeBr} className={inputCls} /></label>
              )}
              <div className="text-right md:col-start-4">
                <div className="text-meta text-eclat-texto-3">Subtotal {brl(subtotal)}{descontoCent > 0 ? ` · desconto ${brl(descontoCent)}${fTipoDesc === "percentual" ? ` (${descNum}%)` : ""}` : ""}</div>
                <div className="font-serif lining-nums text-2xl text-eclat-texto">{brl(total)}</div>
                {cartao && <div className="text-meta text-eclat-texto-3">taxa {cartao.taxa_percentual}% = −{brl(cartao.taxa_centavos)} · líquido <b>{brl(cartao.liquido_centavos)}</b></div>}
                {taxaFaltando && <div className="text-meta text-red-700">Taxa de {rotuloParcelas(fParcelas).toLowerCase()} não configurada: preencha em "Taxas da maquininha".</div>}
              </div>
            </div>

            <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Observações<input value={fObs} onChange={(e) => setFObs(e.target.value)} className={inputCls} placeholder="Ex.: entrega combinada na quinta, no box" /></label>

            <div className="flex flex-wrap items-center gap-4 text-corpo">
              <label className="flex items-center gap-2"><input type="checkbox" checked={fEstoque} onChange={(e) => setFEstoque(e.target.checked)} /> Baixar o estoque no Medusa</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={fUnboxing} onChange={(e) => setFUnboxing(e.target.checked)} /> 🎥 Enviar o convite ao unboxing agora</label>
              <span className="flex-1" />
              <button onClick={salvar} disabled={salvando || !fItens.length || taxaFaltando} className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90 disabled:opacity-50">
                {salvando ? "Salvando…" : "Salvar venda"}
              </button>
            </div>
          </div>
        </Secao>
      )}

      {loading && <Carregando />}
      {!loading && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Metrica rotulo="Vendas no mês" valor={doMes.length} detalhe={`${brl(doMes.reduce((s, v) => s + v.total_centavos, 0))} · líquido ${brl(doMes.reduce((s, v) => s + liquidoDe(v), 0))}`} />
            <Metrica rotulo="A receber" valor={aReceber.length} detalhe={brl(aReceber.reduce((s, v) => s + v.total_centavos, 0))} atencao={aReceber.length > 0} />
            <Metrica rotulo="Vencidas / hoje" valor={vencidas.length} detalhe="cobrar" atencao={vencidas.length > 0} />
            <Metrica rotulo="Total lançado" valor={ativas.length} detalhe="vendas fora do site" />
          </div>

          <Secao titulo="Lançamentos">
            {vendas.length === 0 ? (
              <p className="text-corpo text-eclat-texto-3">Nenhuma venda fora do site ainda. Clique em "+ Lançar venda".</p>
            ) : (
              <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
                <table className="w-full text-corpo">
                  <thead>
                    <tr className="text-left text-meta text-eclat-texto-3 border-b border-eclat-pedra/20">
                      <th className="px-4 py-2 font-normal">Data</th>
                      <th className="px-4 py-2 font-normal">Cliente</th>
                      <th className="px-4 py-2 font-normal">Peças</th>
                      <th className="px-4 py-2 font-normal text-right">Total</th>
                      <th className="px-4 py-2 font-normal">Pagamento</th>
                      <th className="px-4 py-2 font-normal"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendas.map((v) => {
                      const s = situacao(v, hojeBr)
                      const st = SITUACOES[s]
                      return (
                        <Fragment key={v.id}>
                        <tr className={`border-b border-eclat-pedra/10 last:border-0 align-top hover:bg-eclat-areia/30 ${v.cancelada_em ? "opacity-50" : ""}`}>
                          <td className="px-4 py-2 whitespace-nowrap">{dataBr(v.data)}<div className="text-meta text-eclat-texto/40">{CANAIS.find((c) => c.id === v.canal)?.label}</div></td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{v.cliente_nome} {v.perfil && v.perfil !== "cliente" && <span className="ml-1 text-meta px-1.5 py-0.5 rounded bg-eclat-dourado/30 text-eclat-texto">{PERFIS.find((p) => p.id === v.perfil)?.label}</span>}</div>
                            <a href={wa(v.cliente_whatsapp)} target="_blank" rel="noopener noreferrer" className="text-meta text-eclat-texto-3 hover:underline">{v.cliente_whatsapp}</a>
                            {v.unboxing_enviado_em && <div className="text-meta text-eclat-texto/50">🎥 unboxing enviado {dataBr(v.unboxing_enviado_em)}</div>}
                          </td>
                          <td className="px-4 py-2">
                            <ul className="text-meta text-eclat-texto-2">
                              {v.itens.map((it, i) => <li key={i}>{it.quantidade}× {it.produto}{it.variacao ? ` — ${it.variacao}` : ""}</li>)}
                            </ul>
                            {!v.estoque_baixado && !v.cancelada_em && <span className="text-meta text-amber-800">estoque não baixado</span>}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            <div className="font-medium">{brl(v.total_centavos)}</div>
                            {v.desconto_centavos > 0 && <div className="text-meta text-eclat-texto/50">desc. {brl(v.desconto_centavos)}{v.tipo_desconto === "percentual" && v.desconto_percentual != null ? ` (${v.desconto_percentual}%)` : ""}</div>}
                            {(v.taxa_centavos ?? 0) > 0 && <div className="text-meta text-eclat-texto/50">líquido {brl(liquidoDe(v))}</div>}
                          </td>
                          <td className="px-4 py-2">
                            <div>{PAGAMENTOS.find((p) => p.id === v.pagamento)?.label.replace(/ \(.*\)$/, "")}{v.pagamento === "cartao" && v.parcelas != null ? ` · ${rotuloParcelas(v.parcelas).toLowerCase()}` : ""}</div>
                            <span className={`text-meta px-2 py-0.5 rounded-full ${st.cls}`}>{st.txt}{v.vencimento && !v.pago && !v.cancelada_em ? ` · ${dataBr(v.vencimento)}` : ""}</span>
                            {v.lembrete_enviado_em && !v.pago && <div className="text-meta text-eclat-texto/50">lembrete {dataBr(v.lembrete_enviado_em)}</div>}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {!v.cancelada_em && (
                              <div className="flex flex-col items-end gap-1">
                                {!v.pago && <button onClick={() => acao(v.id, "pago")} className="text-meta px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">✓ Recebi</button>}
                                {!v.pago && v.vencimento && <button onClick={() => acao(v.id, "lembrar")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">💬 Lembrar agora</button>}
                                {!v.unboxing_enviado_em && <button onClick={() => acao(v.id, "unboxing")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">🎥 Convite ao unboxing</button>}
                                <button onClick={() => (editando === v.id ? setEditando(null) : abrirEdicao(v))} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">✎ Editar</button>
                                <button onClick={() => acao(v.id, "cancelar")} className="text-meta text-eclat-texto/50 hover:text-red-700">cancelar</button>
                              </div>
                            )}
                          </td>
                        </tr>
                        {editando === v.id && (
                          <tr className="border-b border-eclat-pedra/10 bg-eclat-areia/30">
                            <td colSpan={6} className="px-4 py-3">
                              <div className="flex flex-wrap items-end gap-3">
                                <span className="text-meta text-eclat-texto-3 pb-2">Editar venda de <b>{v.cliente_nome}</b>:</span>
                                <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Pagamento
                                  <select value={ePag} onChange={(e) => setEPag(e.target.value as Pagamento)} className={inputCls}>
                                    {PAGAMENTOS.filter((p) => p.id !== "cortesia" || v.total_centavos === 0).map((p) => (
                                      <option key={p.id} value={p.id} disabled={p.id === "cartao" && v.pagamento !== "cartao"}>{p.label}</option>
                                    ))}
                                  </select>
                                </label>
                                <label className="flex items-center gap-2 text-corpo pb-2"><input type="checkbox" checked={ePago} onChange={(e) => setEPago(e.target.checked)} /> Paga</label>
                                {!ePago && <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Data combinada do pagamento<input type="date" value={eVenc} onChange={(e) => setEVenc(e.target.value)} className={inputCls} /></label>}
                                <label className="flex flex-col gap-1 text-meta text-eclat-texto-3 flex-1 min-w-[220px]">Observações<input value={eObs} onChange={(e) => setEObs(e.target.value)} className={inputCls} /></label>
                                <button onClick={() => salvarEdicao(v.id)} className="text-meta px-3 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">Salvar</button>
                                <button onClick={() => setEditando(null)} className="text-meta px-3 py-2 rounded-md border border-eclat-pedra/50 bg-white">Fechar</button>
                              </div>
                              {!ePago && <p className="text-meta text-eclat-texto-3 mt-2">Em aberto: o lembrete sai às 9h da data combinada. Data nova = lembrete novo.</p>}
                            </td>
                          </tr>
                        )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </Secao>
        </>
      )}
    </div>
  )
}
