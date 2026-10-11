import Image from "next/image"
import { HOME_DEFAULTS, type Fundadora as FundadoraType } from "@modules/home/content"

// "Conheça a fundadora" (referência versianiswim.com.br, pedido da sócia em 2026-10-11): foto 3:4 à
// esquerda (Camila na praia, com o look) e texto à direita. Texto editável no Cockpit (site_content
// "home.fundadora"); parágrafos separados por linha em branco.
export default function Fundadora({ content }: { content?: FundadoraType | null }) {
  const c = { ...HOME_DEFAULTS.fundadora, ...(content || {}) }
  if (!c.image_url || !c.text) return null
  const paragrafos = c.text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)

  return (
    <section className="content-container py-12 small:py-20" data-testid="fundadora">
      <div className="grid grid-cols-1 small:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] gap-8 small:gap-16 items-center">
        <div className="relative aspect-[3/4] w-full max-w-md mx-auto small:max-w-none border border-eclat-terracota outline outline-1 outline-offset-[3px] outline-[#C9A24C] bg-eclat-luz p-[4px]">
          <div className="relative h-full w-full overflow-hidden">
            <Image src={c.image_url} alt={c.name || "Fundadora da use.ÉCLAT"} fill sizes="(max-width: 1024px) 90vw, 40vw" quality={82} className="object-cover" />
          </div>
        </div>
        <div className="flex flex-col gap-4 small:gap-5">
          {c.eyebrow && <span className="uppercase tracking-[0.25em] text-xs text-eclat-terracota">{c.eyebrow}</span>}
          {c.name && <h2 className="font-serif text-4xl small:text-5xl text-eclat-grafite leading-[1.05]">{c.name}</h2>}
          <div className="flex flex-col gap-4 text-base small:text-lg leading-relaxed text-eclat-grafite/80 max-w-prose">
            {paragrafos.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {c.signature && <p className="font-serif italic text-xl text-eclat-terracota mt-2">{c.signature}</p>}
        </div>
      </div>
    </section>
  )
}
