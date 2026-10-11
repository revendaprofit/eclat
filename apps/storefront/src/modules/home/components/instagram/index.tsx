import Image from "next/image"
import { HOME_DEFAULTS, Instagram as InstagramType } from "@modules/home/content"
import { fotosInstagram, limparHandle, linkPerfilInstagram } from "@lib/util/instagram"
import Reels from "./reels"

// Grade "Acompanhe @eclat.use" (referência beatco.com.br, aprovada pelo dono em 2026-09-30).
// As fotos ficam no Storage do site (site_content "home.instagram"); sem fotos, a seção não aparece.
export default function Instagram({ content }: { content?: InstagramType | null }) {
  const c = { ...HOME_DEFAULTS.instagram, ...(content || {}) }
  const handle = limparHandle(c.handle)
  const perfil = linkPerfilInstagram(handle)
  const fotos = fotosInstagram(c)
  const reels = (c.reels || []).filter((r) => typeof r?.video_url === "string" && r.video_url.startsWith("https://")).slice(0, 4)
  if (!perfil || (fotos.length === 0 && reels.length === 0)) return null

  // Bloco "em movimento" (2026-10-10, referência bechose.com.br): @ pequeno, título grande, convite ao
  // perfil à direita e 4 reels em loop. Sem reels cadastrados, fica a grade de fotos de antes.
  if (reels.length) {
    return (
      <section className="content-container py-12 small:py-20" data-testid="instagram-movimento">
        <div className="flex flex-col small:flex-row small:items-end small:justify-between gap-4 mb-6 small:mb-8">
          <div className="flex flex-col gap-1">
            <a href={perfil} target="_blank" rel="noopener noreferrer" className="text-[11px] uppercase tracking-[0.25em] text-eclat-terracota hover:underline w-fit">
              @{handle}
            </a>
            <h2 className="font-serif text-4xl small:text-5xl text-eclat-grafite leading-[1.02] text-balance">{c.title || c.heading}</h2>
            {c.text && <p className="text-sm small:text-base text-eclat-grafite/70 max-w-lg text-balance mt-1">{c.text}</p>}
          </div>
          <a
            href={perfil}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-fit items-center gap-2 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-6 py-3.5 hover:bg-eclat-terracota transition-colors"
          >
            Seguir no Instagram
            <span aria-hidden="true">&rarr;</span>
          </a>
        </div>
        <Reels reels={reels} handle={handle} />
      </section>
    )
  }

  return (
    <section className="content-container py-12 small:py-20">
      <div className="flex flex-col items-center text-center gap-2 mb-8">
        {c.heading && (
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite">{c.heading}</h2>
        )}
        <a
          href={perfil}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm uppercase tracking-widest text-eclat-terracota hover:underline"
        >
          @{handle}
        </a>
      </div>
      <ul className="grid grid-cols-3 small:grid-cols-6 gap-1 small:gap-2">
        {fotos.map((f, i) => (
          <li key={f.image_url}>
            <a
              href={f.href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ver no Instagram @${handle} (${i + 1})`}
              className="group relative block aspect-square overflow-hidden bg-eclat-areia/40"
            >
              <Image
                src={f.image_url}
                alt=""
                fill
                sizes="(max-width: 640px) 33vw, 16vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
            </a>
          </li>
        ))}
      </ul>
      <div className="flex justify-center mt-8">
        <a
          href={perfil}
          target="_blank"
          rel="noopener noreferrer"
          className="border border-eclat-grafite text-eclat-grafite uppercase tracking-widest text-xs px-7 py-3 hover:bg-eclat-grafite hover:text-eclat-luz transition-colors"
        >
          Seguir no Instagram
        </a>
      </div>
    </section>
  )
}
