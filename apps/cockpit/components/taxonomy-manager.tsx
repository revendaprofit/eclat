"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

type Cat = { id: string; name: string; parent_id: string | null; rank: number }
type Coll = { id: string; title: string; handle: string }
type Tag = { id: string; name: string }

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

export default function TaxonomyManager({
  onClose,
  onChanged,
}: {
  onClose: () => void
  onChanged: () => void
}) {
  const [cats, setCats] = useState<Cat[]>([])
  const [colls, setColls] = useState<Coll[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [novaTag, setNovaTag] = useState("")
  const [busy, setBusy] = useState(false)

  const carregar = useCallback(async () => {
    const [c, co, t] = await Promise.all([
      fetch("/api/taxonomy/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/taxonomy/collections", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/taxonomy/tags", { cache: "no-store" }).then((r) => r.json()),
    ])
    if (Array.isArray(c)) setCats(c)
    if (Array.isArray(co)) setColls(co)
    if (Array.isArray(t)) setTags(t)
  }, [])

  useEffect(() => {
    carregar()
  }, [carregar])

  // ordena categorias em árvore (pai → filhos), com profundidade
  const arvore = useMemo(() => {
    const byParent = new Map<string | null, Cat[]>()
    cats.forEach((c) => {
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
  }, [cats])

  async function call(url: string, method: string, body?: unknown) {
    setBusy(true)
    try {
      const r = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || "Falha na operação")
      await carregar()
      onChanged()
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  // ---- categorias ----
  function novaCategoria(parentId: string | null) {
    const name = prompt(parentId ? "Nome da subcategoria:" : "Nome da categoria:")
    if (name?.trim()) call("/api/taxonomy/categories", "POST", { name: name.trim(), parent_id: parentId })
  }
  function renomearCategoria(c: Cat) {
    const name = prompt("Novo nome da categoria:", c.name)
    if (name?.trim() && name.trim() !== c.name)
      call(`/api/taxonomy/categories/${c.id}`, "PATCH", { name: name.trim() })
  }
  function excluirCategoria(c: Cat) {
    if (cats.some((x) => x.parent_id === c.id))
      return alert("Esta categoria tem subcategorias. Exclua-as primeiro.")
    if (confirm(`Excluir a categoria "${c.name}"?`))
      call(`/api/taxonomy/categories/${c.id}`, "DELETE")
  }

  // ---- coleções ----
  function novaColecao() {
    const title = prompt("Nome da coleção:")
    if (!title?.trim()) return
    const handle = prompt("Handle (URL):", slug(title)) || slug(title)
    call("/api/taxonomy/collections", "POST", { title: title.trim(), handle: slug(handle) })
  }
  function renomearColecao(c: Coll) {
    const title = prompt("Novo nome da coleção:", c.title)
    if (title?.trim() && title.trim() !== c.title)
      call(`/api/taxonomy/collections/${c.id}`, "PATCH", { title: title.trim() })
  }
  function excluirColecao(c: Coll) {
    if (confirm(`Excluir a coleção "${c.title}"?`))
      call(`/api/taxonomy/collections/${c.id}`, "DELETE")
  }

  // ---- tags ----
  function addTag() {
    const v = novaTag.trim()
    if (!v) return
    setNovaTag("")
    call("/api/taxonomy/tags", "POST", { value: v })
  }
  function excluirTag(t: Tag) {
    if (confirm(`Excluir a tag "${t.name}"?`)) call(`/api/taxonomy/tags/${t.id}`, "DELETE")
  }

  const secaoTitulo = "font-serif text-xl text-eclat-grafite mb-2"

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-lg h-full bg-eclat-luz overflow-y-auto shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-eclat-luz border-b border-eclat-pedra/30 px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-serif text-2xl text-eclat-grafite">Categorias, coleções &amp; tags</h2>
          <button onClick={onClose} className="text-eclat-grafite/50 hover:text-eclat-grafite text-xl">✕</button>
        </div>

        <div className={`p-6 flex flex-col gap-8 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
          {/* Categorias */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className={secaoTitulo}>Categorias</h3>
              <button onClick={() => novaCategoria(null)} className="text-xs text-eclat-dourado underline">
                + categoria raiz
              </button>
            </div>
            <div className="border border-eclat-pedra/40 rounded-md bg-white divide-y divide-eclat-pedra/15">
              {arvore.length === 0 && <p className="p-3 text-sm text-eclat-grafite/50">Nenhuma categoria.</p>}
              {arvore.map(({ cat, depth }) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between px-3 py-2 text-sm group"
                  style={{ paddingLeft: 12 + depth * 20 }}
                >
                  <span className="flex items-center gap-1">
                    {depth > 0 && <span className="text-eclat-grafite/30">└</span>}
                    {cat.name}
                  </span>
                  <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                    <button onClick={() => novaCategoria(cat.id)} className="text-eclat-dourado underline" title="Adicionar subcategoria">+ sub</button>
                    <button onClick={() => renomearCategoria(cat)} className="underline">renomear</button>
                    <button onClick={() => excluirCategoria(cat)} className="text-red-700 underline">excluir</button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Coleções */}
          <section>
            <div className="flex items-center justify-between">
              <h3 className={secaoTitulo}>Coleções</h3>
              <button onClick={novaColecao} className="text-xs text-eclat-dourado underline">+ coleção</button>
            </div>
            <div className="border border-eclat-pedra/40 rounded-md bg-white divide-y divide-eclat-pedra/15">
              {colls.length === 0 && <p className="p-3 text-sm text-eclat-grafite/50">Nenhuma coleção.</p>}
              {colls.map((c) => (
                <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm group">
                  <span>
                    {c.title} <span className="text-eclat-grafite/40 text-xs">/{c.handle}</span>
                  </span>
                  <span className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs">
                    <button onClick={() => renomearColecao(c)} className="underline">renomear</button>
                    <button onClick={() => excluirColecao(c)} className="text-red-700 underline">excluir</button>
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* Tags */}
          <section>
            <h3 className={secaoTitulo}>Tags</h3>
            <div className="flex flex-wrap gap-2 items-center">
              {tags.map((t) => (
                <span key={t.id} className="text-xs bg-eclat-areia/60 rounded-full px-3 py-1 flex items-center gap-1">
                  {t.name}
                  <button onClick={() => excluirTag(t)} className="text-eclat-grafite/50 hover:text-red-700">✕</button>
                </span>
              ))}
              <input
                value={novaTag}
                onChange={(e) => setNovaTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    addTag()
                  }
                }}
                placeholder="+ tag (Enter)"
                className="border border-eclat-pedra/50 rounded-md px-2 py-1 text-xs w-28 bg-white focus:outline-none focus:border-eclat-dourado"
              />
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
