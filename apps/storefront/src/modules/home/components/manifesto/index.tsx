import { HOME_DEFAULTS, Manifesto as ManifestoType } from "@modules/home/content"

export default function Manifesto({ content }: { content?: ManifestoType | null }) {
  const text = content?.text || HOME_DEFAULTS.manifesto.text
  return (
    <section className="content-container py-20 small:py-28 text-center">
      <p className="font-serif text-2xl small:text-4xl leading-snug small:leading-snug text-eclat-grafite max-w-3xl mx-auto">
        {text}
      </p>
    </section>
  )
}
