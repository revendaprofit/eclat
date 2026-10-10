import { getPrevenda, linkClubeWhatsapp } from "@lib/data/prevenda"
import { Clube, HOME_DEFAULTS } from "@modules/home/content"

// Clube Éclat na home (bloco escuro, referência bechose.com.br, 2026-10-10). Mecânica decidida pela
// sócia em 10/10/2026: a cada 3 compras, um mega presente especial. Os três passos são desenhados
// aqui; textos editáveis no Cockpit (site_content home.clube). A entrada é pelo WhatsApp da marca
// com a frase-gatilho — é o que cria o lead no Cockpit (lib/data/prevenda.ts).
const PASSOS = [
  { n: "1", titulo: "Primeira compra", texto: "Você entra no Clube e já recebe as condições só do grupo." },
  { n: "2", titulo: "Segunda compra", texto: "Vê os lançamentos antes de todo mundo e opina nas próximas coleções." },
  { n: "3", titulo: "Terceira compra", texto: "Um mega presente especial chega junto com o seu pedido." },
]

export default async function ClubeEclat({ content }: { content?: Clube | null }) {
  const c = { ...HOME_DEFAULTS.clube, ...(content || {}) }
  const link = linkClubeWhatsapp(await getPrevenda())

  return (
    <section className="bg-eclat-grafite text-eclat-luz" data-testid="clube-home">
      <div className="content-container py-14 small:py-20 grid grid-cols-1 small:grid-cols-[1.1fr_1fr] gap-10 small:gap-16 items-center">
        <div className="flex flex-col gap-4">
          {c.eyebrow && <span className="uppercase tracking-[0.25em] text-xs text-eclat-terracota-claro">{c.eyebrow}</span>}
          {c.title && <h2 className="font-serif text-4xl small:text-5xl leading-[1.05] text-balance">{c.title}</h2>}
          {c.text && <p className="max-w-md text-sm small:text-base text-eclat-luz/75">{c.text}</p>}
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex w-fit items-center gap-2 bg-eclat-terracota text-eclat-luz uppercase tracking-widest text-xs px-7 py-4 hover:bg-eclat-terracota-claro transition-colors"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1s-.5-.1-.7.1-.8 1-.9 1.2-.3.2-.6.1a8.1 8.1 0 0 1-2.4-1.5 9 9 0 0 1-1.7-2.1c-.2-.3 0-.5.1-.6l.4-.5.3-.5a.6.6 0 0 0 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6a1.1 1.1 0 0 0-.8.4 3.4 3.4 0 0 0-1 2.5 5.9 5.9 0 0 0 1.2 3.1 13.4 13.4 0 0 0 5.2 4.6c1.9.8 2.7.9 3.6.7a3.1 3.1 0 0 0 2-1.4 2.5 2.5 0 0 0 .2-1.4c-.1-.1-.3-.2-.6-.3ZM12 21.8a9.8 9.8 0 0 1-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8Zm0-21.6A11.8 11.8 0 0 0 1.8 17.9L.1 24l6.3-1.7A11.8 11.8 0 1 0 12 .2Z" />
            </svg>
            {c.cta_label}
          </a>
        </div>
        <ol className="flex flex-col gap-3">
          {PASSOS.map((p, i) => (
            <li key={p.n} className={`flex items-start gap-4 border p-4 small:p-5 ${i === 2 ? "border-eclat-terracota bg-eclat-terracota/10" : "border-eclat-luz/15"}`}>
              <span className={`font-serif text-3xl leading-none w-8 shrink-0 ${i === 2 ? "text-eclat-terracota-claro" : "text-eclat-luz/60"}`}>{p.n}</span>
              <span>
                <span className="block text-xs uppercase tracking-[0.18em] text-eclat-luz">{p.titulo}</span>
                <span className="block mt-1 text-sm text-eclat-luz/70 leading-snug">{p.texto}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
