import { HOME_DEFAULTS, Faq as FaqType } from "@modules/home/content"
import { FaqJsonLd } from "@modules/seo/jsonld"

// FAQ answer-first + FAQPage schema (GEO: formato que IA cita).
export default function Faq({ content }: { content?: FaqType | null }) {
  const heading = content?.heading ?? HOME_DEFAULTS.faq.heading
  const items =
    content?.items && content.items.length > 0
      ? content.items
      : HOME_DEFAULTS.faq.items!

  return (
    <section className="content-container py-16 small:py-24">
      <FaqJsonLd items={items} />
      {heading && (
        <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-8 text-center">
          {heading}
        </h2>
      )}
      <div className="max-w-3xl mx-auto divide-y divide-eclat-pedra/40 border-y border-eclat-pedra/40">
        {items.map((it, i) => (
          <details key={i} className="group py-4">
            <summary className="flex items-center justify-between cursor-pointer list-none text-base small:text-lg font-medium text-eclat-grafite">
              {it.q}
              <span className="ml-4 text-eclat-terracota transition-transform group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-3 text-sm small:text-base text-eclat-grafite/75 leading-relaxed">
              {it.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}
