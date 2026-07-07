"use client"

import { useCallback, useEffect, useState } from "react"

type Marketing = {
  gtm_id?: string
  ga4_id?: string
  meta_pixel_id?: string
  google_ads_id?: string
  gsc_verification?: string
}

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado font-mono"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const hint = "text-xs text-eclat-grafite/50 mt-1"
const btn =
  "self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"

export default function MarketingPage() {
  const [m, setM] = useState<Marketing>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    const d = await fetch("/api/site-content/marketing", { cache: "no-store" }).then((r) => r.json())
    setM(d && !d.error ? d : {})
    setLoading(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function salvar() {
    setSaving(true)
    try {
      const r = await fetch("/api/site-content/marketing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(m),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Salvo! As tags atualizam na loja em até ~30s (sem redeploy).")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando…</p>

  return (
    <div className="flex flex-col gap-8 max-w-2xl">
      <div>
        <h1 className="font-serif text-3xl text-eclat-grafite">Marketing &amp; Rastreamento</h1>
        <p className="text-sm text-eclat-grafite/60 mt-1">
          Cole aqui os IDs. A loja injeta as tags automaticamente (sem redeploy). O
          gestor de tráfego configura GA4, Pixel e Google Ads <strong>dentro do GTM</strong>.
        </p>
      </div>

      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-5">
        <div>
          <label className={label}>Google Tag Manager (container)</label>
          <input value={m.gtm_id || ""} onChange={(e) => setM({ ...m, gtm_id: e.target.value.trim() })} placeholder="GTM-XXXXXXX" className={input} />
          <p className={hint}>O hub. Instala GA4, Meta Pixel e Google Ads por dentro dele. O site já envia os eventos de e-commerce (view_item, add_to_cart, begin_checkout, purchase) para o dataLayer.</p>
        </div>

        <div>
          <label className={label}>Meta Pixel ID</label>
          <input value={m.meta_pixel_id || ""} onChange={(e) => setM({ ...m, meta_pixel_id: e.target.value.trim() })} placeholder="1234567890" className={input} />
          <p className={hint}>Usado pela API de Conversões (CAPI) server-side. O Pixel do navegador você adiciona no GTM.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>GA4 (Measurement ID)</label>
            <input value={m.ga4_id || ""} onChange={(e) => setM({ ...m, ga4_id: e.target.value.trim() })} placeholder="G-XXXXXXX" className={input} />
          </div>
          <div>
            <label className={label}>Google Ads (Conversão)</label>
            <input value={m.google_ads_id || ""} onChange={(e) => setM({ ...m, google_ads_id: e.target.value.trim() })} placeholder="AW-XXXXXXX" className={input} />
          </div>
        </div>
        <p className={hint}>GA4 e Google Ads são informativos aqui — a instalação prática é feita no GTM.</p>

        <div>
          <label className={label}>Verificação Search Console</label>
          <input value={m.gsc_verification || ""} onChange={(e) => setM({ ...m, gsc_verification: e.target.value.trim() })} placeholder="conteúdo da meta google-site-verification" className={input} />
          <p className={hint}>Cole só o conteúdo (o valor do content=&quot;…&quot;). A loja insere a meta-tag no &lt;head&gt;.</p>
        </div>

        <button onClick={salvar} disabled={saving} className={btn}>
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </section>

      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 text-sm text-eclat-grafite/70 flex flex-col gap-2">
        <h2 className="font-serif text-lg text-eclat-grafite">API de Conversões (CAPI) — token</h2>
        <p>
          O <strong>token de acesso da CAPI</strong> é um segredo e não fica aqui (não pode ser
          público). Ele é configurado uma vez na variável de ambiente
          <code className="mx-1 px-1 bg-eclat-areia/50 rounded">META_CAPI_TOKEN</code> da loja
          (Vercel → eclat-loja). Com o <em>Meta Pixel ID</em> acima + esse token, a loja envia as
          conversões server-side com deduplicação.
        </p>
      </section>
    </div>
  )
}
