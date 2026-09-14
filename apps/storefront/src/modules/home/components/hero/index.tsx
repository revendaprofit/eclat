import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { heroTelas, heroTextos, type HeroTela, type HeroTextos } from "@lib/util/hero-media"
import HeroVideo from "./hero-video"

// Conteúdo editável (cockpit → Supabase site_content key "hero"). Tudo com fallback.
export type HeroContent = {
  // Banner em imagem (modo principal) — proporção preservada, clicável
  banner_mobile_url?: string
  banner_desktop_url?: string
  banner_href?: string
  // Banner em VÍDEO (vence a imagem na tela em que existir): vídeo gerado da arte SEM texto +
  // capa = primeiro quadro; o texto abaixo é desenhado pelo site por cima (2026-09-14)
  video_mobile_url?: string
  video_poster_mobile_url?: string
  video_desktop_url?: string
  video_poster_desktop_url?: string
  video_eyebrow?: string
  video_titulo_1?: string
  video_titulo_2?: string
  video_texto?: string
  video_cta?: string
  // Fallback editorial (usado só quando NÃO há banner)
  eyebrow_mode?: "collection" | "custom"
  eyebrow_text?: string
  collection_handle?: string
  collection_label?: string
  title?: string
  subtitle?: string
  cta_label?: string
  cta_href?: string
  image_url?: string // legado: usado como banner se os banner_* não existirem
}

const DEFAULTS = {
  title: "A luz da mulher inteira",
  subtitle:
    "Athleisure premium para quem se move com presença. Tecidos que sustentam, caimento que valoriza, brilho que é seu.",
  cta_label: "Explorar a coleção",
  cta_href: "/store",
}

// Medidas tiradas da arte da coleção (scripts compor-banner-*.py): desktop 1920 px de largura,
// mobile 1080 px — convertidas em vw para escalar junto com o vídeo, com mínimos legíveis.
const SOMBRA = { textShadow: "0 2px 16px rgba(10, 8, 12, 0.55)" }

function HeroTelaView({ tela, variante, textos }: { tela: HeroTela; variante: "mobile" | "desktop"; textos: HeroTextos }) {
  if (tela.tipo === "nenhum") return null
  if (tela.tipo === "imagem") {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={tela.src} alt="use.ÉCLAT" className="block w-full h-auto" />
  }
  const desktop = variante === "desktop"
  const Titulo = desktop ? "h1" : "p"
  return (
    <div
      className={"relative w-full " + (desktop ? "aspect-[7/3]" : "aspect-[4/5]")}
      data-testid={`hero-video-${variante}`}
    >
      <HeroVideo video={tela.video} poster={tela.poster} media={desktop ? "(min-width: 1024px)" : "(max-width: 1023.98px)"} />
      <div
        className="absolute z-10 flex flex-col items-start text-white"
        style={desktop ? { left: "6.77%", top: "16%", maxWidth: "36%" } : { left: "6.67%", right: "6.67%", top: "3.7%" }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/brand/mark.png"
          alt=""
          aria-hidden
          className="w-auto brightness-0 invert"
          style={{ height: desktop ? "clamp(44px, 4.8vw, 92px)" : "7.8vw", marginBottom: desktop ? "clamp(10px, 1vw, 20px)" : "4.2vw" }}
        />
        <span
          className="uppercase font-sans font-medium"
          style={{ ...SOMBRA, color: "rgb(236, 214, 200)", fontSize: desktop ? "clamp(12px, 1.04vw, 20px)" : "clamp(11px, 2.87vw, 16px)", letterSpacing: desktop ? "0.26vw" : "0.55vw" }}
        >
          {textos.eyebrow}
        </span>
        <Titulo
          className="font-serif leading-[1.05]"
          style={{ ...SOMBRA, marginTop: desktop ? "clamp(14px, 1.8vw, 34px)" : "4vw" }}
        >
          <span className="block uppercase font-bold" style={{ fontSize: desktop ? "clamp(40px, 5.1vw, 98px)" : "6.85vw" }}>
            {textos.titulo1}
          </span>
          <span className="block italic" style={{ color: "rgb(255, 236, 222)", fontSize: desktop ? "clamp(42px, 5.42vw, 104px)" : "7.4vw" }}>
            {textos.titulo2}
          </span>
        </Titulo>
        <p
          className="font-sans text-balance"
          style={{ ...SOMBRA, color: "rgb(240, 237, 240)", fontSize: desktop ? "clamp(14px, 1.2vw, 23px)" : "clamp(13px, 3.06vw, 18px)", lineHeight: 1.45, marginTop: desktop ? "clamp(14px, 1.6vw, 30px)" : "3.4vw", maxWidth: desktop ? "31em" : undefined }}
        >
          {textos.texto}
        </p>
        <span
          className="inline-flex items-center rounded-full bg-white font-sans font-medium uppercase"
          style={{
            color: "rgb(38, 41, 50)",
            fontSize: desktop ? "clamp(11px, 0.94vw, 18px)" : "clamp(11px, 1.85vw, 14px)",
            letterSpacing: "0.14em",
            padding: desktop ? "clamp(10px, 0.9vw, 17px) clamp(20px, 1.8vw, 34px)" : "3vw 5.5vw",
            marginTop: desktop ? "clamp(16px, 1.6vw, 30px)" : "4vw",
          }}
        >
          {textos.cta}
        </span>
      </div>
    </div>
  )
}

const Hero = ({
  content,
  fallbackCollection,
}: {
  content?: HeroContent | null
  fallbackCollection?: { title?: string; handle?: string }
}) => {
  const c = content ?? {}

  // ---- Modo BANNER: por tela, VÍDEO (texto do site por cima) ou IMAGEM (texto já na arte) ----
  const telas = heroTelas(c)
  const bannerHref = c.banner_href || c.cta_href || "/store"

  if (telas.mobile.tipo !== "nenhum" || telas.desktop.tipo !== "nenhum") {
    const textos = heroTextos(c)
    return (
      <section className="w-full border-b border-eclat-pedra/40">
        <LocalizedClientLink href={bannerHref} aria-label={`${textos.eyebrow}: ${textos.cta}`} className="block">
          <div className="small:hidden">
            <HeroTelaView tela={telas.mobile} variante="mobile" textos={textos} />
          </div>
          <div className="hidden small:block">
            <HeroTelaView tela={telas.desktop} variante="desktop" textos={textos} />
          </div>
        </LocalizedClientLink>
      </section>
    )
  }

  // ---- Fallback EDITORIAL (sem banner): creme + marca-d'água + textos ----
  const isCustom = c.eyebrow_mode === "custom"
  const colLabel = c.collection_label || fallbackCollection?.title
  const colHandle = c.collection_handle || fallbackCollection?.handle
  const eyebrow = isCustom
    ? c.eyebrow_text || "Nova coleção"
    : colLabel
    ? `Coleção ${colLabel}`
    : "Nova coleção"
  const eyebrowHref = !isCustom && colHandle ? `/collections/${colHandle}` : null

  const title = c.title || DEFAULTS.title
  const subtitle = c.subtitle || DEFAULTS.subtitle
  const ctaLabel = c.cta_label || DEFAULTS.cta_label
  const ctaHref = c.cta_href || DEFAULTS.cta_href

  return (
    <section className="relative w-full min-h-[88svh] small:min-h-[82vh] border-b border-eclat-pedra/40 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-eclat-luz via-eclat-areia to-eclat-blush-claro" />
      <Image
        src="/brand/mark.png"
        alt=""
        aria-hidden
        width={494}
        height={660}
        priority
        className="pointer-events-none select-none absolute right-[-8%] top-[30%] -translate-y-1/4 w-[58%] max-w-[440px] opacity-[0.13]"
      />

      <div className="relative z-10 flex min-h-[88svh] small:min-h-[82vh] flex-col justify-end">
        <div className="content-container pb-12 small:pb-16 flex flex-col items-start gap-5 small:gap-6 max-w-2xl">
          {eyebrowHref ? (
            <LocalizedClientLink
              href={eyebrowHref}
              className="uppercase tracking-[0.3em] text-[11px] text-eclat-terracota hover:opacity-80 transition-opacity"
            >
              {eyebrow}
            </LocalizedClientLink>
          ) : (
            <span className="uppercase tracking-[0.3em] text-[11px] text-eclat-terracota">
              {eyebrow}
            </span>
          )}

          <h1 className="font-serif text-[2.75rem] leading-[1.04] small:text-7xl font-medium text-eclat-grafite">
            {title}
          </h1>

          <p className="text-base small:text-lg max-w-md text-eclat-grafite/70">
            {subtitle}
          </p>

          <LocalizedClientLink
            href={ctaHref}
            className="inline-flex items-center justify-center px-8 py-3.5 bg-eclat-terracota text-eclat-luz uppercase tracking-widest text-xs hover:bg-eclat-terracota-escuro transition-colors duration-200 w-full small:w-auto"
          >
            {ctaLabel}
          </LocalizedClientLink>
        </div>
      </div>
    </section>
  )
}

export default Hero
