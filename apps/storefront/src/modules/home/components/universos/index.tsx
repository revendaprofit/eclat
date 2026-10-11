import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { HOME_DEFAULTS, type Universos as UniversosType } from "@modules/home/content"

// "Universos" da marca em painéis de foto com nome e botão (referência versianiswim.com.br, escolha da sócia
// em 2026-10-11): Fitness · Masculino · Acessórios · Athleisure (em breve). Painel sem `href` = "em breve"
// (sem botão, foto esmaecida). Fotos 3:4 em site/banners/universos/; textos e links no site_content
// "home.universos" (padrões em content.ts).
export default function Universos({ content }: { content?: UniversosType | null }) {
  const c = { ...HOME_DEFAULTS.universos, ...(content || {}) }
  const itens = (c.items || []).filter((i) => i?.image_url && i?.title)
  if (itens.length < 2) return null

  return (
    <section className="content-container py-10 small:py-16" data-testid="universos">
      {c.heading && <h2 className="sr-only">{c.heading}</h2>}
      <ul className="grid grid-cols-2 small:grid-cols-4 gap-2 small:gap-3">
        {itens.map((i, idx) => {
          const emBreve = !i.href
          const miolo = (
            <>
              <Image
                src={i.image_url as string}
                alt={i.title as string}
                fill
                sizes="(max-width: 1024px) 50vw, 25vw"
                quality={80}
                priority={idx < 2}
                className={`object-cover transition-transform duration-700 ${emBreve ? "grayscale-[35%] opacity-80" : "group-hover:scale-105"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-eclat-grafite/70 via-eclat-grafite/10 to-transparent" />
              <div className="absolute inset-0 flex flex-col items-center justify-end gap-3 p-4 pb-6 small:pb-8 text-center text-eclat-luz">
                <span className="font-serif text-2xl small:text-3xl tracking-wide [text-shadow:0_1px_10px_rgba(0,0,0,.5)]">{i.title}</span>
                {emBreve ? (
                  <span className="border border-eclat-luz/70 px-4 py-2 text-[10px] small:text-[11px] uppercase tracking-[0.2em]">{i.cta_label || "Em breve"}</span>
                ) : (
                  <span className="bg-eclat-luz px-4 py-2.5 small:px-5 small:py-3 text-[10px] small:text-[11px] font-semibold uppercase tracking-[0.18em] text-eclat-grafite group-hover:bg-eclat-terracota group-hover:text-eclat-luz transition-colors">
                    {i.cta_label || "Comprar agora"}
                  </span>
                )}
              </div>
            </>
          )
          return (
            <li key={i.title} className="group relative aspect-[3/4] overflow-hidden bg-eclat-grafite">
              {emBreve ? (
                <div aria-label={`${i.title}: em breve`}>{miolo}</div>
              ) : (
                <LocalizedClientLink href={i.href as string} className="absolute inset-0 block">
                  {miolo}
                </LocalizedClientLink>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
