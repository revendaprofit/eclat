import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HOME_DEFAULTS, FeaturedLines as FeaturedLinesType } from "@modules/home/content"

export default function FeaturedLines({
  content,
}: {
  content?: FeaturedLinesType | null
}) {
  const heading = content?.heading ?? HOME_DEFAULTS.lines.heading
  const items =
    content?.items && content.items.length > 0
      ? content.items
      : HOME_DEFAULTS.lines.items!

  return (
    <section className="content-container pb-16 small:pb-24">
      {heading && (
        <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-8 text-center">
          {heading}
        </h2>
      )}
      {/* Celular em 2×2 (era 1 coluna de tela cheia, ~1.800 px) — 2026-09-30, referência beatco.com.br */}
      <div className="grid grid-cols-2 gap-3 small:gap-6">
        {items.map((item, i) => (
          <LocalizedClientLink
            key={i}
            href={item.href}
            className="group relative block overflow-hidden aspect-[3/4] rounded-rounded small:rounded-none bg-eclat-areia/40"
          >
            {item.image_url ? (
              <Image
                src={item.image_url}
                alt={item.label}
                fill
                sizes="50vw"
                className="object-cover object-top transition-transform duration-700 group-hover:scale-105"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-eclat-areia to-eclat-pedra/50" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-3 small:p-8 text-white">
              <h3 className="font-serif text-xl small:text-4xl tracking-wide">
                {item.label}
              </h3>
              {item.caption && (
                <p className="hidden small:block mt-1 text-base text-white/85 max-w-xs">
                  {item.caption}
                </p>
              )}
              <span className="mt-1 small:mt-3 inline-block uppercase tracking-widest text-[10px] small:text-xs border-b border-eclat-terracota pb-0.5 group-hover:text-eclat-terracota transition-colors">
                Explorar →
              </span>
            </div>
          </LocalizedClientLink>
        ))}
      </div>
    </section>
  )
}
