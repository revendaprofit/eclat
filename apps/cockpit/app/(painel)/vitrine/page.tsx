"use client"

import { useCallback, useEffect, useState } from "react"

type Hero = {
  eyebrow_mode?: "collection" | "custom"
  eyebrow_text?: string
  collection_handle?: string
  collection_label?: string
  title?: string
  subtitle?: string
  cta_label?: string
  cta_href?: string
  image_url?: string
}
type Seo = { title?: string; description?: string; og_image_url?: string }
type Colecao = { id: string; title: string; handle: string }

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"

function UploadImagem({
  url,
  onChange,
}: {
  url?: string
  onChange: (url: string | undefined) => void
}) {
  const [enviando, setEnviando] = useState(false)
  async function enviar(file: File) {
    setEnviando(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/site-upload", { method: "POST", body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha no upload")
      onChange(d.url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }
  return (
    <div className="flex items-center gap-3">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="prévia" className="w-24 h-16 object-cover rounded border border-eclat-pedra/40" />
      )}
      <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} className="text-xs" />
      {enviando && <span className="text-xs text-eclat-grafite/50">enviando…</span>}
      {url && (
        <button onClick={() => onChange(undefined)} className="text-xs text-red-700 underline">remover</button>
      )}
    </div>
  )
}

export default function VitrinePage() {
  const [hero, setHero] = useState<Hero>({})
  const [seo, setSeo] = useState<Seo>({})
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [loading, setLoading] = useState(true)
  const [savingHero, setSavingHero] = useState(false)
  const [savingSeo, setSavingSeo] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const [h, s, c] = await Promise.all([
      fetch("/api/site-content/hero", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/site-content/seo.home", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/taxonomy/collections", { cache: "no-store" }).then((r) => r.json()),
    ])
    setHero(h && !h.error ? h : {})
    setSeo(s && !s.error ? s : {})
    if (Array.isArray(c)) setColecoes(c)
    setLoading(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(key: string, value: unknown, setBusy: (b: boolean) => void) {
    setBusy(true)
    try {
      const r = await fetch(`/api/site-content/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Salvo! A vitrine atualiza em até ~30s.")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const modo = hero.eyebrow_mode || "collection"

  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>

  return (
    <div className="flex flex-col gap-10 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Vitrine (site)</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">Textos, imagens e SEO da loja — editáveis aqui.</p>
      </div>

      {/* HERO */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4">
        <h2 className="font-serif text-xl text-eclat-grafite">Hero (primeira dobra)</h2>

        <div>
          <span className={label}>Destaque (eyebrow)</span>
          <div className="flex gap-4 text-sm mb-2">
            <label className="flex items-center gap-1">
              <input type="radio" checked={modo === "collection"} onChange={() => setHero({ ...hero, eyebrow_mode: "collection" })} /> Coleção
            </label>
            <label className="flex items-center gap-1">
              <input type="radio" checked={modo === "custom"} onChange={() => setHero({ ...hero, eyebrow_mode: "custom" })} /> Texto livre
            </label>
          </div>
          {modo === "collection" ? (
            <select
              value={hero.collection_handle || ""}
              onChange={(e) => {
                const col = colecoes.find((c) => c.handle === e.target.value)
                setHero({ ...hero, collection_handle: col?.handle, collection_label: col?.title })
              }}
              className={input}
            >
              <option value="">(primeira coleção, automático)</option>
              {colecoes.map((c) => (
                <option key={c.id} value={c.handle}>{c.title}</option>
              ))}
            </select>
          ) : (
            <input value={hero.eyebrow_text || ""} onChange={(e) => setHero({ ...hero, eyebrow_text: e.target.value })} placeholder="ex.: Nova coleção" className={input} />
          )}
        </div>

        <div>
          <label className={label}>Título</label>
          <input value={hero.title || ""} onChange={(e) => setHero({ ...hero, title: e.target.value })} placeholder="A luz da mulher inteira" className={input} />
        </div>
        <div>
          <label className={label}>Subtítulo</label>
          <textarea value={hero.subtitle || ""} onChange={(e) => setHero({ ...hero, subtitle: e.target.value })} rows={3} placeholder="Athleisure premium…" className={input + " resize-y"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Texto do botão</label>
            <input value={hero.cta_label || ""} onChange={(e) => setHero({ ...hero, cta_label: e.target.value })} placeholder="Explorar a coleção" className={input} />
          </div>
          <div>
            <label className={label}>Link do botão</label>
            <input value={hero.cta_href || ""} onChange={(e) => setHero({ ...hero, cta_href: e.target.value })} placeholder="/store" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Imagem do hero (full-bleed)</label>
          <UploadImagem url={hero.image_url} onChange={(u) => setHero({ ...hero, image_url: u })} />
          <p className="text-xs text-eclat-grafite/50 mt-1">Foto editorial vertical funciona melhor no mobile.</p>
        </div>

        <button onClick={() => salvar("hero", hero, setSavingHero)} disabled={savingHero} className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50">
          {savingHero ? "Salvando…" : "Salvar hero"}
        </button>
      </section>

      {/* SEO HOME */}
      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4">
        <h2 className="font-serif text-xl text-eclat-grafite">SEO da home</h2>
        <div>
          <label className={label}>Título (aba do navegador / Google)</label>
          <input value={seo.title || ""} onChange={(e) => setSeo({ ...seo, title: e.target.value })} placeholder="use.ÉCLAT — athleisure da mulher inteira" className={input} />
        </div>
        <div>
          <label className={label}>Descrição</label>
          <textarea value={seo.description || ""} onChange={(e) => setSeo({ ...seo, description: e.target.value })} rows={2} className={input + " resize-y"} />
        </div>
        <div>
          <label className={label}>Imagem de compartilhamento (Open Graph)</label>
          <UploadImagem url={seo.og_image_url} onChange={(u) => setSeo({ ...seo, og_image_url: u })} />
        </div>
        <button onClick={() => salvar("seo.home", seo, setSavingSeo)} disabled={savingSeo} className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50">
          {savingSeo ? "Salvando…" : "Salvar SEO"}
        </button>
      </section>
    </div>
  )
}
