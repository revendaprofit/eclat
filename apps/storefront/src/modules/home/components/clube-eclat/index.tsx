import { getPrevenda, linkClubeWhatsapp } from "@lib/data/prevenda"
import { Clube, HOME_DEFAULTS } from "@modules/home/content"

// Entrada do Clube Éclat na home (pedido do dono, 2026-09-30, referência beatco.com.br).
// Vai pelo WhatsApp da marca com a frase-gatilho — é o que cria o lead no Cockpit (lib/data/prevenda.ts).
export default async function ClubeEclat({ content }: { content?: Clube | null }) {
  const c = { ...HOME_DEFAULTS.clube, ...(content || {}) }
  const link = linkClubeWhatsapp(await getPrevenda())

  return (
    <section className="bg-eclat-areia/50">
      <div className="content-container py-14 small:py-20 flex flex-col items-center text-center gap-4">
        {c.eyebrow && (
          <span className="uppercase tracking-widest text-xs text-eclat-terracota">{c.eyebrow}</span>
        )}
        {c.title && (
          <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite">{c.title}</h2>
        )}
        {c.text && <p className="max-w-lg text-sm small:text-base text-eclat-grafite/75">{c.text}</p>}
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-2 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-7 py-4 hover:bg-eclat-terracota transition-colors"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
            <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.5a.6.6 0 0 0 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.7A11.8 11.8 0 1 0 12 .2Z" />
          </svg>
          {c.cta_label}
        </a>
      </div>
    </section>
  )
}
