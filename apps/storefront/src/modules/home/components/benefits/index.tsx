import { HOME_DEFAULTS, Benefits as BenefitsType } from "@modules/home/content"

export default function Benefits({
  content,
}: {
  content?: BenefitsType | null
}) {
  const heading = content?.heading ?? HOME_DEFAULTS.benefits.heading
  const items =
    content?.items && content.items.length > 0
      ? content.items
      : HOME_DEFAULTS.benefits.items!

  return (
    <section className="border-y border-eclat-pedra/30 bg-eclat-areia/20">
      <div className="content-container py-12 small:py-16">
        {heading && (
          <h2 className="font-serif text-3xl text-eclat-grafite mb-8 text-center">
            {heading}
          </h2>
        )}
        <ul className="grid grid-cols-2 small:grid-cols-4 gap-8 small:gap-6">
          {items.map((item, i) => (
            <li key={i} className="text-center small:text-left">
              <h3 className="uppercase tracking-widest text-xs text-eclat-terracota mb-2">
                {item.title}
              </h3>
              {item.text && (
                <p className="text-sm text-eclat-grafite/75 leading-relaxed">
                  {item.text}
                </p>
              )}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
