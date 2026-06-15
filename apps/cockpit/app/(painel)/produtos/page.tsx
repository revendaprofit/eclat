"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import ProductForm from "@/components/product-form"
import TaxonomyManager from "@/components/taxonomy-manager"
import ImportDialog from "@/components/import-dialog"

type Ref = { id: string; name: string }
type Variant = {
  id: string
  title: string | null
  sku: string | null
  price: number | null
  price_id: string | null
  inventory_item_id: string | null
  stock: number | null
}
type Product = {
  id: string
  title: string
  description: string | null
  status: string
  thumbnail: string | null
  collection: string | null
  collection_id: string | null
  categories: Ref[]
  tags: Ref[]
  created_at: string | null
  variants: Variant[]
}

const ESTOQUE_BAIXO = 5

const brl = (v: number | null) =>
  v == null
    ? "—"
    : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

const minPreco = (p: Product) => {
  const ps = p.variants.map((v) => v.price).filter((x): x is number => x != null)
  return ps.length ? Math.min(...ps) : null
}
const totalEstoque = (p: Product) =>
  p.variants.reduce((s, v) => s + (v.stock ?? 0), 0)
const temBaixo = (p: Product) =>
  p.variants.some((v) => v.stock != null && v.stock > 0 && v.stock <= ESTOQUE_BAIXO)

type Sort = "nome" | "preco_asc" | "preco_desc" | "estoque_asc" | "estoque_desc" | "recentes"

export default function ProdutosPage() {
  const [produtos, setProdutos] = useState<Product[]>([])
  const [custos, setCustos] = useState<Record<string, number>>({}) // variant_id → centavos
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  // filtros
  const [busca, setBusca] = useState("")
  const [fColecao, setFColecao] = useState("")
  const [fCategoria, setFCategoria] = useState("")
  const [fTag, setFTag] = useState("")
  const [fStatus, setFStatus] = useState("")
  const [fEstoque, setFEstoque] = useState("") // "" | baixo | zerado | com
  const [precoMin, setPrecoMin] = useState("")
  const [precoMax, setPrecoMax] = useState("")
  const [sort, setSort] = useState<Sort>("nome")

  // edição inline por célula: chave "<variantId>|price" ou "<variantId>|stock"
  const [editCell, setEditCell] = useState<string | null>(null)
  const [editVal, setEditVal] = useState("")
  const [salvando, setSalvando] = useState(false)

  // seleção / ações em massa
  const [sel, setSel] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState(false)

  // formulário criar/editar + gestor de taxonomias
  const [form, setForm] = useState<{ mode: "create" | "edit"; id?: string } | null>(null)
  const [taxonomia, setTaxonomia] = useState(false)
  const [importar, setImportar] = useState(false)

  async function excluirProduto(p: Product) {
    if (!confirm(`Excluir o produto "${p.title}"? Esta ação não pode ser desfeita.`)) return
    const r = await fetch(`/api/products/${p.id}`, { method: "DELETE" })
    if (r.ok) {
      setProdutos((prev) => prev.filter((x) => x.id !== p.id))
    } else {
      const d = await r.json()
      alert(d.error || "Falha ao excluir")
    }
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const [rp, rc] = await Promise.all([
        fetch("/api/products", { cache: "no-store" }),
        fetch("/api/costs", { cache: "no-store" }),
      ])
      const data = await rp.json()
      if (!rp.ok) throw new Error(data.error || "Falha ao carregar")
      setProdutos(data)
      if (rc.ok) setCustos(await rc.json())
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setLoading(false)
    }
  }, [])

  const custoReais = useCallback(
    (variantId: string) => (custos[variantId] != null ? custos[variantId] / 100 : null),
    [custos]
  )

  useEffect(() => {
    carregar()
  }, [carregar])

  // opções de filtro derivadas do catálogo carregado
  const colecoes = useMemo(() => {
    const m = new Map<string, string>()
    produtos.forEach((p) => {
      if (p.collection_id && p.collection) m.set(p.collection_id, p.collection)
    })
    return [...m].map(([id, name]) => ({ id, name }))
  }, [produtos])
  const categorias = useMemo(() => {
    const m = new Map<string, string>()
    produtos.forEach((p) => p.categories.forEach((c) => m.set(c.id, c.name)))
    return [...m].map(([id, name]) => ({ id, name }))
  }, [produtos])
  const tags = useMemo(() => {
    const m = new Map<string, string>()
    produtos.forEach((p) => p.tags.forEach((t) => m.set(t.id, t.name)))
    return [...m].map(([id, name]) => ({ id, name }))
  }, [produtos])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const min = precoMin.trim() === "" ? null : Number(precoMin.replace(",", "."))
    const max = precoMax.trim() === "" ? null : Number(precoMax.replace(",", "."))
    const out = produtos.filter((p) => {
      if (fColecao && p.collection_id !== fColecao) return false
      if (fCategoria && !p.categories.some((c) => c.id === fCategoria)) return false
      if (fTag && !p.tags.some((t) => t.id === fTag)) return false
      if (fStatus && p.status !== fStatus) return false
      if (fEstoque === "baixo" && !temBaixo(p)) return false
      if (fEstoque === "zerado" && totalEstoque(p) !== 0) return false
      if (fEstoque === "com" && totalEstoque(p) <= 0) return false
      if (q) {
        const hit =
          p.title.toLowerCase().includes(q) ||
          p.variants.some((v) => (v.sku ?? "").toLowerCase().includes(q))
        if (!hit) return false
      }
      if (min != null || max != null) {
        const ok = p.variants.some((v) => {
          if (v.price == null) return false
          if (min != null && v.price < min) return false
          if (max != null && v.price > max) return false
          return true
        })
        if (!ok) return false
      }
      return true
    })
    const arr = [...out]
    arr.sort((a, b) => {
      switch (sort) {
        case "preco_asc":
          return (minPreco(a) ?? Infinity) - (minPreco(b) ?? Infinity)
        case "preco_desc":
          return (minPreco(b) ?? -Infinity) - (minPreco(a) ?? -Infinity)
        case "estoque_asc":
          return totalEstoque(a) - totalEstoque(b)
        case "estoque_desc":
          return totalEstoque(b) - totalEstoque(a)
        case "recentes":
          return (b.created_at ?? "").localeCompare(a.created_at ?? "")
        default:
          return a.title.localeCompare(b.title, "pt-BR")
      }
    })
    return arr
  }, [produtos, busca, fColecao, fCategoria, fTag, fStatus, fEstoque, precoMin, precoMax, sort])

  const alertas = useMemo(() => {
    let n = 0
    for (const p of produtos)
      for (const v of p.variants)
        if (v.stock != null && v.stock <= ESTOQUE_BAIXO) n++
    return n
  }, [produtos])

  const filtroAtivo =
    busca || fColecao || fCategoria || fTag || fStatus || fEstoque || precoMin || precoMax

  function limparFiltros() {
    setBusca("")
    setFColecao("")
    setFCategoria("")
    setFTag("")
    setFStatus("")
    setFEstoque("")
    setPrecoMin("")
    setPrecoMax("")
  }

  function startCell(v: Variant, field: "price" | "stock" | "custo") {
    if (field === "stock" && !v.inventory_item_id) return
    setEditCell(`${v.id}|${field}`)
    const atual = field === "price" ? v.price : field === "stock" ? v.stock : custoReais(v.id)
    setEditVal(atual != null ? String(atual) : "")
  }
  function cancelCell() {
    setEditCell(null)
    setEditVal("")
  }

  async function saveCell(p: Product, v: Variant, field: "price" | "stock" | "custo") {
    if (editCell !== `${v.id}|${field}`) return // evita disparo duplo (Enter + blur)

    // Custo vive no Supabase (financeiro), em centavos — caminho separado.
    if (field === "custo") {
      const reais = editVal.trim() === "" ? null : Number(editVal.replace(",", "."))
      if (reais == null || !(reais >= 0)) return cancelCell()
      const cents = Math.round(reais * 100)
      if (cents === custos[v.id]) return cancelCell()
      setSalvando(true)
      try {
        const r = await fetch("/api/costs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ variant_id: v.id, sku: v.sku, custo_centavos: cents }),
        })
        const data = await r.json()
        if (!r.ok) throw new Error(data.error || "Falha ao salvar custo")
        setCustos((prev) => ({ ...prev, [v.id]: cents }))
        cancelCell()
      } catch (e) {
        alert((e as Error).message)
        cancelCell()
      } finally {
        setSalvando(false)
      }
      return
    }

    const body: Record<string, unknown> = {}
    if (field === "price") {
      const novo = editVal.trim() === "" ? null : Number(editVal.replace(",", "."))
      if (novo == null || !(novo >= 0)) return cancelCell()
      if (novo === v.price) return cancelCell()
      body.price = novo
    } else {
      const novo = editVal.trim() === "" ? null : Number(editVal)
      if (novo == null || !Number.isInteger(novo) || novo < 0) return cancelCell()
      if (novo === v.stock) return cancelCell()
      if (!v.inventory_item_id) return cancelCell()
      body.stock = novo
      body.inventory_item_id = v.inventory_item_id
    }
    setSalvando(true)
    try {
      const r = await fetch(`/api/products/${p.id}/variants/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Falha ao salvar")
      // atualiza só a variante alterada (sem recarregar tudo)
      setProdutos((prev) =>
        prev.map((pp) =>
          pp.id !== p.id
            ? pp
            : {
                ...pp,
                variants: pp.variants.map((vv) =>
                  vv.id !== v.id ? vv : { ...vv, ...body }
                ),
              }
        )
      )
      cancelCell()
    } catch (e) {
      alert((e as Error).message)
      cancelCell()
    } finally {
      setSalvando(false)
    }
  }

  // ---- seleção ----
  const visiveisIds = useMemo(() => filtrados.map((p) => p.id), [filtrados])
  const todosVisiveisSelecionados =
    visiveisIds.length > 0 && visiveisIds.every((id) => sel.has(id))

  function toggleSel(id: string) {
    setSel((prev) => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }
  function toggleTodos() {
    setSel((prev) => {
      if (visiveisIds.every((id) => prev.has(id))) {
        const n = new Set(prev)
        visiveisIds.forEach((id) => n.delete(id))
        return n
      }
      return new Set([...prev, ...visiveisIds])
    })
  }

  // ---- ações em massa ----
  async function bulk(action: string, value?: number) {
    const ids = [...sel]
    if (ids.length === 0) return
    setBulkBusy(true)
    try {
      const r = await fetch("/api/products/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action, value }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error || "Falha na ação em massa")
      await carregar()
      alert(`Pronto: ${data.afetados} alteração(ões) aplicada(s).`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBulkBusy(false)
    }
  }

  function definirPreco() {
    const s = prompt("Novo preço (R$) para todas as variações dos produtos selecionados:")
    if (s == null || s.trim() === "") return
    const valor = Number(s.replace(",", "."))
    if (!Number.isFinite(valor) || valor < 0) return alert("Preço inválido")
    if (
      confirm(
        `Definir preço = ${valor.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })} em todas as variações de ${sel.size} produto(s)?`
      )
    )
      bulk("price_set", valor)
  }
  function ajustarEstoqueDelta() {
    const s = prompt("Ajustar estoque (+/-): ex.: 50 adiciona, -10 remove:")
    if (s == null || s.trim() === "") return
    const d = Number(s)
    if (!Number.isInteger(d)) return alert("Valor inválido (inteiro)")
    bulk("stock_delta", d)
  }
  function definirEstoque() {
    const s = prompt("Definir estoque (valor absoluto) para todas as variações:")
    if (s == null || s.trim() === "") return
    const v = Number(s)
    if (!Number.isInteger(v) || v < 0) return alert("Valor inválido")
    if (confirm(`Definir estoque = ${v} em todas as variações de ${sel.size} produto(s)?`))
      bulk("stock_set", v)
  }
  async function definirCusto() {
    const s = prompt("Custo (R$) para todas as variações dos produtos selecionados:")
    if (s == null || s.trim() === "") return
    const reais = Number(s.replace(",", "."))
    if (!(reais >= 0)) return alert("Custo inválido")
    const cents = Math.round(reais * 100)
    const items = produtos
      .filter((p) => sel.has(p.id))
      .flatMap((p) => p.variants.map((v) => ({ variant_id: v.id, sku: v.sku, custo_centavos: cents })))
    if (!items.length) return
    setBulkBusy(true)
    try {
      const r = await fetch("/api/costs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao definir custo")
      setCustos((prev) => {
        const n = { ...prev }
        items.forEach((it) => (n[it.variant_id] = cents))
        return n
      })
      alert(`Custo aplicado a ${items.length} variação(ões).`)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBulkBusy(false)
    }
  }

  // ---- exportar CSV (lista filtrada; uma linha por variação) ----
  function exportarCSV() {
    const sep = ";"
    const esc = (s: string) => `"${(s ?? "").replace(/"/g, '""')}"`
    // Mesmas colunas (e ordem) da IMPORTAÇÃO → o arquivo exportado serve de template.
    const cab = [
      "SKU",
      "Título",
      "Descrição",
      "Coleção",
      "Categoria",
      "Tamanho",
      "Cor",
      "Preço (R$)",
      "Custo (R$)",
      "Estoque",
      "Status",
    ]
    const linhas: string[] = [cab.join(sep)]
    for (const p of filtrados) {
      for (const v of p.variants) {
        const custo = custoReais(v.id)
        // título da variação no padrão "Tamanho / Cor" → separa nas duas colunas
        const partes = (v.title ?? "").split(" / ")
        const tamanho = partes[0] && partes[0] !== "Padrão" ? partes[0] : ""
        const cor = partes[1] ?? ""
        linhas.push(
          [
            esc(v.sku ?? ""),
            esc(p.title),
            esc(p.description ?? ""),
            esc(p.collection ?? ""),
            esc(p.categories[0]?.name ?? ""),
            esc(tamanho),
            esc(cor),
            esc(v.price != null ? v.price.toFixed(2).replace(".", ",") : ""),
            esc(custo != null ? custo.toFixed(2).replace(".", ",") : ""),
            esc(v.stock != null ? String(v.stock) : ""),
            esc(p.status === "published" ? "publicado" : "rascunho"),
          ].join(sep)
        )
      }
    }
    const csv = "﻿" + linhas.join("\r\n") // BOM p/ Excel pt-BR
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `produtos-eclat-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  async function alternarStatus(p: Product) {
    const novo = p.status === "published" ? "draft" : "published"
    const r = await fetch(`/api/products/${p.id}/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: novo }),
    })
    if (r.ok) {
      setProdutos((prev) =>
        prev.map((x) => (x.id === p.id ? { ...x, status: novo } : x))
      )
    } else {
      const data = await r.json()
      alert(data.error || "Falha ao alterar status")
    }
  }

  const selectCls =
    "border border-eclat-pedra/50 rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <h1 className="font-serif text-3xl text-eclat-grafite">Produtos &amp; Estoque</h1>
        <div className="flex items-center gap-3">
          {alertas > 0 && (
            <button
              onClick={() => setFEstoque((s) => (s === "baixo" ? "" : "baixo"))}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                fEstoque === "baixo"
                  ? "bg-red-600 text-white border-red-600"
                  : "border-red-400 text-red-700 hover:bg-red-50"
              }`}
              title="Variações com estoque baixo"
            >
              ⚠ {alertas} com estoque baixo (≤ {ESTOQUE_BAIXO})
            </button>
          )}
          <button
            onClick={() => setTaxonomia(true)}
            className="text-xs uppercase tracking-widest border border-eclat-grafite/40 px-4 py-2 rounded-md hover:bg-eclat-areia/40 transition-colors"
          >
            ⚙ Categorias e coleções
          </button>
          <button
            onClick={() => setImportar(true)}
            className="text-xs uppercase tracking-widest border border-eclat-grafite/40 px-4 py-2 rounded-md hover:bg-eclat-areia/40 transition-colors"
          >
            ⬆ Importar planilha
          </button>
          <button
            onClick={() => setForm({ mode: "create" })}
            className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-4 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors"
          >
            + Novo produto
          </button>
        </div>
      </div>

      {/* Barra de filtros */}
      <div className="bg-white/60 border border-eclat-pedra/40 rounded-lg p-3 mb-4 flex flex-wrap gap-2 items-center">
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar título ou SKU…"
          className="border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado w-56"
        />
        <select value={fColecao} onChange={(e) => setFColecao(e.target.value)} className={selectCls}>
          <option value="">Coleção: todas</option>
          {colecoes.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <select value={fCategoria} onChange={(e) => setFCategoria(e.target.value)} className={selectCls}>
          <option value="">Categoria: todas</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        {tags.length > 0 && (
          <select value={fTag} onChange={(e) => setFTag(e.target.value)} className={selectCls}>
            <option value="">Tag: todas</option>
            {tags.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
        <select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className={selectCls}>
          <option value="">Status: todos</option>
          <option value="published">Publicado</option>
          <option value="draft">Rascunho</option>
        </select>
        <select value={fEstoque} onChange={(e) => setFEstoque(e.target.value)} className={selectCls}>
          <option value="">Estoque: todos</option>
          <option value="com">Com estoque</option>
          <option value="baixo">Baixo (≤{ESTOQUE_BAIXO})</option>
          <option value="zerado">Zerado</option>
        </select>
        <div className="flex items-center gap-1">
          <input
            value={precoMin}
            onChange={(e) => setPrecoMin(e.target.value)}
            placeholder="R$ mín"
            inputMode="decimal"
            className="w-20 border border-eclat-pedra/50 rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
          />
          <span className="text-eclat-grafite/40 text-xs">–</span>
          <input
            value={precoMax}
            onChange={(e) => setPrecoMax(e.target.value)}
            placeholder="R$ máx"
            inputMode="decimal"
            className="w-20 border border-eclat-pedra/50 rounded-md px-2 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
          />
        </div>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className={selectCls}>
          <option value="nome">Ordenar: nome A–Z</option>
          <option value="preco_asc">Preço ↑</option>
          <option value="preco_desc">Preço ↓</option>
          <option value="estoque_asc">Estoque ↑</option>
          <option value="estoque_desc">Estoque ↓</option>
          <option value="recentes">Mais recentes</option>
        </select>
        {filtroAtivo && (
          <button onClick={limparFiltros} className="text-xs text-eclat-grafite/50 underline ml-1">
            limpar filtros
          </button>
        )}
        <span className="text-xs text-eclat-grafite/50 ml-auto">
          {filtrados.length} de {produtos.length} produto{produtos.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Toolbar: seleção + exportar + ações em massa */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <label className="flex items-center gap-2 text-xs text-eclat-grafite/70 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={todosVisiveisSelecionados}
            onChange={toggleTodos}
            className="accent-eclat-dourado"
          />
          Selecionar visíveis
        </label>
        <button
          onClick={exportarCSV}
          disabled={filtrados.length === 0}
          className="text-xs border border-eclat-grafite/40 rounded-md px-3 py-1.5 hover:bg-eclat-areia/40 disabled:opacity-40"
        >
          ⬇ Exportar CSV
        </button>

        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-auto bg-eclat-dourado/15 border border-eclat-dourado/40 rounded-md px-3 py-1.5">
            <span className="text-xs font-medium text-eclat-grafite">
              {sel.size} selecionado{sel.size === 1 ? "" : "s"}:
            </span>
            <button disabled={bulkBusy} onClick={() => bulk("publish")} className="text-xs underline disabled:opacity-50">Publicar</button>
            <button disabled={bulkBusy} onClick={() => bulk("unpublish")} className="text-xs underline disabled:opacity-50">Despublicar</button>
            <button disabled={bulkBusy} onClick={definirPreco} className="text-xs underline disabled:opacity-50">Definir preço</button>
            <button disabled={bulkBusy} onClick={definirCusto} className="text-xs underline disabled:opacity-50">Definir custo</button>
            <button disabled={bulkBusy} onClick={ajustarEstoqueDelta} className="text-xs underline disabled:opacity-50">Ajustar estoque ±</button>
            <button disabled={bulkBusy} onClick={definirEstoque} className="text-xs underline disabled:opacity-50">Definir estoque</button>
            <button onClick={() => setSel(new Set())} className="text-xs text-eclat-grafite/50 underline">limpar</button>
            {bulkBusy && <span className="text-xs text-eclat-grafite/60">processando…</span>}
          </div>
        )}
      </div>

      {loading && <p className="text-sm text-eclat-grafite/50">Carregando…</p>}
      {erro && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
          {erro}
        </p>
      )}

      <div className="flex flex-col gap-4">
        {!loading &&
          filtrados.map((p) => (
            <div
              key={p.id}
              className="border border-eclat-pedra/40 rounded-lg bg-white/60 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3 border-b border-eclat-pedra/20">
                <input
                  type="checkbox"
                  checked={sel.has(p.id)}
                  onChange={() => toggleSel(p.id)}
                  className="accent-eclat-dourado shrink-0"
                />
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnail} alt={p.title} className="w-10 h-10 rounded object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded bg-eclat-areia/60" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.title}</div>
                  <div className="text-xs text-eclat-grafite/50 truncate">
                    {[p.collection, ...p.categories.map((c) => c.name)]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <button
                  onClick={() => alternarStatus(p)}
                  title="Clique para alternar"
                  className={`text-[11px] px-2 py-1 rounded-full border transition-colors ${
                    p.status === "published"
                      ? "bg-green-100 text-green-800 border-green-300 hover:bg-green-200"
                      : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                  }`}
                >
                  {p.status === "published" ? "publicado" : "rascunho"}
                </button>
                <button
                  onClick={() => setForm({ mode: "edit", id: p.id })}
                  title="Editar produto"
                  className="text-xs border border-eclat-grafite/30 px-2 py-1 rounded hover:bg-eclat-areia/40"
                >
                  editar
                </button>
                <button
                  onClick={() => excluirProduto(p)}
                  title="Excluir produto"
                  className="text-xs text-red-700/80 hover:text-red-700 px-1"
                >
                  🗑
                </button>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-eclat-grafite/50 border-b border-eclat-pedra/20">
                    <th className="px-4 py-2 font-normal">Variação</th>
                    <th className="px-4 py-2 font-normal">SKU</th>
                    <th className="px-4 py-2 font-normal">Custo (R$)</th>
                    <th className="px-4 py-2 font-normal">Preço (R$)</th>
                    <th className="px-4 py-2 font-normal">Estoque</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map((v) => {
                    const baixo = v.stock != null && v.stock <= ESTOQUE_BAIXO
                    const editPreco = editCell === `${v.id}|price`
                    const editEstoque = editCell === `${v.id}|stock`
                    const editCusto = editCell === `${v.id}|custo`
                    const custo = custoReais(v.id)
                    return (
                      <tr key={v.id} className="border-b border-eclat-pedra/10 last:border-0">
                        <td className="px-4 py-2">{v.title}</td>
                        <td className="px-4 py-2 text-eclat-grafite/60 text-xs">{v.sku}</td>
                        <td className="px-4 py-2">
                          {editCusto ? (
                            <input
                              autoFocus
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => saveCell(p, v, "custo")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  saveCell(p, v, "custo")
                                } else if (e.key === "Escape") cancelCell()
                              }}
                              disabled={salvando}
                              inputMode="decimal"
                              className="w-24 border border-eclat-dourado/60 rounded px-2 py-1 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => startCell(v, "custo")}
                              title="Clique para editar o custo"
                              className="text-left rounded px-1 -mx-1 hover:bg-eclat-dourado/15 hover:underline decoration-dotted text-eclat-grafite/70"
                            >
                              {custo == null ? "—" : brl(custo)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editPreco ? (
                            <input
                              autoFocus
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => saveCell(p, v, "price")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  saveCell(p, v, "price")
                                } else if (e.key === "Escape") cancelCell()
                              }}
                              disabled={salvando}
                              inputMode="decimal"
                              className="w-24 border border-eclat-dourado/60 rounded px-2 py-1 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => startCell(v, "price")}
                              title="Clique para editar o preço"
                              className="text-left rounded px-1 -mx-1 hover:bg-eclat-dourado/15 hover:underline decoration-dotted"
                            >
                              {brl(v.price)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-2">
                          {editEstoque ? (
                            <input
                              autoFocus
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              onBlur={() => saveCell(p, v, "stock")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault()
                                  saveCell(p, v, "stock")
                                } else if (e.key === "Escape") cancelCell()
                              }}
                              disabled={salvando}
                              inputMode="numeric"
                              className="w-20 border border-eclat-dourado/60 rounded px-2 py-1 text-sm"
                            />
                          ) : (
                            <button
                              onClick={() => startCell(v, "stock")}
                              disabled={!v.inventory_item_id}
                              title={v.inventory_item_id ? "Clique para editar o estoque" : "Sem item de estoque"}
                              className={`text-left rounded px-1 -mx-1 hover:bg-eclat-dourado/15 hover:underline decoration-dotted disabled:no-underline disabled:hover:bg-transparent disabled:cursor-default ${
                                baixo ? "text-red-700 font-medium" : ""
                              }`}
                            >
                              {v.stock ?? "—"}
                              {baixo && " ⚠"}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        {!loading && !erro && filtrados.length === 0 && (
          <p className="text-sm text-eclat-grafite/50">Nenhum produto encontrado.</p>
        )}
      </div>

      {form && (
        <ProductForm
          mode={form.mode}
          productId={form.id}
          onClose={() => setForm(null)}
          onSaved={() => {
            setForm(null)
            carregar()
          }}
        />
      )}

      {taxonomia && (
        <TaxonomyManager onClose={() => setTaxonomia(false)} onChanged={carregar} />
      )}

      {importar && (
        <ImportDialog onClose={() => setImportar(false)} onDone={carregar} />
      )}
    </div>
  )
}
