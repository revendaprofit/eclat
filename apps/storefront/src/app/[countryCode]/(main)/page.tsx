import { Metadata } from "next"

import FeaturedProducts from "@modules/home/components/featured-products"
import Hero from "@modules/home/components/hero"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { getRegion } from "@lib/data/regions"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

export const metadata: Metadata = {
  title: "use.ÉCLAT — athleisure da mulher inteira",
  description:
    "Moda fitness premium e independente. Leggings, tops e conjuntos que sustentam, valorizam e resplandecem.",
}

export default async function Home(props: {
  params: Promise<{ countryCode: string }>
}) {
  const params = await props.params

  const { countryCode } = params

  const region = await getRegion(countryCode)

  const { collections } = await listCollections({
    fields: "id, handle, title",
  })

  const categories = await listCategories()

  if (!collections || !region) {
    return null
  }

  return (
    <>
      <Hero />

      {/* Manifesto da marca */}
      <section className="content-container py-20 text-center">
        <p className="font-serif text-2xl small:text-3xl leading-snug text-eclat-grafite max-w-3xl mx-auto">
          A Éclat veste a mulher inteira — corpo, força e delicadeza —
          com peças pensadas para durar e brilhar em cada movimento.
        </p>
      </section>

      {/* Faixa de categorias */}
      {categories && categories.length > 0 && (
        <section className="content-container pb-16">
          <h2 className="font-serif text-3xl text-eclat-grafite mb-8">
            Navegue por categoria
          </h2>
          <ul className="grid grid-cols-2 small:grid-cols-4 gap-4">
            {categories.slice(0, 8).map((c) => (
              <li key={c.id}>
                <LocalizedClientLink
                  href={`/categories/${c.handle}`}
                  className="block border border-eclat-pedra/40 bg-eclat-areia/30 px-5 py-8 text-center uppercase tracking-widest text-xs text-eclat-grafite hover:bg-eclat-dourado hover:text-eclat-grafite hover:border-eclat-dourado transition-colors"
                >
                  {c.name}
                </LocalizedClientLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Coleções em destaque */}
      <div className="py-12">
        <ul className="flex flex-col gap-x-6">
          <FeaturedProducts collections={collections} region={region} />
        </ul>
      </div>
    </>
  )
}
