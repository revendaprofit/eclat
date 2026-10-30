import Image from "next/image"
import { HOME_DEFAULTS, Testimonials as TestimonialsType } from "@modules/home/content"
import { depoimentosReais, somentePrints } from "@lib/util/depoimentos"
import CarrosselAuto from "./carrossel-auto"

// Provas sociais — editável no Cockpit (site_content home.testimonials).
// 2026-10-11 (sócia): o print real da mensagem "fica mais real e confiável" — cada card é o print do
// WhatsApp/Instagram (dados pessoais escondidos antes de subir, scripts na sessão de 11/10), numa moldura
// igual à das categorias (linha terracota + filete dourado). A frase vira o alt. Sem print, card de texto.
// Faixa que vai passando sozinha nas duas telas (sócia, 29/10): celular 1 card e meio por vez, computador 4
// por vez; um card a cada 4 s, para ao tocar (carrossel-auto.tsx). Antes o computador era um mosaico fixo.
export default function Testimonials({ content, max, compacto }: { content?: TestimonialsType | null; max?: number; compacto?: boolean }) {
  // Até 8 na home (sócia, 2026-10-11: "está muito grande"); a PDP passa 6.
  // Fotos de cliente com o look ficam só na faixa da peça (PDP); aqui, prints e falas.
  const items = somentePrints(depoimentosReais(content?.items)).slice(0, max || 8)
  if (items.length === 0) return null
  const heading = content?.heading ?? HOME_DEFAULTS.testimonials.heading
  const subheading = content?.subheading ?? HOME_DEFAULTS.testimonials.subheading

  return (
    <section className={compacto ? "content-container py-12 small:py-16" : "content-container py-16 small:py-24"} data-testid="depoimentos">
      <div className="text-center mb-8 small:mb-12 flex flex-col items-center gap-2">
        {heading && <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite">{heading}</h2>}
        {subheading && <p className="text-sm small:text-base text-eclat-grafite/65 max-w-md text-balance">{subheading}</p>}
      </div>
      <CarrosselAuto rotulo="Depoimentos de clientes" className="flex items-start gap-4 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4 small:mx-auto small:px-0 small:max-w-5xl">
        {items.map((t, i) => (
          <li key={i} className="snap-start shrink-0 w-[72%] xsmall:w-[48%] small:w-[calc(25%-12px)]">
            <figure className="flex flex-col gap-3">
              <div className="border border-eclat-terracota outline outline-1 outline-offset-[3px] outline-[#C9A24C] bg-eclat-luz p-[4px]">
                {t.image_url ? (
                  <Image
                    src={t.image_url}
                    alt={`${t.author}: ${t.quote}`}
                    width={t.image_width || 900}
                    height={t.image_height || 600}
                    sizes="(max-width: 1024px) 72vw, 240px"
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
              <figcaption className="uppercase tracking-widest text-[10px] text-eclat-grafite/60 px-1">
                {t.author}
                {t.origem && <span className="normal-case tracking-normal"> · via {t.origem}</span>}
              </figcaption>
            </figure>
          </li>
        ))}
      </CarrosselAuto>
    </section>
  )
}
