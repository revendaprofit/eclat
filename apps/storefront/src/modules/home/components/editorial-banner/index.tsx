import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import {
  HOME_DEFAULTS,
  EditorialBanner as EditorialBannerType,
} from "@modules/home/content"

export default function EditorialBanner({
  content,
}: {
  content?: EditorialBannerType | null
}) {
  const c = { ...HOME_DEFAULTS.banner, ...(content || {}) }
  const imageRight = (c.image_side || "right") === "right"

  return (
    <section className="content-container py-12 small:py-20">
      <div className="grid grid-cols-1 small:grid-cols-2 items-stretch border border-eclat-pedra/30 overflow-hidden">
        {/* imagem */}
        <div
          className={`relative min-h-[280px] small:min-h-[440px] bg-eclat-areia/40 ${
            imageRight ? "small:order-2" : "small:order-1"
          }`}
        >
          {c.image_url ? (
            <Image
              src={c.image_url}
              alt={c.title || "use.ÉCLAT"}
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-eclat-areia to-eclat-pedra/50" />
          )}
        </div>

        {/* texto */}
        <div
          className={`flex flex-col justify-center gap-4 p-8 small:p-14 bg-eclat-luz ${
            imageRight ? "small:order-1" : "small:order-2"
          }`}
        >
          {c.eyebrow && (
            <span className="uppercase tracking-widest text-xs text-eclat-terracota">
              {c.eyebrow}
            </span>
          )}
          {c.title && (
            <h2 className="font-serif text-4xl small:text-5xl text-eclat-grafite leading-tight">
              {c.title}
            </h2>
          )}
          {c.text && (
            <p className="text-base small:text-lg text-eclat-grafite/75 max-w-md">
              {c.text}
            </p>
          )}
          {c.cta_label && c.cta_href && (
            <LocalizedClientLink
              href={c.cta_href}
              className="self-start mt-2 bg-eclat-terracota text-eclat-luz uppercase tracking-widest text-xs px-7 py-4 hover:bg-eclat-terracota-escuro transition-colors"
            >
              {c.cta_label}
            </LocalizedClientLink>
          )}
        </div>
      </div>
    </section>
  )
}
