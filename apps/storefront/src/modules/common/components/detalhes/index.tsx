import Image from "next/image"
import { getSiteContent } from "@lib/data/site-content"

// "Detalhes que fazem a diferença" (referência beatco.com.br, aprovada pelo dono em 2026-09-30): fotos de perto
// das peças com uma frase cada. Mesmo bloco na home e na página do produto. Conteúdo em site_content
// "home.detalhes" (fotos no Storage `site/detalhes/`, scripts/detalhes-pecas.py); sem fotos, some.
export type DetalheItem = { image_url: string; title: string; text?: string }
export type Detalhes = { visible?: boolean; heading?: string; items?: DetalheItem[] }

export default async function DetalhesQueFazemDiferenca({ className = "" }: { className?: string }) {
  const c = await getSiteContent<Detalhes>("home.detalhes")
  const items = (c?.items || []).filter((i) => i?.image_url?.startsWith("https://") && i.title)
  if (c?.visible === false || items.length === 0) return null

  return (
    <section className={`py-12 small:py-20 ${className}`} data-testid="detalhes">
      <div className="content-container">
        <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite text-center mb-8">
          {c?.heading || "Detalhes que fazem a diferença"}
        </h2>
        {/* Carrossel só com CSS (scroll-snap): arrasta no celular, rola com o trackpad no computador. */}
        <ul className="flex gap-3 small:gap-4 overflow-x-auto snap-x snap-mandatory pb-4 -mx-4 px-4 small:mx-0 small:px-0 [scrollbar-width:thin]">
          {items.map((d) => (
            <li key={d.image_url} className="snap-start shrink-0 w-[72%] xsmall:w-[45%] small:w-[calc((100%-3rem)/4)]">
              <div className="relative aspect-[4/5] overflow-hidden bg-eclat-areia/40">
                <Image
                  src={d.image_url}
                  alt={d.title}
                  fill
                  sizes="(max-width: 640px) 72vw, 25vw"
                  className="object-cover"
                />
              </div>
              <p className="mt-3 text-sm uppercase tracking-widest text-eclat-grafite">{d.title}</p>
              {d.text && <p className="mt-1 text-sm text-eclat-grafite/70 leading-snug">{d.text}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
