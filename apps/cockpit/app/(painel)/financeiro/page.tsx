"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Dre = {
  pedidos: number
  receita_produtos: number
  frete: number
  cogs: number
  lucro_bruto: number
  margem_bruta: number
  despesas: number
  resultado: number
  itens_sem_custo: number
}
type Categoria = { id: string; nome: string }
type Despesa = {
  id: string
  data: string
  descricao: string | null
  valor_centavos: number
  fornecedor: string | null
  recorrencia: string | null
  categoria_id: string | null
  finance_expense_category: { nome: string } | null
}

const brl = (cent: number) => (cent / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
const hoje = () => new Date().toISOString().slice(0, 10)
const primeiroDiaMes = () => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1).toLocaleDateString("en-CA")
}

export default function FinanceiroPage() {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [de, setDe] = useState(primeiroDiaMes())
  const [ate, setAte] = useState(hoje())
  const [dre, setDre] = useState<Dre | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // form nova despesa
  const [fData, setFData] = useState(hoje())
  const [fCat, setFCat] = useState("")
  const [fDesc, setFDesc] = useState("")
  const [fValor, setFValor] = useState("")
  const [fForn, setFForn] = useState("")
  const [fRec, setFRec] = useState("")
  const [salvando, setSalvando] = useState(false)
  const [gerenciarCat, setGerenciarCat] = useState(false)

  const carregarCategorias = useCallback(async () => {
    const r = await fetch("/api/finance/categories", { cache: "no-store" })
    if (r.ok) setCategorias(await r.json())
  }, [])

  const carregarDespesas = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [re, rd] = await Promise.all([
        fetch(`/api/finance/expenses?de=${de}&ate=${ate}`, { cache: "no-store" }),
        fetch(`/api/finance/dre?de=${de}&ate=${ate}`, { cache: "no-store" }),
      ])
      const d = await re.json()
      if (!re.ok) throw new Error(d.error || "Falha ao carregar")
      setDespesas(d)
      if (rd.ok) setDre(await rd.json())
      else setDre(null)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [de, ate])

  useEffect(() => {
    carregarCategorias()
  }, [carregarCategorias])
  useEffect(() => {
    carregarDespesas()
  }, [carregarDespesas])

  const total = useMemo(() => despesas.reduce((s, d) => s + d.valor_centavos, 0), [despesas])
  const porCategoria = useMemo(() => {
    const m = new Map<string, number>()
    despesas.forEach((d) => {
      const k = d.finance_expense_category?.nome ?? "Sem categoria"
      m.set(k, (m.get(k) ?? 0) + d.valor_centavos)
    })
    return [...m].sort((a, b) => b[1] - a[1])
  }, [despesas])

  async function lancar() {
    const reais = Number(fValor.replace(",", "."))
    if (!fData) return alert("Informe a data.")
    if (!(reais > 0)) return alert("Informe um valor válido.")
    setSalvando(true)
    try {
      const r = await fetch("/api/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          data: fData,
          categoria_id: fCat || null,
          descricao: fDesc,
          valor_centavos: Math.round(reais * 100),
          fornecedor: fForn,
          recorrencia: fRec || null,
        }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao lançar")
      setFDesc("")
      setFValor("")
      setFForn("")
      carregarDespesas()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(id: string) {
    if (!confirm("Excluir esta despesa?")) return
    const r = await fetch(`/api/finance/expenses/${id}`, { method: "DELETE" })
    if (r.ok) setDespesas((prev) => prev.filter((d) => d.id !== id))
    else alert((await r.json()).error || "Falha ao excluir")
  }

  async function novaCategoria() {
    const nome = prompt("Nome da categoria:")
    if (!nome?.trim()) return
    const r = await fetch("/api/finance/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: nome.trim() }),
    })
    if (r.ok) carregarCategorias()
    else alert((await r.json()).error || "Falha")
  }
  async function excluirCategoria(id: string) {
    if (!confirm("Excluir categoria? As despesas dela ficam sem categoria.")) return
    const r = await fetch(`/api/finance/categories/${id}`, { method: "DELETE" })
    if (r.ok) carregarCategorias()
    else alert((await r.json()).error || "Falha")
  }

  const inputCls =
    "border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-grafite">Financeiro</h1>
        <div className="flex items-center gap-2 text-sm">
          <input type="date" value={de} onChange={(e) => setDe(e.target.value)} className={inputCls} />
          <span className="text-eclat-grafite/40">até</span>
          <input type="date" value={ate} onChange={(e) => setAte(e.target.value)} className={inputCls} />
        </div>
      </div>

      {/* DRE do período */}
      {dre && (
        <div className="border border-eclat-grafite/20 rounded-lg bg-white/70 p-5 mb-6">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-serif text-xl text-eclat-grafite">Resultado (DRE)</h2>
            <span className="text-xs text-eclat-grafite/50">{dre.pedidos} pedido(s) · pagos/autorizados</span>
          </div>
          <div className="max-w-md flex flex-col gap-1.5 text-sm">
            <div className="flex justify-between"><span className="text-eclat-grafite/70">Receita de produtos</span><span>{brl(dre.receita_produtos)}</span></div>
            <div className="flex justify-between"><span className="text-eclat-grafite/70">(−) CMV / COGS</span><span className="text-red-700">−{brl(dre.cogs)}</span></div>
            <div className="flex justify-between border-t border-eclat-pedra/30 pt-1.5 font-medium">
              <span>= Lucro bruto</span>
              <span>{brl(dre.lucro_bruto)} <span className="text-xs text-eclat-grafite/50">({(dre.margem_bruta * 100).toFixed(1)}%)</span></span>
            </div>
            <div className="flex justify-between mt-1"><span className="text-eclat-grafite/70">(+) Frete recebido</span><span>{brl(dre.frete)}</span></div>
            <div className="flex justify-between"><span className="text-eclat-grafite/70">(−) Despesas</span><span className="text-red-700">−{brl(dre.despesas)}</span></div>
            <div className="flex justify-between border-t-2 border-eclat-grafite/40 pt-2 mt-1 font-serif text-lg">
              <span>= Resultado</span>
              <span className={dre.resultado >= 0 ? "text-green-700" : "text-red-700"}>{brl(dre.resultado)}</span>
            </div>
          </div>
          {dre.itens_sem_custo > 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2 mt-3">
              ⚠ {dre.itens_sem_custo} item(ns) vendido(s) sem custo cadastrado — o COGS está subestimado. Defina o custo em Produtos &amp; Estoque.
            </p>
          )}
        </div>
      )}

      {/* resumo despesas do período */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-4">
          <div className="text-xs uppercase tracking-wider text-eclat-grafite/50">Despesas no período</div>
          <div className="font-serif text-3xl text-eclat-grafite mt-1">{brl(total)}</div>
          <div className="text-xs text-eclat-grafite/50 mt-1">{despesas.length} lançamento(s)</div>
        </div>
        <div className="md:col-span-2 border border-eclat-pedra/40 rounded-lg bg-white/60 p-4">
          <div className="text-xs uppercase tracking-wider text-eclat-grafite/50 mb-2">Por categoria</div>
          {porCategoria.length === 0 ? (
            <p className="text-sm text-eclat-grafite/50">Sem despesas no período.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {porCategoria.map(([nome, v]) => (
                <div key={nome} className="flex justify-between text-sm">
                  <span className="text-eclat-grafite/70">{nome}</span>
                  <span>{brl(v)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* nova despesa */}
      <div className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-serif text-xl text-eclat-grafite">Lançar despesa</h2>
          <button onClick={() => setGerenciarCat((s) => !s)} className="text-xs text-eclat-dourado underline">
            gerenciar categorias
          </button>
        </div>
        {gerenciarCat && (
          <div className="mb-3 p-3 border border-eclat-pedra/30 rounded-md bg-eclat-areia/20 flex flex-wrap gap-2 items-center">
            {categorias.map((c) => (
              <span key={c.id} className="text-xs bg-white border border-eclat-pedra/30 rounded-full px-2 py-1 flex items-center gap-1">
                {c.nome}
                <button onClick={() => excluirCategoria(c.id)} className="text-eclat-grafite/40 hover:text-red-700">✕</button>
              </span>
            ))}
            <button onClick={novaCategoria} className="text-xs text-eclat-dourado underline">+ categoria</button>
          </div>
        )}
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-eclat-grafite/60 block mb-1">Data</label>
            <input type="date" value={fData} onChange={(e) => setFData(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-eclat-grafite/60 block mb-1">Categoria</label>
            <select value={fCat} onChange={(e) => setFCat(e.target.value)} className={inputCls}>
              <option value="">—</option>
              {categorias.map((c) => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="text-xs text-eclat-grafite/60 block mb-1">Descrição</label>
            <input value={fDesc} onChange={(e) => setFDesc(e.target.value)} className={inputCls + " w-full"} />
          </div>
          <div>
            <label className="text-xs text-eclat-grafite/60 block mb-1">Valor (R$)</label>
            <input value={fValor} onChange={(e) => setFValor(e.target.value)} inputMode="decimal" className={inputCls + " w-28"} />
          </div>
          <div>
            <label className="text-xs text-eclat-grafite/60 block mb-1">Fornecedor</label>
            <input value={fForn} onChange={(e) => setFForn(e.target.value)} className={inputCls + " w-32"} />
          </div>
          <button
            onClick={lancar}
            disabled={salvando}
            className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2.5 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
          >
            {salvando ? "…" : "Lançar"}
          </button>
        </div>
      </div>

      {/* lista despesas */}
      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">{erro}</p>}
      {!loading && !erro && (
        <div className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-eclat-grafite/50 border-b border-eclat-pedra/20">
                <th className="px-4 py-2 font-normal">Data</th>
                <th className="px-4 py-2 font-normal">Categoria</th>
                <th className="px-4 py-2 font-normal">Descrição</th>
                <th className="px-4 py-2 font-normal">Fornecedor</th>
                <th className="px-4 py-2 font-normal text-right">Valor</th>
                <th className="px-4 py-2 font-normal"></th>
              </tr>
            </thead>
            <tbody>
              {despesas.map((d) => (
                <tr key={d.id} className="border-b border-eclat-pedra/10 last:border-0 group">
                  <td className="px-4 py-2 text-eclat-grafite/70">{new Date(d.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className="px-4 py-2">{d.finance_expense_category?.nome ?? "—"}</td>
                  <td className="px-4 py-2">{d.descricao || "—"}</td>
                  <td className="px-4 py-2 text-eclat-grafite/60">{d.fornecedor || "—"}</td>
                  <td className="px-4 py-2 text-right font-medium">{brl(d.valor_centavos)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => excluir(d.id)} className="text-xs text-red-700/70 hover:text-red-700 opacity-0 group-hover:opacity-100">excluir</button>
                  </td>
                </tr>
              ))}
              {despesas.length === 0 && (
                <tr><td colSpan={6} className="px-4 py-6 text-center text-eclat-grafite/50 text-sm">Nenhuma despesa no período.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
