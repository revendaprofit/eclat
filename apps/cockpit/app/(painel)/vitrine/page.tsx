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

type LineItem = { label: string; caption?: string; href: string; image_url?: string }
type Manifesto = { visible?: boolean; text?: string }
type Linhas = { visible?: boolean; heading?: string; items?: LineItem[] }
type Featured = { visible?: boolean; heading?: string; collection_handle?: string }
type Banner = {
  visible?: boolean
  eyebrow?: string
  title?: string
  text?: string
  cta_label?: string
  cta_href?: string
  image_url?: string
  image_side?: "left" | "right"
}
type BenefitItem = { title: string; text?: string }
type Beneficios = { visible?: boolean; heading?: string; items?: BenefitItem[] }
type News = { visible?: boolean; title?: string; text?: string; button_label?: string }

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const btn =
  "self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"

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

function Toggle({
  on,
  onChange,
}: {
  on: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
      <input type="checkbox" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span className="text-eclat-grafite/70">Mostrar na home</span>
    </label>
  )
}

export default function VitrinePage() {
  const [hero, setHero] = useState<Hero>({})
  const [seo, setSeo] = useState<Seo>({})
  const [manifesto, setManifesto] = useState<Manifesto>({})
  const [linhas, setLinhas] = useState<Linhas>({})
  const [featured, setFeatured] = useState<Featured>({})
  const [banner, setBanner] = useState<Banner>({})
  const [beneficios, setBeneficios] = useState<Beneficios>({})
  const [news, setNews] = useState<News>({})
  const [colecoes, setColecoes] = useState<Colecao[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    const keys = [
      "hero",
      "seo.home",
      "home.manifesto",
      "home.lines",
      "home.featured",
      "home.banner",
      "home.benefits",
      "home.newsletter",
    ]
    const [h, s, m, l, f, b, bf, n, c] = await Promise.all([
      ...keys.map((k) =>
        fetch(`/api/site-content/${k}`, { cache: "no-store" }).then((r) => r.json())
      ),
      fetch("/api/taxonomy/collections", { cache: "no-store" }).then((r) => r.json()),
    ])
    const ok = (x: unknown) => (x && !(x as { error?: string }).error ? x : {})
    setHero(ok(h) as Hero)
    setSeo(ok(s) as Seo)
    setManifesto(ok(m) as Manifesto)
    setLinhas(ok(l) as Linhas)
    setFeatured(ok(f) as Featured)
    setBanner(ok(b) as Banner)
    setBeneficios(ok(bf) as Beneficios)
    setNews(ok(n) as News)
    if (Array.isArray(c)) setColecoes(c)
    setLoading(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar(key: string, value: unknown) {
    setSaving(key)
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
      setSaving(null)
    }
  }

  const modo = hero.eyebrow_mode || "collection"
  const lineItems: LineItem[] =
    linhas.items && linhas.items.length
      ? linhas.items
      : [
          { label: "Treino", caption: "Alta performance e caimento que valoriza", href: "/categories/treino" },
          { label: "Casual", caption: "Do estúdio à rua, sem perder a elegância", href: "/categories/casual" },
        ]
  const benItems: BenefitItem[] =
    beneficios.items && beneficios.items.length
      ? beneficios.items
      : [
          { title: "Tecido premium", text: "Compressão e toque que duram." },
          { title: "Caimento que valoriza", text: "Modelagem pensada no corpo real." },
          { title: "Frete para todo o Brasil", text: "Rápido e rastreado." },
          { title: "Troca fácil", text: "30 dias para trocar ou devolver." },
        ]

  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>

  const sectionA = "border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4"
  const sectionB = "border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 flex flex-col gap-4"

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Vitrine (site)</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          Textos, imagens e SEO da loja — editáveis aqui. Cada bloco tem liga/desliga.
        </p>
      </div>

      {/* HERO */}
      <section className={sectionA}>
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
        <button onClick={() => salvar("hero", hero)} disabled={saving === "hero"} className={btn}>
          {saving === "hero" ? "Salvando…" : "Salvar hero"}
        </button>
      </section>

      {/* MANIFESTO */}
      <section className={sectionB}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Manifesto</h2>
          <Toggle on={manifesto.visible !== false} onChange={(v) => setManifesto({ ...manifesto, visible: v })} />
        </div>
        <div>
          <label className={label}>Frase da marca</label>
          <textarea value={manifesto.text || ""} onChange={(e) => setManifesto({ ...manifesto, text: e.target.value })} rows={3} placeholder="A Éclat veste a mulher inteira…" className={input + " resize-y"} />
        </div>
        <button onClick={() => salvar("home.manifesto", manifesto)} disabled={saving === "home.manifesto"} className={btn}>
          {saving === "home.manifesto" ? "Salvando…" : "Salvar manifesto"}
        </button>
      </section>

      {/* LINHAS EM DESTAQUE */}
      <section className={sectionA}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Linhas em destaque</h2>
          <Toggle on={linhas.visible !== false} onChange={(v) => setLinhas({ ...linhas, visible: v })} />
        </div>
        <div>
          <label className={label}>Título da seção</label>
          <input value={linhas.heading ?? "Nossas linhas"} onChange={(e) => setLinhas({ ...linhas, heading: e.target.value })} className={input} />
        </div>
        {lineItems.map((it, i) => (
          <div key={i} className="border border-eclat-pedra/30 rounded p-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={label}>Rótulo</label>
                <input value={it.label} onChange={(e) => {
                  const items = [...lineItems]; items[i] = { ...it, label: e.target.value }; setLinhas({ ...linhas, items })
                }} className={input} />
              </div>
              <div>
                <label className={label}>Link</label>
                <input value={it.href} onChange={(e) => {
                  const items = [...lineItems]; items[i] = { ...it, href: e.target.value }; setLinhas({ ...linhas, items })
                }} className={input} placeholder="/categories/treino" />
              </div>
            </div>
            <div>
              <label className={label}>Legenda</label>
              <input value={it.caption || ""} onChange={(e) => {
                const items = [...lineItems]; items[i] = { ...it, caption: e.target.value }; setLinhas({ ...linhas, items })
              }} className={input} />
            </div>
            <div>
              <label className={label}>Imagem</label>
              <UploadImagem url={it.image_url} onChange={(u) => {
                const items = [...lineItems]; items[i] = { ...it, image_url: u }; setLinhas({ ...linhas, items })
              }} />
            </div>
          </div>
        ))}
        <button onClick={() => salvar("home.lines", { ...linhas, items: lineItems })} disabled={saving === "home.lines"} className={btn}>
          {saving === "home.lines" ? "Salvando…" : "Salvar linhas"}
        </button>
      </section>

      {/* COLEÇÃO EM DESTAQUE */}
      <section className={sectionB}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Coleção em destaque</h2>
          <Toggle on={featured.visible !== false} onChange={(v) => setFeatured({ ...featured, visible: v })} />
        </div>
        <div>
          <label className={label}>Título da seção</label>
          <input value={featured.heading ?? "Coleção em destaque"} onChange={(e) => setFeatured({ ...featured, heading: e.target.value })} className={input} />
        </div>
        <div>
          <label className={label}>Coleção</label>
          <select value={featured.collection_handle || ""} onChange={(e) => setFeatured({ ...featured, collection_handle: e.target.value })} className={input}>
            <option value="">(primeira coleção, automático)</option>
            {colecoes.map((c) => (
              <option key={c.id} value={c.handle}>{c.title}</option>
            ))}
          </select>
        </div>
        <button onClick={() => salvar("home.featured", featured)} disabled={saving === "home.featured"} className={btn}>
          {saving === "home.featured" ? "Salvando…" : "Salvar coleção"}
        </button>
      </section>

      {/* BANNER EDITORIAL */}
      <section className={sectionA}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Banner editorial / campanha</h2>
          <Toggle on={banner.visible !== false} onChange={(v) => setBanner({ ...banner, visible: v })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Eyebrow</label>
            <input value={banner.eyebrow || ""} onChange={(e) => setBanner({ ...banner, eyebrow: e.target.value })} placeholder="Nova estação" className={input} />
          </div>
          <div>
            <label className={label}>Lado da imagem</label>
            <select value={banner.image_side || "right"} onChange={(e) => setBanner({ ...banner, image_side: e.target.value as "left" | "right" })} className={input}>
              <option value="right">Direita</option>
              <option value="left">Esquerda</option>
            </select>
          </div>
        </div>
        <div>
          <label className={label}>Título</label>
          <input value={banner.title || ""} onChange={(e) => setBanner({ ...banner, title: e.target.value })} placeholder="Resplendor" className={input} />
        </div>
        <div>
          <label className={label}>Texto</label>
          <textarea value={banner.text || ""} onChange={(e) => setBanner({ ...banner, text: e.target.value })} rows={2} className={input + " resize-y"} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Texto do botão</label>
            <input value={banner.cta_label || ""} onChange={(e) => setBanner({ ...banner, cta_label: e.target.value })} placeholder="Explorar coleção" className={input} />
          </div>
          <div>
            <label className={label}>Link do botão</label>
            <input value={banner.cta_href || ""} onChange={(e) => setBanner({ ...banner, cta_href: e.target.value })} placeholder="/store" className={input} />
          </div>
        </div>
        <div>
          <label className={label}>Imagem</label>
          <UploadImagem url={banner.image_url} onChange={(u) => setBanner({ ...banner, image_url: u })} />
        </div>
        <button onClick={() => salvar("home.banner", banner)} disabled={saving === "home.banner"} className={btn}>
          {saving === "home.banner" ? "Salvando…" : "Salvar banner"}
        </button>
      </section>

      {/* BENEFÍCIOS */}
      <section className={sectionB}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Faixa de benefícios</h2>
          <Toggle on={beneficios.visible !== false} onChange={(v) => setBeneficios({ ...beneficios, visible: v })} />
        </div>
        {benItems.map((it, i) => (
          <div key={i} className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className={label}>Título {i + 1}</label>
              <input value={it.title} onChange={(e) => {
                const items = [...benItems]; items[i] = { ...it, title: e.target.value }; setBeneficios({ ...beneficios, items })
              }} className={input} />
            </div>
            <div>
              <label className={label}>Texto</label>
              <input value={it.text || ""} onChange={(e) => {
                const items = [...benItems]; items[i] = { ...it, text: e.target.value }; setBeneficios({ ...beneficios, items })
              }} className={input} />
            </div>
          </div>
        ))}
        <button onClick={() => salvar("home.benefits", { ...beneficios, items: benItems })} disabled={saving === "home.benefits"} className={btn}>
          {saving === "home.benefits" ? "Salvando…" : "Salvar benefícios"}
        </button>
      </section>

      {/* NEWSLETTER */}
      <section className={sectionA}>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-eclat-grafite">Newsletter</h2>
          <Toggle on={news.visible !== false} onChange={(v) => setNews({ ...news, visible: v })} />
        </div>
        <div>
          <label className={label}>Título</label>
          <input value={news.title || ""} onChange={(e) => setNews({ ...news, title: e.target.value })} placeholder="Faça parte da Éclat" className={input} />
        </div>
        <div>
          <label className={label}>Texto</label>
          <textarea value={news.text || ""} onChange={(e) => setNews({ ...news, text: e.target.value })} rows={2} className={input + " resize-y"} />
        </div>
        <div>
          <label className={label}>Texto do botão</label>
          <input value={news.button_label || ""} onChange={(e) => setNews({ ...news, button_label: e.target.value })} placeholder="Quero receber" className={input} />
        </div>
        <button onClick={() => salvar("home.newsletter", news)} disabled={saving === "home.newsletter"} className={btn}>
          {saving === "home.newsletter" ? "Salvando…" : "Salvar newsletter"}
        </button>
      </section>

      {/* SEO HOME */}
      <section className={sectionB}>
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
        <button onClick={() => salvar("seo.home", seo)} disabled={saving === "seo.home"} className={btn}>
          {saving === "seo.home" ? "Salvando…" : "Salvar SEO"}
        </button>
      </section>
    </div>
  )
}
