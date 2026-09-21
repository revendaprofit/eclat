"use client"

import { useCallback, useEffect, useState } from "react"

// Personas "Minha ÉCLAT" — modelos que a cliente escolhe no wizard da loja.
// CRUD de personas + fotos por produto × persona (URLs, uma por linha).
// Fotos: gerar com IA (peça ao Claude) ou subir em Vitrine → Mídia e colar a URL.

type Persona = {
  id: string
  slug: string
  nome: string
  descricao: string | null
  avatar_url: string | null
  ordem: number
  ativo: boolean
}

type Media = { id: string; product_id: string; persona_id: string; images: string[] }

const input =
  "w-full border border-eclat-pedra/50 rounded px-3 py-2 text-corpo bg-white/80 text-eclat-texto focus:outline-none focus:border-eclat-dourado"

const emptyP = { id: "", slug: "", nome: "", descricao: "", avatar_url: "", ordem: 0, ativo: true }

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [form, setForm] = useState<typeof emptyP | null>(null)
  const [msg, setMsg] = useState("")
  // interruptor global "Minha ÉCLAT no site" (site_content.personas = { ativo }); null = carregando
  const [ativo, setAtivo] = useState<boolean | null>(null)
  const [salvandoAtivo, setSalvandoAtivo] = useState(false)
  // mídia por produto
  const [productId, setProductId] = useState("")
  const [media, setMedia] = useState<Media[]>([])
  const [mediaPersona, setMediaPersona] = useState("")
  const [mediaUrls, setMediaUrls] = useState("")

  const load = useCallback(async () => {
    const r = await fetch("/api/personas")
    if (r.ok) setPersonas(await r.json())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  async function savePersona() {
    if (!form) return
    setMsg("")
    const payload = {
      slug: form.slug || form.nome.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      nome: form.nome,
      descricao: form.descricao || null,
      avatar_url: form.avatar_url || null,
      ordem: form.ordem,
      ativo: form.ativo,
    }
    const r = form.id
      ? await fetch(`/api/personas/${form.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      : await fetch("/api/personas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      setMsg(`Erro: ${(e as { error?: string }).error || r.status}`)
      return
    }
    setForm(null)
    load()
  }

  async function loadMedia() {
    if (!productId.trim()) return
    const r = await fetch(`/api/persona-media?product_id=${encodeURIComponent(productId.trim())}`)
    if (r.ok) setMedia(await r.json())
  }

  async function saveMedia() {
    if (!productId.trim() || !mediaPersona) return
    setMsg("")
    const images = mediaUrls.split("\n").map((s) => s.trim()).filter(Boolean)
    const r = await fetch("/api/persona-media", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId.trim(), persona_id: mediaPersona, images }),
    })
    if (!r.ok) {
      const e = await r.json().catch(() => ({}))
      setMsg(`Erro ao salvar fotos: ${(e as { error?: string }).error || r.status}`)
      return
    }
    setMediaUrls("")
    loadMedia()
  }

  useEffect(() => {
    fetch("/api/site-content/personas", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : {}))
      .then((v: { ativo?: unknown }) => setAtivo(typeof v?.ativo === "boolean" ? v.ativo : true))
      .catch(() => setAtivo(true))
  }, [])

  async function alternarAtivo() {
    if (ativo === null || salvandoAtivo) return
    const proximo = !ativo
    setSalvandoAtivo(true)
    setMsg("")
    try {
      const r = await fetch("/api/site-content/personas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ativo: proximo }),
      })
      if (!r.ok) throw new Error((await r.json()).error || "Falha ao salvar")
      setAtivo(proximo)
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao salvar")
    } finally {
      setSalvandoAtivo(false)
    }
  }

  return (
    <div className="flex flex-col gap-8 max-w-3xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-texto">Personas — Minha ÉCLAT</h1>
        <p className="text-corpo text-eclat-texto-3 mt-1">
          As modelos que a cliente escolhe no wizard da loja. Cada produto pode ter
          fotos específicas por persona (geradas com IA — selo de transparência
          aparece na loja automaticamente).
        </p>
      </div>

      {/* INTERRUPTOR GLOBAL */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-serif text-xl text-eclat-texto">Minha ÉCLAT no site</h2>
          <p className="text-meta text-eclat-texto-3 mt-1">
            Desativada, o site esconde o wizard, o botão &quot;Minha ÉCLAT&quot; do menu e as fotos por
            persona; o cadastro abaixo fica guardado. O site reflete em até 30 segundos.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={ativo === true}
          aria-label="Minha ÉCLAT no site"
          disabled={ativo === null || salvandoAtivo}
          onClick={alternarAtivo}
          className="flex items-center gap-2 text-corpo text-eclat-texto disabled:opacity-50 shrink-0"
        >
          <span className={`relative inline-block h-6 w-11 rounded-full transition-colors ${ativo ? "bg-eclat-dourado" : "bg-eclat-pedra/60"}`}>
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${ativo ? "translate-x-5" : "translate-x-0.5"}`} />
          </span>
          <span className="min-w-[80px] text-left">{ativo === null ? "carregando…" : ativo ? "ativa" : "desativada"}</span>
        </button>
      </section>

      {/* PERSONAS */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-texto">Modelos</h2>
          {!form && (
            <button onClick={() => setForm({ ...emptyP })} className="bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-corpo px-4 py-2 rounded">
              + Nova persona
            </button>
          )}
        </div>

        {form && (
          <div className="border border-eclat-pedra/40 rounded p-4 flex flex-col gap-2.5 bg-eclat-areia/20">
            <label className="text-meta text-eclat-texto-3">
              Nome
              <input className={input} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Aurora" />
            </label>
            <label className="text-meta text-eclat-texto-3">
              Descrição curta (aparece no wizard)
              <input className={input} value={form.descricao ?? ""} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Ex.: 1,70m · veste M" />
            </label>
            <label className="text-meta text-eclat-texto-3">
              Avatar (URL da foto do seletor)
              <input className={input} value={form.avatar_url ?? ""} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} placeholder="https://…" />
            </label>
            <div className="flex gap-3 items-center">
              <label className="text-meta text-eclat-texto-3">
                Ordem
                <input type="number" className={input} value={form.ordem} onChange={(e) => setForm({ ...form, ordem: Number(e.target.value) })} />
              </label>
              <label className="text-meta text-eclat-texto-3 flex items-center gap-2 mt-4">
                <input type="checkbox" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.target.checked })} />
                Ativa na loja
              </label>
            </div>
            <div className="flex gap-2">
              <button onClick={savePersona} disabled={!form.nome} className="bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-corpo px-4 py-2 rounded disabled:opacity-50">
                Salvar
              </button>
              <button onClick={() => setForm(null)} className="text-corpo text-eclat-texto-3 px-2">
                Cancelar
              </button>
            </div>
          </div>
        )}

        <ul className="divide-y divide-eclat-pedra/30">
          {personas.map((p) => (
            <li key={p.id} className="py-2.5 flex items-center gap-3">
              {p.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.avatar_url} alt={p.nome} className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-eclat-areia" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-corpo text-eclat-texto">
                  {p.nome} <span className="text-eclat-texto/40 text-meta">({p.slug})</span>
                </p>
                <p className="text-meta text-eclat-texto-3 truncate">{p.descricao}</p>
              </div>
              <span className={`text-meta px-2 py-0.5 rounded-full ${p.ativo ? "bg-green-100 text-green-800" : "bg-eclat-areia text-eclat-texto-3"}`}>
                {p.ativo ? "ativa" : "inativa"}
              </span>
              <button onClick={() => setForm({ id: p.id, slug: p.slug, nome: p.nome, descricao: p.descricao ?? "", avatar_url: p.avatar_url ?? "", ordem: p.ordem, ativo: p.ativo })} className="text-corpo underline text-eclat-texto-2">
                editar
              </button>
            </li>
          ))}
          {personas.length === 0 && <li className="py-3 text-corpo text-eclat-texto-3">Nenhuma persona ainda.</li>}
        </ul>
      </section>

      {/* FOTOS POR PRODUTO */}
      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-3">
        <h2 className="font-serif text-xl text-eclat-texto">Fotos por produto × persona</h2>
        <p className="text-meta text-eclat-texto-3">
          Informe o <strong>handle</strong> do produto (ex.: <code>calca-flare-eclat</code>) ou o id
          (<code>prod_…</code>), carregue, escolha a persona e cole as URLs das fotos (uma por linha, em ordem).
        </p>
        <div className="flex gap-2">
          <input className={input} value={productId} onChange={(e) => setProductId(e.target.value)} placeholder="handle ou prod_id do produto" />
          <button onClick={loadMedia} className="shrink-0 border border-eclat-pedra/60 text-corpo px-4 rounded hover:bg-eclat-areia/40">
            Carregar
          </button>
        </div>

        {media.length > 0 && (
          <ul className="text-meta text-eclat-texto-2 flex flex-col gap-1">
            {media.map((m) => (
              <li key={m.id}>
                <strong>{personas.find((p) => p.id === m.persona_id)?.nome || m.persona_id}</strong>: {m.images.length} foto(s)
              </li>
            ))}
          </ul>
        )}

        <div className="flex flex-col gap-2 border-t border-eclat-pedra/30 pt-3">
          <select className={input} value={mediaPersona} onChange={(e) => setMediaPersona(e.target.value)}>
            <option value="">— persona —</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>{p.nome}</option>
            ))}
          </select>
          <textarea className={`${input} font-mono`} rows={4} value={mediaUrls} onChange={(e) => setMediaUrls(e.target.value)} placeholder={"https://...foto-frente.png\nhttps://...foto-costas.png"} />
          <button onClick={saveMedia} disabled={!productId.trim() || !mediaPersona} className="self-start bg-eclat-dourado/90 hover:bg-eclat-dourado text-white text-corpo px-4 py-2 rounded disabled:opacity-50">
            Salvar fotos desta persona
          </button>
        </div>
        {msg && <p className="text-corpo text-red-700">{msg}</p>}
      </section>
    </div>
  )
}
