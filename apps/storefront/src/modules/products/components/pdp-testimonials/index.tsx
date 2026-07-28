import { getSiteContent } from "@lib/data/site-content"
import { HOME_DEFAULTS, Testimonials } from "@modules/home/content"

// Depoimentos na PDP (spec, Nota 05): a prova social existia só na home —
// migrada para a página de decisão. Sem nota agregada por decisão explícita
// (volume baixo: depoimento com nome comunica gente real; contador baixo, não).

export default async function PdpTestimonials() {
  const content =
    (await getSiteContent<Testimonials>("home.testimonials")) ??
    HOME_DEFAULTS.testimonials
  const items = content?.items ?? []
  if (items.length === 0) return null

  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-eclat-grafite mb-4">
        O que elas dizem
      </h2>
      <div className="grid grid-cols-1 small:grid-cols-3 gap-4">
        {items.slice(0, 3).map((t) => (
          <figure
            key={t.author}
            className="border border-ui-border-base rounded-xl p-4 bg-white/60"
          >
            <div className="text-eclat-dourado text-sm tracking-[2px]">★★★★★</div>
            <blockquote className="font-serif italic text-[15px] text-eclat-grafite mt-2 leading-snug">
              “{t.quote}”
            </blockquote>
            <figcaption className="text-[10px] uppercase tracking-widest text-eclat-grafite/50 mt-3">
              {t.author}
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}
