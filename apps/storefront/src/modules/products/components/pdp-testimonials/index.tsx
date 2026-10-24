import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { getSiteContent } from "@lib/data/site-content"
import type { Testimonials as TestimonialsType } from "@modules/home/content"
import Testimonials from "@modules/home/components/testimonials"
import { depoimentosDaPeca, depoimentosReais } from "@lib/util/depoimentos"

// Prova social na PDP. Desde 2026-10-23 (sócia): quando há depoimento ou foto de cliente marcados para ESTA peça
// (campo `produtos` do item em home.testimonials, pelo handle), a página mostra a faixa "Quem já veste" só com
// esse material (prints e fotos com o look, misturados). Sem material da peça, cai no bloco geral da home (6).
export default async function PdpTestimonials({ product }: { product: HttpTypes.StoreProduct }) {
  const content = await getSiteContent<TestimonialsType>("home.testimonials")
  const daPeca = depoimentosDaPeca(depoimentosReais(content?.items), product.handle)
  if (daPeca.length === 0) return <Testimonials content={content} max={6} compacto />

  return (
    <section className="bg-eclat-areia/50 py-12 small:py-16" data-testid="pdp-quem-ja-veste">
      <div className="content-container flex flex-col gap-8">
        <div className="text-center flex flex-col items-center gap-2">
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite">Quem já veste</h2>
          <p className="text-sm small:text-base text-eclat-grafite/65 max-w-md text-balance">
            {product.title}: mensagens e fotos reais de quem já comprou.
          </p>
        </div>
        <ul className="flex gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 small:mx-0 small:px-0 small:justify-center small:flex-wrap">
          {daPeca.map((t, i) => (
            <li key={i} className="snap-start shrink-0 w-[72%] xsmall:w-[48%] small:w-64">
              <figure className="flex flex-col gap-3">
                <div className="border border-eclat-terracota outline outline-1 outline-offset-[3px] outline-[#C9A24C] bg-eclat-luz p-[4px]">
                  {t.tipo === "foto" && t.image_url ? (
                    <div className="relative aspect-[2/3] w-full overflow-hidden">
                      <Image src={t.image_url} alt={`${t.author} com ${product.title}`} fill sizes="(max-width: 1024px) 72vw, 256px" quality={80} className="object-cover" />
                    </div>
                  ) : t.image_url ? (
                    <Image
                      src={t.image_url}
                      alt={`${t.author}: ${t.quote}`}
                      width={t.image_width || 900}
                      height={t.image_height || 600}
                      sizes="(max-width: 1024px) 72vw, 256px"
                      quality={80}
                      className="block h-auto w-full"
                    />
                  ) : (
                    <blockquote className="flex flex-col gap-3 bg-eclat-blush-claro/40 p-6">
                      <span className="font-serif text-4xl leading-none text-eclat-terracota">&ldquo;</span>
                      <p className="text-base text-eclat-grafite/85 leading-relaxed">{t.quote}</p>
                    </blockquote>
                  )}
                </div>
                <figcaption className="px-1 flex flex-col gap-1">
                  <span className="uppercase tracking-widest text-[10px] text-eclat-grafite/60">
                    {t.author}
                    {t.origem && <span className="normal-case tracking-normal"> · via {t.origem}</span>}
                  </span>
                  {t.tipo === "foto" && t.quote && <span className="text-sm text-eclat-grafite/75 italic leading-snug">&ldquo;{t.quote}&rdquo;</span>}
                </figcaption>
              </figure>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
