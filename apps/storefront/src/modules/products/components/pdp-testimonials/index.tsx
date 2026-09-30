import { getSiteContent } from "@lib/data/site-content"
import type { Testimonials } from "@modules/home/content"
import { depoimentosReais } from "@lib/util/depoimentos"

// Depoimentos na PDP (spec, Nota 05): a prova social existia só na home —
// migrada para a página de decisão. Sem nota agregada por decisão explícita
// (volume baixo: depoimento com nome comunica gente real; contador baixo, não).

export default async function PdpTestimonials() {
  // Só depoimento real (Cockpit → site_content "home.testimonials"); sem nenhum, a faixa some.
  const content = await getSiteContent<Testimonials>("home.testimonials")
  const items = depoimentosReais(content?.items)
  if (items.length === 0) return null

  return (
    <section className="py-12 small:py-16" data-testid="pdp-faixa-depoimentos">
      <div className="content-container max-w-4xl">
      <h2 className="font-serif text-2xl text-eclat-grafite mb-6 after:block after:w-10 after:h-0.5 after:bg-eclat-terracota after:mt-3">
        O que elas dizem
      </h2>
      <div className="grid grid-cols-1 small:grid-cols-3 gap-4">
        {items.slice(0, 3).map((t) => (
          <figure
            key={t.author}
            className="border border-eclat-pedra/60 rounded-xl p-4 bg-white/60"
          >
            {/* Sem estrelas: ninguém deu nota — é a fala da cliente, como ela escreveu. */}
            <blockquote className="font-serif italic text-[15px] text-eclat-grafite leading-snug">
              “{t.quote}”
            </blockquote>
            <figcaption className="text-[10px] uppercase tracking-widest text-eclat-grafite/50 mt-3">
              {t.author}
              {t.origem && <span className="normal-case tracking-normal"> · via {t.origem}</span>}
            </figcaption>
          </figure>
        ))}
      </div>
      </div>
    </section>
  )
}
