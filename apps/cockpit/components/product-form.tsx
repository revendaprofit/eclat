"use client"

import { useEffect, useMemo, useState } from "react"

type Ref = { id: string; name: string }
type Cat = { id: string; name: string; parent_id: string | null; rank: number }

// slug URL-safe (sem acento, sem traço nas pontas) — lição do Medusa.
function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}
const skuPart = (s: string, n: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, n) || "X"

const TAMANHOS_PADRAO = ["P", "M", "G", "GG"]

export default function ProductForm({
  mode,
  productId,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit"
  productId?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [collections, setCollections] = useState<Ref[]>([])
  const [categories, setCategories] = useState<Cat[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  // campos do produto
  const [titulo, setTitulo] = useState("")
  const [handle, setHandle] = useState("")
  const [handleTocado, setHandleTocado] = useState(false)
  const [descricao, setDescricao] = useState("")
  const [status, setStatus] = useState<"published" | "draft">("draft")
  const [collectionId, setCollectionId] = useState("")
  const [catIds, setCatIds] = useState<string[]>([])
  const [peso, setPeso] = useState("")
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [enviandoImg, setEnviandoImg] = useState(false)
  const [meta, setMeta] = useState<{ k: string; v: string }[]>([{ k: "", v: "" }])

  // variantes (apenas no modo criar)
  const [tamanhos, setTamanhos] = useState<string[]>(["P", "M", "G", "GG"])
  const [cores, setCores] = useState<string[]>([])
  const [novaCor, setNovaCor] = useState("")
  const [precoBase, setPrecoBase] = useState("")
  const [custoBase, setCustoBase] = useState("")
  const [estoqueBase, setEstoqueBase] = useState("0")

  // carregar metas + (se edição) o produto
  useEffect(() => {
    ;(async () => {
      try {
        const mr = await fetch("/api/catalog-meta", { cache: "no-store" })
        const md = await mr.json()
        if (!mr.ok) throw new Error(md.error || "Falha ao carregar coleções/categorias")
        setCollections(md.collections)
        setCategories(md.categories)
        if (mode === "edit" && productId) {
          const pr = await fetch(`/api/products/${productId}`, { cache: "no-store" })
          const p = await pr.json()
          if (!pr.ok) throw new Error(p.error || "Falha ao carregar produto")
          setTitulo(p.title)
          setHandle(p.handle)
          setHandleTocado(true)
          setDescricao(p.description ?? "")
          setStatus(p.status === "published" ? "published" : "draft")
          setCollectionId(p.collection_id ?? "")
          setCatIds(p.category_ids ?? [])
          setPeso(p.weight != null ? String(p.weight) : "")
          setThumbnail(p.thumbnail ?? null)
          const entries = Object.entries(p.metadata ?? {})
          setMeta(entries.length ? entries.map(([k, v]) => ({ k, v: String(v) })) : [{ k: "", v: "" }])
        }
      } catch (e) {
        setErro((e as Error).message)
      } finally {
        setCarregando(false)
      }
    })()
  }, [mode, productId])

  // handle acompanha o título até o usuário editar o handle manualmente
  useEffect(() => {
    if (!handleTocado) setHandle(slugify(titulo))
  }, [titulo, handleTocado])

  // categorias ordenadas em árvore (pai → filhos) com profundidade
  const catsArvore = useMemo(() => {
    const byParent = new Map<string | null, Cat[]>()
    categories.forEach((c) => {
      const k = c.parent_id
      if (!byParent.has(k)) byParent.set(k, [])
      byParent.get(k)!.push(c)
    })
    byParent.forEach((arr) => arr.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name)))
    const out: { cat: Cat; depth: number }[] = []
    const walk = (parent: string | null, depth: number) => {
      for (const c of byParent.get(parent) ?? []) {
        out.push({ cat: c, depth })
        walk(c.id, depth + 1)
      }
    }
    walk(null, 0)
    return out
  }, [categories])

  const variantesPreview = useMemo(() => {
    if (mode !== "create") return []
    const pref = skuPart(titulo, 3)
    const ts = tamanhos.length ? tamanhos : [""]
    const cs = cores.length ? cores : [""]
    const out: { title: string; sku: string; options: Record<string, string> }[] = []
    for (const c of cs) {
      for (const t of ts) {
        if (!t && !c) {
          out.push({ title: "Padrão", sku: pref, options: { Padrão: "Único" } })
          continue
        }
        const partes = [t, c].filter(Boolean)
        const skuPartes = [pref, t && t, c && skuPart(c, 3)].filter(Boolean)
        const options: Record<string, string> = {}
        if (t) options.Tamanho = t
        if (c) options.Cor = c
        out.push({ title: partes.join(" / "), sku: skuPartes.join("-"), options })
      }
    }
    return out
  }, [mode, titulo, tamanhos, cores])

  function toggleCat(id: string) {
    setCatIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }
  function toggleTamanho(t: string) {
    setTamanhos((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }
  function addCor() {
    const c = novaCor.trim()
    if (c && !cores.includes(c)) setCores([...cores, c])
    setNovaCor("")
  }

  async function enviarImagem(file: File) {
    setEnviandoImg(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/uploads", { method: "POST", body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha no upload")
      setThumbnail(d.url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnviandoImg(false)
    }
  }

  function metadataObj() {
    const o: Record<string, string> = {}
    meta.forEach(({ k, v }) => {
      if (k.trim()) o[k.trim()] = v
    })
    return o
  }

  async function salvar() {
    setErro(null)
    if (!titulo.trim()) return setErro("Informe o título.")
    if (!handle.trim()) return setErro("Informe o handle (URL).")
    const pesoNum = peso.trim() === "" ? null : Number(peso)
    setSalvando(true)
    try {
      if (mode === "create") {
        const preco = Number(precoBase.replace(",", "."))
        if (!(preco >= 0)) throw new Error("Informe um preço válido.")
        const estoque = Math.max(0, Math.round(Number(estoqueBase) || 0))
        const options: { title: string; values: string[] }[] = []
        if (tamanhos.length) options.push({ title: "Tamanho", values: tamanhos })
        if (cores.length) options.push({ title: "Cor", values: cores })
        if (!options.length) options.push({ title: "Padrão", values: ["Único"] })
        const variants = variantesPreview.map((v) => ({
          ...v,
          price: preco,
          stock: estoque,
        }))
        const custoNum = custoBase.trim() === "" ? null : Number(custoBase.replace(",", "."))
        const custo_centavos =
          custoNum != null && custoNum >= 0 ? Math.round(custoNum * 100) : undefined
        const r = await fetch("/api/products/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titulo.trim(),
            handle: handle.trim(),
            description: descricao,
            status,
            collection_id: collectionId || null,
            category_ids: catIds,
            weight: pesoNum,
            metadata: metadataObj(),
            thumbnail,
            options,
            variants,
            custo_centavos,
          }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Falha ao criar produto")
      } else {
        const r = await fetch(`/api/products/${productId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titulo.trim(),
            handle: handle.trim(),
            description: descricao,
            collection_id: collectionId || null,
            category_ids: catIds,
            weight: pesoNum,
            metadata: metadataObj(),
            thumbnail,
          }),
        })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Falha ao salvar produto")
      }
      onSaved()
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setSalvando(false)
    }
  }

  const inputCls =
    "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  const labelCls = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-xl h-full bg-eclat-luz overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-serif text-2xl text-eclat-grafite">
            {mode === "create" ? "Novo produto" : "Editar produto"}
          </h2>
          <button onClick={onClose} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">
            ✕
          </button>
        </div>

        {carregando ? (
          <p className="p-6 text-sm text-eclat-grafite/50">Carregando…</p>
        ) : (
          <div className="p-6 flex flex-col gap-4">
            {erro && (
              <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md p-3">
                {erro}
              </p>
            )}

            <div>
              <label className={labelCls}>Título *</label>
              <input value={titulo} onChange={(e) => setTitulo(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Handle (URL) *</label>
              <input
                value={handle}
                onChange={(e) => {
                  setHandleTocado(true)
                  setHandle(slugify(e.target.value))
                }}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Descrição</label>
              <textarea
                value={descricao}
                onChange={(e) => setDescricao(e.target.value)}
                rows={3}
                className={inputCls + " resize-y"}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Coleção</label>
                <select value={collectionId} onChange={(e) => setCollectionId(e.target.value)} className={inputCls}>
                  <option value="">— nenhuma —</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Peso (g)</label>
                <input value={peso} onChange={(e) => setPeso(e.target.value)} inputMode="numeric" className={inputCls} />
              </div>
            </div>

            <div>
              <label className={labelCls}>Categorias</label>
              <div className="border border-eclat-pedra/40 rounded-md p-2 max-h-40 overflow-y-auto flex flex-col gap-1 bg-white">
                {catsArvore.map(({ cat, depth }) => (
                  <label
                    key={cat.id}
                    className="flex items-center gap-1 text-sm cursor-pointer"
                    style={{ paddingLeft: depth * 18 }}
                  >
                    {depth > 0 && <span className="text-eclat-grafite/30">└</span>}
                    <input type="checkbox" checked={catIds.includes(cat.id)} onChange={() => toggleCat(cat.id)} className="accent-eclat-dourado" />
                    {cat.name}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className={labelCls}>Imagem (capa)</label>
              <div className="flex items-center gap-3">
                {thumbnail && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnail} alt="capa" className="w-16 h-16 rounded object-cover border border-eclat-pedra/40" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => e.target.files?.[0] && enviarImagem(e.target.files[0])}
                  className="text-xs"
                />
                {enviandoImg && <span className="text-xs text-eclat-grafite/50">enviando…</span>}
                {thumbnail && (
                  <button onClick={() => setThumbnail(null)} className="text-xs text-red-700 underline">remover</button>
                )}
              </div>
            </div>

            {mode === "create" && (
              <div className="border border-eclat-dourado/40 rounded-lg p-4 bg-white/60 flex flex-col gap-3">
                <h3 className="text-sm font-medium text-eclat-grafite">Variações</h3>
                <div>
                  <label className={labelCls}>Tamanhos</label>
                  <div className="flex flex-wrap gap-2">
                    {TAMANHOS_PADRAO.map((t) => (
                      <button
                        key={t}
                        onClick={() => toggleTamanho(t)}
                        className={`text-xs px-3 py-1 rounded-full border ${
                          tamanhos.includes(t)
                            ? "bg-eclat-dourado/30 border-eclat-dourado"
                            : "border-eclat-pedra/40 hover:bg-eclat-areia/40"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Cores</label>
                  <div className="flex flex-wrap gap-2 items-center">
                    {cores.map((c) => (
                      <span key={c} className="text-xs bg-eclat-areia/60 rounded-full px-2 py-1 flex items-center gap-1">
                        {c}
                        <button onClick={() => setCores(cores.filter((x) => x !== c))} className="text-eclat-grafite/50">✕</button>
                      </span>
                    ))}
                    <input
                      value={novaCor}
                      onChange={(e) => setNovaCor(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addCor()
                        }
                      }}
                      placeholder="+ cor (Enter)"
                      className="border border-eclat-pedra/50 rounded-md px-2 py-1 text-xs w-28 bg-white focus:outline-none focus:border-eclat-dourado"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Preço (R$) — todas</label>
                    <input value={precoBase} onChange={(e) => setPrecoBase(e.target.value)} inputMode="decimal" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Custo (R$) — todas</label>
                    <input value={custoBase} onChange={(e) => setCustoBase(e.target.value)} inputMode="decimal" className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Estoque — todas</label>
                    <input value={estoqueBase} onChange={(e) => setEstoqueBase(e.target.value)} inputMode="numeric" className={inputCls} />
                  </div>
                </div>
                <p className="text-xs text-eclat-grafite/60">
                  {variantesPreview.length} variação(ões) serão criadas. Preço e estoque ajustáveis depois na lista.
                </p>
              </div>
            )}

            <div>
              <label className={labelCls}>Ficha técnica (metadata)</label>
              <div className="flex flex-col gap-2">
                {meta.map((row, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={row.k}
                      onChange={(e) => setMeta(meta.map((m, j) => (j === i ? { ...m, k: e.target.value } : m)))}
                      placeholder="campo (ex.: composição)"
                      className={inputCls + " flex-1"}
                    />
                    <input
                      value={row.v}
                      onChange={(e) => setMeta(meta.map((m, j) => (j === i ? { ...m, v: e.target.value } : m)))}
                      placeholder="valor"
                      className={inputCls + " flex-1"}
                    />
                    <button onClick={() => setMeta(meta.filter((_, j) => j !== i))} className="text-eclat-grafite/40 px-1">✕</button>
                  </div>
                ))}
                <button onClick={() => setMeta([...meta, { k: "", v: "" }])} className="text-xs text-eclat-dourado underline self-start">
                  + adicionar campo
                </button>
              </div>
            </div>

            {mode === "create" && (
              <div>
                <label className={labelCls}>Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as "published" | "draft")} className={inputCls}>
                  <option value="draft">Rascunho</option>
                  <option value="published">Publicado</option>
                </select>
              </div>
            )}

            <div className="flex gap-3 pt-2 pb-8">
              <button
                onClick={salvar}
                disabled={salvando}
                className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
              >
                {salvando ? "Salvando…" : mode === "create" ? "Criar produto" : "Salvar alterações"}
              </button>
              <button onClick={onClose} className="text-sm text-eclat-grafite/60 underline">
                cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
