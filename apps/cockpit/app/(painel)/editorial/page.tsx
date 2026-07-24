"use client"

import { useCallback, useEffect, useState } from "react"

// Editorial ÉCLAT — CRUD de artigos/guias publicados na vitrine em /br/editorial.
// Corpo em Markdown simples: ## título, ### subtítulo, - lista, **negrito**,
// *itálico*, [link](url). Publicar => visível na loja em ~1 min.

type Post = {
  id: string
  slug: string
  title: string
  excerpt: string | null
  body_md?: string
  cover_url: string | null
  tags: string[]
  status: "draft" | "published"
  published_at: string | null
  updated_at: string
}

const empty = {
  id: "",
  slug: "",
  title: "",
  excerpt: "",
  body_md: "",
  cover_url: "",
  tags: "",
  status: "draft" as "draft" | "published",
  published_at: null as string | null,
}

type Form = typeof empty

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")

const input =
  "w-full border border-eclat-pedra/50 rounded px-3 py-2 text-sm bg-white/80 text-eclat-grafite focus:outline-none focus:border-eclat-dourado"

export default function EditorialPage() {
  const [posts, setPosts] = useState<Post[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState("")

  const load = useCallback(async () => {
    const r = await fetch("/api/editorial")
    if (r.ok) setPosts(await r.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function openEdit(id: string) {
    const r = await fetch(`/api/editorial/${id}`)
    if (!r.ok) return
    const p = (await r.json()) as Post
    setForm({
      id: p.id,
      slug: p.slug,
      title: p.title,
      excerpt: p.excerpt || "",
      body_md: p.body_md || "",
      cover_url: p.cover_url || "",
      tags: (p.tags || []).join(", "),
      status: p.status,
      published_at: p.published_at,
    })
    setMsg("")
  }

  async function save(publish?: boolean) {
    if (!form) return
    setSaving(true)
    setMsg("")
    const payload = {
      slug: form.slug || slugify(form.title),
      title: form.title,
      excerpt: form.excerpt || null,
      body_md: form.body_md,
      cover_url: form.cover_url || null,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      status: publish === undefined ? form.status : publish ? "published" : "draft",
      published_at: form.published_at,
    }
    const r = form.id
      ? await fetch(`/api/editorial/${form.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
      : await fetch("/api/editorial", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
    setSaving(false)
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      setMsg(`Erro ao salvar: ${(e as { error?: string }).error || r.status}`)
      return
    }
    setForm(null)
    load()
  }

  async function remove(id: string) {
    if (!confirm("Excluir este artigo? Essa ação não tem volta.")) return
    await fetch(`/api/editorial/${id}`, { method: "DELETE" })
    load()
  }

  return (
    <div className="flex flex-col gap-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-serif text-3xl text-eclat-grafite">Editorial</h1>
          <p className="text-sm text-eclat-grafite/60 mt-1">
            Artigos e guias publicados na loja em /editorial — a maior alavanca
            de citação por IA (GEO). Escreva respondendo perguntas reais de
            clientes.
          </p>
        </div>
        {!form && (
          <button
            onClick={() => {
              setForm({ ...empty })
              setMsg("")
            }}
            className="shrink-0 bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-sm px-4 py-2 rounded"
          >
            + Novo artigo
          </button>
        )}
      </div>

      {form && (
        <div className="border border-eclat-dourado/40 rounded-lg bg-white/70 p-5 flex flex-col gap-3">
          <label className="text-xs text-eclat-grafite/60">
            Título
            <input
              className={input}
              value={form.title}
              onChange={(e) =>
                setForm({
                  ...form,
                  title: e.target.value,
                  slug: form.id ? form.slug : slugify(e.target.value),
                })
              }
              placeholder="Ex.: Como escolher legging de compressão"
            />
          </label>
          <label className="text-xs text-eclat-grafite/60">
            Slug (URL: /br/editorial/…)
            <input
              className={input}
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
            />
          </label>
          <label className="text-xs text-eclat-grafite/60">
            Resumo (aparece no Google e nos cards — 1 a 2 frases)
            <textarea
              className={input}
              rows={2}
              value={form.excerpt}
              onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
            />
          </label>
          <label className="text-xs text-eclat-grafite/60">
            Imagem de capa (URL — use Vitrine → Mídia para subir)
            <input
              className={input}
              value={form.cover_url}
              onChange={(e) => setForm({ ...form, cover_url: e.target.value })}
              placeholder="https://…"
            />
          </label>
          <label className="text-xs text-eclat-grafite/60">
            Tags (separadas por vírgula)
            <input
              className={input}
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="legging, treino, guia"
            />
          </label>
          <label className="text-xs text-eclat-grafite/60">
            Corpo (Markdown: ## título · ### subtítulo · - lista · **negrito** ·
            [link](url))
            <textarea
              className={`${input} font-mono`}
              rows={16}
              value={form.body_md}
              onChange={(e) => setForm({ ...form, body_md: e.target.value })}
            />
          </label>
          {msg && <p className="text-sm text-red-700">{msg}</p>}
          <div className="flex gap-2 items-center">
            <button
              onClick={() => save(true)}
              disabled={saving || !form.title}
              className="bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-sm px-4 py-2 rounded disabled:opacity-50"
            >
              {saving ? "Salvando…" : "Publicar"}
            </button>
            <button
              onClick={() => save(false)}
              disabled={saving || !form.title}
              className="border border-eclat-pedra/60 text-eclat-grafite text-sm px-4 py-2 rounded hover:bg-eclat-areia/40 disabled:opacity-50"
            >
              Salvar rascunho
            </button>
            <button
              onClick={() => setForm(null)}
              className="text-sm text-eclat-grafite/60 hover:text-eclat-grafite px-2"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <ul className="flex flex-col divide-y divide-eclat-pedra/30 border border-eclat-pedra/30 rounded-lg bg-white/60">
        {posts.length === 0 && (
          <li className="p-4 text-sm text-eclat-grafite/50">
            Nenhum artigo ainda. Comece com guias que respondem perguntas de
            clientes (ex.: “qual tamanho de legging escolher?”).
          </li>
        )}
        {posts.map((p) => (
          <li key={p.id} className="p-4 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-eclat-grafite truncate">{p.title}</p>
              <p className="text-xs text-eclat-grafite/50 truncate">
                /editorial/{p.slug}
              </p>
            </div>
            <span
              className={`text-[11px] px-2 py-0.5 rounded-full ${
                p.status === "published"
                  ? "bg-green-100 text-green-800"
                  : "bg-eclat-areia text-eclat-grafite/70"
              }`}
            >
              {p.status === "published" ? "publicado" : "rascunho"}
            </span>
            <button
              onClick={() => openEdit(p.id)}
              className="text-sm text-eclat-grafite/70 hover:text-eclat-grafite underline"
            >
              editar
            </button>
            <button
              onClick={() => remove(p.id)}
              className="text-sm text-red-700/70 hover:text-red-700 underline"
            >
              excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
