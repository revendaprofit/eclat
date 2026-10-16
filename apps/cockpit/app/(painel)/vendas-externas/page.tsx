"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Aviso, Carregando, Metrica, Secao, TituloPagina } from "@/components/ui"
import {
  CANAIS,
  PAGAMENTOS,
  SITUACOES,
  situacao,
  totais,
  type Canal,
  type ItemVenda,
  type Pagamento,
  type VendaExterna,
} from "@/lib/venda-externa"

// Vendas fora do site (sócia, 2026-10-15): venda fechada no WhatsApp/presencial entra aqui com cliente, peças,
// pagamento e, se a prazo, a data combinada (lembrete automático às 9h do dia, pelo backend). O check "convite ao
// unboxing" manda a mensagem na hora. O estoque baixa no Medusa ao salvar.
type Produto = { id: string; title: string; variants: { id: string; title: string | null; sku: string | null; price: number | null; stock: number | null; inventory_item_id: string | null }[] }

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const dataBr = (iso: string | null) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "—")
const hoje = () => new Date().toLocaleDateString("en-CA")
const inputCls = "border border-eclat-pedra/50 rounded-md px-3 py-2 text-corpo bg-white focus:outline-none focus:border-eclat-dourado"
const wa = (tel: string) => `https://wa.me/${tel}`

export default function VendasExternasPage() {
  const [vendas, setVendas] = useState<VendaExterna[]>([])
  const [hojeBr, setHojeBr] = useState(hoje())
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [salvando, setSalvando] = useState(false)

  // formulário
  const [fData, setFData] = useState(hoje())
  const [fCanal, setFCanal] = useState<Canal>("whatsapp")
  const [fNome, setFNome] = useState("")
  const [fWhats, setFWhats] = useState("")
  const [fEmail, setFEmail] = useState("")
  const [fItens, setFItens] = useState<ItemVenda[]>([])
  const [fBusca, setFBusca] = useState("")
  const [fDesconto, setFDesconto] = useState("")
  const [fPag, setFPag] = useState<Pagamento>("pix")
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

  const descontoCent = Math.round(Number(String(fDesconto).replace(",", ".")) * 100) || 0
  const { subtotal, total } = totais(fItens, descontoCent)

  const limpar = () => {
    setFNome(""); setFWhats(""); setFEmail(""); setFItens([]); setFDesconto(""); setFPag("pix"); setFVenc(""); setFObs(""); setFEstoque(true); setFUnboxing(true); setFData(hoje()); setFCanal("whatsapp")
  }

  const salvar = async () => {
    setSalvando(true)
    setErro(null)
    setAviso(null)
    try {
      const r = await fetch("/api/vendas-externas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: fData, canal: fCanal, cliente_nome: fNome, cliente_whatsapp: fWhats, cliente_email: fEmail, itens: fItens, desconto_centavos: descontoCent, pagamento: fPag, vencimento: fVenc || undefined, observacoes: fObs, baixar_estoque: fEstoque, enviar_unboxing: fUnboxing }),
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

  return (
    <div className="flex flex-col gap-8">
      <TituloPagina
        titulo="Vendas fora do site"
        descricao="Venda fechada no WhatsApp ou presencial. Ao salvar, o estoque baixa no Medusa; venda a prazo recebe o lembrete de pagamento no dia combinado, às 9h, sozinho."
        acoes={
          <button onClick={() => setMostrarForm((m) => !m)} className="text-meta px-3 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">
            {mostrarForm ? "Fechar" : "+ Lançar venda"}
          </button>
        }
      />
      {erro && <Aviso>{erro}</Aviso>}
      {aviso && <Aviso tom="atencao">{aviso}</Aviso>}

      {mostrarForm && (
        <Secao titulo="Nova venda">
          <div className="rounded-xl border border-eclat-pedra/40 bg-white/60 p-4 flex flex-col gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Data<input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={inputCls} /></label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Canal
                <select value={fCanal} onChange={(e) => setFCanal(e.target.value as Canal)} className={inputCls}>
                  {CANAIS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3 md:col-span-2">Nome da cliente<input value={fNome} onChange={(e) => setFNome(e.target.value)} className={inputCls} placeholder="Nome e sobrenome" /></label>
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
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Desconto (R$)<input value={fDesconto} onChange={(e) => setFDesconto(e.target.value)} className={inputCls} inputMode="decimal" placeholder="0,00" /></label>
              <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Pagamento
                <select value={fPag} onChange={(e) => setFPag(e.target.value as Pagamento)} className={inputCls}>
                  {PAGAMENTOS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              </label>
              {fPag === "a_prazo" && (
                <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Data combinada do pagamento<input type="date" value={fVenc} onChange={(e) => setFVenc(e.target.value)} min={hojeBr} className={inputCls} /></label>
              )}
              <div className="text-right md:col-start-4">
                <div className="text-meta text-eclat-texto-3">Subtotal {brl(subtotal)}{descontoCent > 0 ? ` · desconto ${brl(descontoCent)}` : ""}</div>
                <div className="font-serif lining-nums text-2xl text-eclat-texto">{brl(total)}</div>
              </div>
            </div>

            <label className="flex flex-col gap-1 text-meta text-eclat-texto-3">Observações<input value={fObs} onChange={(e) => setFObs(e.target.value)} className={inputCls} placeholder="Ex.: entrega combinada na quinta, no box" /></label>

            <div className="flex flex-wrap items-center gap-4 text-corpo">
              <label className="flex items-center gap-2"><input type="checkbox" checked={fEstoque} onChange={(e) => setFEstoque(e.target.checked)} /> Baixar o estoque no Medusa</label>
              <label className="flex items-center gap-2"><input type="checkbox" checked={fUnboxing} onChange={(e) => setFUnboxing(e.target.checked)} /> 🎥 Enviar o convite ao unboxing agora</label>
              <span className="flex-1" />
              <button onClick={salvar} disabled={salvando || !fItens.length} className="text-meta px-4 py-2 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90 disabled:opacity-50">
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
            <Metrica rotulo="Vendas no mês" valor={doMes.length} detalhe={brl(doMes.reduce((s, v) => s + v.total_centavos, 0))} />
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
                        <tr key={v.id} className={`border-b border-eclat-pedra/10 last:border-0 align-top hover:bg-eclat-areia/30 ${v.cancelada_em ? "opacity-50" : ""}`}>
                          <td className="px-4 py-2 whitespace-nowrap">{dataBr(v.data)}<div className="text-meta text-eclat-texto/40">{CANAIS.find((c) => c.id === v.canal)?.label}</div></td>
                          <td className="px-4 py-2">
                            <div className="font-medium">{v.cliente_nome}</div>
                            <a href={wa(v.cliente_whatsapp)} target="_blank" rel="noopener noreferrer" className="text-meta text-eclat-texto-3 hover:underline">{v.cliente_whatsapp}</a>
                            {v.unboxing_enviado_em && <div className="text-meta text-eclat-texto/50">🎥 unboxing enviado {dataBr(v.unboxing_enviado_em)}</div>}
                          </td>
                          <td className="px-4 py-2">
                            <ul className="text-meta text-eclat-texto-2">
                              {v.itens.map((it, i) => <li key={i}>{it.quantidade}× {it.produto}{it.variacao ? ` — ${it.variacao}` : ""}</li>)}
                            </ul>
                            {!v.estoque_baixado && !v.cancelada_em && <span className="text-meta text-amber-800">estoque não baixado</span>}
                          </td>
                          <td className="px-4 py-2 text-right font-medium whitespace-nowrap">{brl(v.total_centavos)}</td>
                          <td className="px-4 py-2">
                            <div>{PAGAMENTOS.find((p) => p.id === v.pagamento)?.label.replace(" (combinar a data)", "")}</div>
                            <span className={`text-meta px-2 py-0.5 rounded-full ${st.cls}`}>{st.txt}{v.vencimento && !v.pago && !v.cancelada_em ? ` · ${dataBr(v.vencimento)}` : ""}</span>
                            {v.lembrete_enviado_em && !v.pago && <div className="text-meta text-eclat-texto/50">lembrete {dataBr(v.lembrete_enviado_em)}</div>}
                          </td>
                          <td className="px-4 py-2 text-right whitespace-nowrap">
                            {!v.cancelada_em && (
                              <div className="flex flex-col items-end gap-1">
                                {!v.pago && <button onClick={() => acao(v.id, "pago")} className="text-meta px-3 py-1.5 rounded-md bg-eclat-grafite text-eclat-luz hover:opacity-90">✓ Recebi</button>}
                                {!v.pago && v.pagamento === "a_prazo" && <button onClick={() => acao(v.id, "lembrar")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">💬 Lembrar agora</button>}
                                {!v.unboxing_enviado_em && <button onClick={() => acao(v.id, "unboxing")} className="text-meta px-3 py-1.5 rounded-md border border-eclat-pedra/50 bg-white hover:bg-eclat-areia/40">🎥 Convite ao unboxing</button>}
                                <button onClick={() => acao(v.id, "cancelar")} className="text-meta text-eclat-texto/50 hover:text-red-700">cancelar</button>
                              </div>
                            )}
                          </td>
                        </tr>
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
