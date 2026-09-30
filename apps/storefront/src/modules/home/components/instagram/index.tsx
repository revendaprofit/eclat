import Image from "next/image"
import { HOME_DEFAULTS, Instagram as InstagramType } from "@modules/home/content"
import { fotosInstagram, limparHandle, linkPerfilInstagram } from "@lib/util/instagram"

// Grade "Acompanhe @eclat.use" (referência beatco.com.br, aprovada pelo dono em 2026-09-30).
// As fotos ficam no Storage do site (site_content "home.instagram"); sem fotos, a seção não aparece.
export default function Instagram({ content }: { content?: InstagramType | null }) {
  const c = { ...HOME_DEFAULTS.instagram, ...(content || {}) }
  const handle = limparHandle(c.handle)
  const perfil = linkPerfilInstagram(handle)
  const fotos = fotosInstagram(c)
  if (!perfil || fotos.length === 0) return null

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
