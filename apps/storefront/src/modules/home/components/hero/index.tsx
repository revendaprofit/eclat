import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Conteúdo editável (cockpit → Supabase site_content key "hero"). Tudo com fallback.
export type HeroContent = {
  // Banner em imagem (modo principal) — proporção preservada, clicável
  banner_mobile_url?: string
  banner_desktop_url?: string
  banner_href?: string
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

const Hero = ({
  content,
  fallbackCollection,
}: {
  content?: HeroContent | null
  fallbackCollection?: { title?: string; handle?: string }
}) => {
  const c = content ?? {}

  // ---- Modo BANNER (imagem) ----
  const mobileUrl = c.banner_mobile_url || c.image_url || null
  const desktopUrl = c.banner_desktop_url || c.banner_mobile_url || c.image_url || null
  const hasBanner = Boolean(mobileUrl || desktopUrl)
  const bannerHref = c.banner_href || c.cta_href || "/store"

  if (hasBanner) {
    const mUrl = mobileUrl || desktopUrl!
    const dUrl = desktopUrl || mobileUrl!
    return (
      <section className="w-full border-b border-eclat-pedra/40">
        <LocalizedClientLink href={bannerHref} aria-label="Ver coleção" className="block">
          {/* mobile (vertical) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={mUrl}
            alt="use.ÉCLAT"
            className="block w-full h-auto small:hidden"
          />
          {/* desktop (horizontal) */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={dUrl}
            alt="use.ÉCLAT"
            className="hidden small:block w-full h-auto"
          />
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
