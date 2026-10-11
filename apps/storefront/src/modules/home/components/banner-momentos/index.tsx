import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HOME_DEFAULTS, type BannerMomentos as BannerMomentosType } from "@modules/home/content"

// Banner de largura total com as fotos da praia (pedido da sócia, 2026-10-10, referência: o banner de
// grupo da bechose.com.br com um só botão). Foto de computador = tríptico 12:5 (praia, costão, casal);
// celular = uma foto 4:5. O texto é do site (editável no Cockpit, site_content "home.momentos"), por
// cima de um degradê escuro para ler em qualquer foto. Imagens em `site/banners/momentos/`.
export default function BannerMomentos({ content }: { content?: BannerMomentosType | null }) {
  const c = { ...HOME_DEFAULTS.momentos, ...(content || {}) }
  if (!c.image_url) return null
  const mobile = c.image_url_mobile || c.image_url

  return (
    <section className="relative w-full overflow-hidden bg-eclat-grafite text-eclat-luz" data-testid="banner-momentos">
      <div className="relative aspect-[4/5] small:aspect-[12/5] w-full">
        <Image src={mobile} alt={c.title || "use.ÉCLAT"} fill priority={false} sizes="100vw" quality={82} className="object-cover small:hidden" />
        <Image src={c.image_url} alt={c.title || "use.ÉCLAT"} fill priority={false} sizes="100vw" quality={82} className="hidden small:block object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-eclat-grafite/85 via-eclat-grafite/30 to-transparent" />
        <div className="absolute inset-0 flex items-end">
          <div className="content-container w-full pb-10 small:pb-12">
            <div className="max-w-xl flex flex-col gap-3 small:gap-4">
              {c.eyebrow && <span className="uppercase tracking-[0.25em] text-xs text-eclat-terracota-claro">{c.eyebrow}</span>}
              {c.title && <h2 className="font-serif text-4xl small:text-6xl leading-[1.02] text-balance">{c.title}</h2>}
              {c.text && <p className="text-sm small:text-lg text-eclat-luz/85 max-w-md text-balance">{c.text}</p>}
              {c.cta_label && c.cta_href && (
                <LocalizedClientLink
                  href={c.cta_href}
                  className="mt-2 inline-flex w-fit bg-eclat-luz text-eclat-grafite uppercase tracking-widest text-xs px-7 py-4 hover:bg-eclat-terracota hover:text-eclat-luz transition-colors"
                >
                  {c.cta_label}
                </LocalizedClientLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
