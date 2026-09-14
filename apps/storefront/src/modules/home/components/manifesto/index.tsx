import { HOME_DEFAULTS, Manifesto as ManifestoType } from "@modules/home/content"

// Divide o manifesto em frases para dar ritmo de leitura (uma frase por linha no layout).
// Sem lookbehind no regex: Safari antigo não suporta.
function frasesDe(text: string): string[] {
  const frases = text.match(/[^.!?]+[.!?]+["”»]?/g)
  const limpas = (frases ?? [text]).map((f) => f.trim()).filter(Boolean)
  return limpas.length ? limpas : [text]
}

// Manifesto da home (editável no Cockpit, site_content home.manifesto). Tipografia revista
// (2026-09-13): no mobile o texto grande centralizado quebrava em linhas desiguais e deixava
// palavra sozinha ("é."). Agora: frases em blocos, `text-balance` e tamanho menor no celular.
export default function Manifesto({ content }: { content?: ManifestoType | null }) {
  const text = content?.text || HOME_DEFAULTS.manifesto.text || ""
  const frases = frasesDe(text)
  return (
    <section className="bg-eclat-areia/40 py-16 small:py-28 mb-12 small:mb-16" data-testid="home-manifesto">
      <div className="content-container text-center">
        <span aria-hidden className="mx-auto mb-6 block h-0.5 w-10 bg-eclat-terracota small:mb-8" />
        <p className="font-serif text-eclat-grafite mx-auto max-w-[22ch] small:max-w-3xl text-[1.375rem] leading-[1.4] small:text-4xl small:leading-snug">
          {frases.map((f, i) => (
            <span
              key={i}
              className={
                "block text-balance" +
                (i > 0 ? " mt-3 small:mt-4 italic text-eclat-terracota" : "")
              }
            >
              {f}
            </span>
          ))}
        </p>
      </div>
    </section>
  )
}
