import { HOME_DEFAULTS, Testimonials as TestimonialsType } from "@modules/home/content"

// Provas sociais (depoimentos) — editável no Cockpit (site_content home.testimonials).
export default function Testimonials({
  content,
}: {
  content?: TestimonialsType | null
}) {
  const heading = content?.heading ?? HOME_DEFAULTS.testimonials.heading
  const items =
    content?.items && content.items.length > 0
      ? content.items
      : HOME_DEFAULTS.testimonials.items!

  return (
    <section className="content-container py-16 small:py-24">
      {heading && (
        <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-10 text-center">
          {heading}
        </h2>
      )}
      <ul className="grid grid-cols-1 small:grid-cols-3 gap-6 small:gap-8">
        {items.map((t, i) => (
          <li
            key={i}
            className="flex flex-col gap-4 border border-eclat-pedra/30 bg-eclat-blush-claro/40 p-6 small:p-8"
          >
            <span className="font-serif text-4xl leading-none text-eclat-terracota">
              &ldquo;
            </span>
            <p className="text-base text-eclat-grafite/85 leading-relaxed flex-1">
              {t.quote}
            </p>
            {t.author && (
              <p className="uppercase tracking-widest text-xs text-eclat-grafite/60">
                {t.author}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
