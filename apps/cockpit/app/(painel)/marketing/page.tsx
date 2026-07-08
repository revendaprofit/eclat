"use client"

import { useCallback, useEffect, useState } from "react"

type Marketing = {
  gtm_id?: string
  ga4_id?: string
  meta_pixel_id?: string
  google_ads_id?: string
  gsc_verification?: string
}

const STORE_URL = "https://www.useeclat.com.br"

const input =
  "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado font-mono"
const label = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"
const hint = "text-xs text-eclat-grafite/55 mt-1 leading-relaxed"
const btn =
  "self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite disabled:opacity-50"
const code =
  "px-1.5 py-0.5 bg-eclat-areia/60 rounded text-[12px] font-mono text-eclat-grafite break-all"

// item de checklist (visual, não persiste — é um guia)
function Step({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2 text-sm text-eclat-grafite/80 leading-relaxed">
      <span className="text-eclat-dourado mt-0.5">☐</span>
      <span>{children}</span>
    </li>
  )
}

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
          A estrutura de tráfego já está construída no site. Esta tela é o painel de{" "}
          <strong>ativação</strong>: cole os IDs quando for rodar anúncios. Enquanto não
          preencher, nada é rastreado (e nada quebra).
        </p>
      </div>

      {/* AVISO: construir primeiro */}
      <div className="rounded-lg bg-eclat-dourado/10 border border-eclat-dourado/40 p-4 text-sm text-eclat-grafite/80 leading-relaxed">
        <strong>Como usar:</strong> você pode deixar tudo em branco por enquanto. Quando for
        ativar o tráfego, siga o <strong>Checklist de ativação</strong> no fim desta página —
        ele diz exatamente onde pegar cada ID e o que fazer em cada plataforma.
      </div>

      {/* CONFIG */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-white/60 p-5 flex flex-col gap-5">
        <h2 className="font-serif text-xl text-eclat-grafite">IDs de rastreamento</h2>

        <div>
          <label className={label}>Google Tag Manager (container)</label>
          <input value={m.gtm_id || ""} onChange={(e) => setM({ ...m, gtm_id: e.target.value.trim() })} placeholder="GTM-XXXXXXX" className={input} />
          <p className={hint}>
            <strong>Onde pegar:</strong> tagmanager.google.com → crie um contêiner do tipo{" "}
            <em>Web</em> → copie o ID <code className={code}>GTM-XXXXXXX</code> no topo.
            <br />
            <strong>É o hub:</strong> depois de colar aqui, o gestor instala GA4, Pixel e
            Google Ads <em>dentro</em> do GTM. O site já envia os eventos de e-commerce
            (view_item, add_to_cart, begin_checkout, purchase) pro dataLayer automaticamente.
          </p>
        </div>

        <div>
          <label className={label}>Meta Pixel ID</label>
          <input value={m.meta_pixel_id || ""} onChange={(e) => setM({ ...m, meta_pixel_id: e.target.value.trim() })} placeholder="1234567890123456" className={input} />
          <p className={hint}>
            <strong>Onde pegar:</strong> business.facebook.com → Gerenciador de Eventos → sua
            Fonte de Dados (Pixel) → o número do ID.
            <br />
            Usado pela <strong>API de Conversões (CAPI)</strong> server-side. O Pixel do
            navegador você adiciona no GTM. Junto do token (abaixo), o site envia o{" "}
            <em>Purchase</em> com deduplicação.
          </p>
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
        <p className={hint}>
          <strong>Onde pegar:</strong> GA4 em analytics.google.com (Admin → Fluxos de dados →{" "}
          <code className={code}>G-…</code>); Google Ads em ads.google.com (Ferramentas →
          Conversões → <code className={code}>AW-…</code>). Aqui são informativos — a instalação
          prática acontece no GTM.
        </p>

        <div>
          <label className={label}>Verificação Search Console</label>
          <input value={m.gsc_verification || ""} onChange={(e) => setM({ ...m, gsc_verification: e.target.value.trim() })} placeholder="cole só o conteúdo do content=&quot;…&quot;" className={input} />
          <p className={hint}>
            <strong>Onde pegar:</strong> search.google.com/search-console → adicionar
            propriedade → método <em>Tag HTML</em> → copie <strong>só o valor</strong> de{" "}
            <code className={code}>content=&quot;…&quot;</code>. A loja insere a meta-tag no{" "}
            <code className={code}>&lt;head&gt;</code> e você clica em Verificar.
          </p>
        </div>

        <button onClick={salvar} disabled={saving} className={btn}>
          {saving ? "Salvando…" : "Salvar IDs"}
        </button>
      </section>

      {/* CAPI TOKEN */}
      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 text-sm text-eclat-grafite/75 flex flex-col gap-2">
        <h2 className="font-serif text-lg text-eclat-grafite">API de Conversões (CAPI) — token secreto</h2>
        <p className="leading-relaxed">
          O <strong>token da CAPI</strong> é um segredo e <strong>não fica aqui</strong> (esta
          config é pública). Configure uma vez na Vercel:
        </p>
        <ol className="list-decimal ml-5 flex flex-col gap-1 leading-relaxed">
          <li>Meta → Gerenciador de Eventos → sua Fonte de Dados → Configurações → API de Conversões → <em>Gerar token de acesso</em>.</li>
          <li>Vercel → projeto <strong>eclat-loja</strong> → Settings → Environment Variables → adicionar <code className={code}>META_CAPI_TOKEN</code> = (o token) → Production + Preview.</li>
          <li>Redeploy do eclat-loja.</li>
        </ol>
        <p className="leading-relaxed">
          Com <strong>Meta Pixel ID</strong> (acima) + <code className={code}>META_CAPI_TOKEN</code>,
          a loja envia o <em>Purchase</em> server-side com o mesmo <code className={code}>event_id</code>{" "}
          do Pixel → sem contar a conversão duas vezes.
        </p>
      </section>

      {/* FEED */}
      <section className="border border-eclat-pedra/40 rounded-lg bg-white/60 p-5 text-sm text-eclat-grafite/75 flex flex-col gap-2">
        <h2 className="font-serif text-lg text-eclat-grafite">Feed de produtos (Shopping / Catálogo)</h2>
        <p className="leading-relaxed">
          O feed já é gerado automaticamente a partir dos produtos do Medusa. URL:
        </p>
        <div className="flex items-center gap-2">
          <code className={code}>{STORE_URL}/feed.xml</code>
          <button
            onClick={() => navigator.clipboard?.writeText(`${STORE_URL}/feed.xml`)}
            className="text-[10px] uppercase tracking-widest text-eclat-dourado hover:underline"
          >
            copiar
          </button>
        </div>
        <ol className="list-decimal ml-5 flex flex-col gap-1 leading-relaxed">
          <li><strong>Google Merchant Center</strong> → Produtos → Feeds → adicionar feed → informar essa URL.</li>
          <li><strong>Meta (Gerenciador de Comércio)</strong> → Catálogo → Fontes de dados → Feed de dados → mesma URL.</li>
          <li>Vincular Merchant Center ↔ Google Ads (pra Shopping / Performance Max).</li>
        </ol>
      </section>

      {/* CHECKLIST */}
      <section className="border border-eclat-dourado/40 rounded-lg bg-eclat-areia/20 p-5 flex flex-col gap-3">
        <h2 className="font-serif text-xl text-eclat-grafite">Checklist de ativação</h2>
        <p className="text-xs text-eclat-grafite/55">Siga na ordem quando for rodar anúncios.</p>

        <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mt-2">Aqui no Cockpit</p>
        <ul className="flex flex-col gap-1.5">
          <Step>Colar <strong>GTM ID</strong> e salvar.</Step>
          <Step>Colar <strong>Meta Pixel ID</strong> e salvar.</Step>
          <Step>Colar <strong>verificação do Search Console</strong> e salvar.</Step>
        </ul>

        <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mt-2">Na Vercel (eclat-loja)</p>
        <ul className="flex flex-col gap-1.5">
          <Step>Adicionar env <code className={code}>META_CAPI_TOKEN</code> + Redeploy.</Step>
        </ul>

        <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mt-2">No GTM (gestor)</p>
        <ul className="flex flex-col gap-1.5">
          <Step>Criar tags <strong>GA4</strong>, <strong>Meta Pixel</strong> e <strong>Google Ads</strong>.</Step>
          <Step>No Pixel, usar <strong>Event ID = variável <code className={code}>event_id</code></strong> do dataLayer (dedup com a CAPI).</Step>
          <Step>Testar no modo <em>Preview</em> e publicar o contêiner.</Step>
        </ul>

        <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mt-2">Google / Meta</p>
        <ul className="flex flex-col gap-1.5">
          <Step>Merchant Center → cadastrar o feed <code className={code}>{STORE_URL}/feed.xml</code>.</Step>
          <Step>Catálogo Meta → mesma URL do feed.</Step>
          <Step>Search Console → verificar domínio + enviar <code className={code}>{STORE_URL}/sitemap.xml</code>.</Step>
        </ul>

        <p className="text-xs uppercase tracking-wider text-eclat-grafite/60 mt-2">Externo (você / gestor)</p>
        <ul className="flex flex-col gap-1.5">
          <Step>Business Manager (Meta) e conta Google Ads criados e verificados.</Step>
          <Step>Formas de pagamento aprovadas no Meta Ads e Google Ads.</Step>
          <Step>Acessos concedidos ao gestor (via BM / ID do cliente, não login e senha).</Step>
        </ul>
      </section>
    </div>
  )
}
