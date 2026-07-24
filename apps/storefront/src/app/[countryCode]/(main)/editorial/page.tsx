import { Metadata } from "next"
import Image from "next/image"
import { listEditorialPosts } from "@lib/data/editorial"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Editorial ÉCLAT: guias e artigos (camada de conteúdo p/ SEO/GEO).

type Props = {
  params: Promise<{ countryCode: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const path = `/${params.countryCode}/editorial`
  const description =
    "Editorial use.ÉCLAT: guias de athleisure, moda fitness e bem-estar da mulher inteira."
  return {
    title: "Editorial",
    description,
    alternates: { canonical: path },
    openGraph: {
      title: "Editorial | use.ÉCLAT",
      description,
      url: path,
    },
  }
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
        new Date(iso)
      )
    : ""

export default async function EditorialIndex(props: Props) {
  await props.params
  const posts = await listEditorialPosts()

  return (
    <div className="content-container py-12 small:py-16">
      <header className="max-w-2xl mx-auto text-center mb-12">
        <h1 className="font-serif text-3xl small:text-4xl text-eclat-grafite">
          Editorial ÉCLAT
        </h1>
        <p className="text-eclat-grafite/70 mt-3">
          Guias de athleisure, moda fitness e bem-estar — para a mulher inteira.
        </p>
      </header>

      {posts.length === 0 ? (
        <p className="text-center text-eclat-grafite/60">
          Em breve, novos conteúdos por aqui.
        </p>
      ) : (
        <ul className="grid grid-cols-1 small:grid-cols-2 medium:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {posts.map((post) => (
            <li key={post.id} className="group">
              <LocalizedClientLink href={`/editorial/${post.slug}`}>
                {post.cover_url && (
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-eclat-areia/40 mb-4">
                    <Image
                      src={post.cover_url}
                      alt={post.title}
                      fill
                      sizes="(max-width: 768px) 100vw, 33vw"
                      className="object-cover group-hover:scale-[1.02] transition-transform"
                    />
                  </div>
                )}
                <h2 className="font-serif text-xl text-eclat-grafite group-hover:text-eclat-terracota transition-colors">
                  {post.title}
                </h2>
                {post.excerpt && (
                  <p className="text-sm text-eclat-grafite/70 mt-2 line-clamp-3">
                    {post.excerpt}
                  </p>
                )}
                <p className="text-xs text-eclat-grafite/50 mt-2">
                  {fmtDate(post.published_at)}
                </p>
              </LocalizedClientLink>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
