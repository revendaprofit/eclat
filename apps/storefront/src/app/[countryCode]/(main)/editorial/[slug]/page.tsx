import { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { getEditorialPost } from "@lib/data/editorial"
import { getBaseURL } from "@lib/util/env"
import Markdown from "@modules/content/markdown"
import { ArticleJsonLd, BreadcrumbJsonLd } from "@modules/seo/jsonld"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

// Artigo do Editorial ÉCLAT (/br/editorial/<slug>) com schema Article.

type Props = {
  params: Promise<{ countryCode: string; slug: string }>
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const post = await getEditorialPost(params.slug)
  if (!post) notFound()

  const path = `/${params.countryCode}/editorial/${post.slug}`
  const description = post.excerpt || post.title
  return {
    title: post.title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${post.title} | use.ÉCLAT`,
      description,
      url: path,
      type: "article",
      images: post.cover_url ? [post.cover_url] : undefined,
    },
  }
}

const fmtDate = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "long" }).format(
        new Date(iso)
      )
    : ""

export default async function EditorialArticle(props: Props) {
  const params = await props.params
  const post = await getEditorialPost(params.slug)
  if (!post) notFound()

  const base = getBaseURL()
  const url = `${base}/${params.countryCode}/editorial/${post.slug}`

  return (
    <div className="content-container py-12 small:py-16">
      <ArticleJsonLd
        title={post.title}
        description={post.excerpt}
        url={url}
        image={post.cover_url}
        datePublished={post.published_at}
        dateModified={post.updated_at}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: `${base}/${params.countryCode}` },
          { name: "Editorial", url: `${base}/${params.countryCode}/editorial` },
          { name: post.title, url },
        ]}
      />
      <article className="max-w-2xl mx-auto">
        <p className="text-xs uppercase tracking-widest text-eclat-terracota mb-3">
          <LocalizedClientLink href="/editorial" className="hover:underline">
            Editorial ÉCLAT
          </LocalizedClientLink>
        </p>
        <h1 className="font-serif text-3xl small:text-4xl text-eclat-grafite">
          {post.title}
        </h1>
        <p className="text-sm text-eclat-grafite/50 mt-3 mb-8">
          {fmtDate(post.published_at)}
        </p>
        {post.cover_url && (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-eclat-areia/40 mb-8">
            <Image
              src={post.cover_url}
              alt={post.title}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 672px"
              className="object-cover"
            />
          </div>
        )}
        <Markdown source={post.body_md} />
      </article>
    </div>
  )
}
