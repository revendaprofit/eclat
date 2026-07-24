import { Metadata } from "next"
import { notFound } from "next/navigation"
import { getSiteContent } from "@lib/data/site-content"
import { getBaseURL } from "@lib/util/env"
import Markdown from "@modules/content/markdown"
import {
  INSTITUTIONAL_PAGES,
  getInstitutionalBySlug,
} from "@modules/content/institutional"
import { WebPageJsonLd, BreadcrumbJsonLd } from "@modules/seo/jsonld"

// Páginas institucionais (/br/sobre, /br/trocas-e-devolucoes, /br/guia-de-medidas,
// /br/privacidade). Conteúdo padrão em modules/content/institutional.ts;
// sobrescrevível pelo Cockpit via site_content (chave page.<id>).

type Props = {
  params: Promise<{ countryCode: string; institutionalSlug: string }>
}

type Override = {
  title?: string
  description?: string
  body_md?: string
}

export async function generateStaticParams() {
  return INSTITUTIONAL_PAGES.map((p) => ({
    countryCode: "br",
    institutionalSlug: p.slug,
  }))
}

async function loadPage(slug: string) {
  const page = getInstitutionalBySlug(slug)
  if (!page) return null
  const override = await getSiteContent<Override>(`page.${page.id}`)
  return {
    ...page,
    title: override?.title || page.title,
    description: override?.description || page.description,
    body: override?.body_md || page.defaultMd,
  }
}

export async function generateMetadata(props: Props): Promise<Metadata> {
  const params = await props.params
  const page = await loadPage(params.institutionalSlug)
  if (!page) notFound()
  const path = `/${params.countryCode}/${page.slug}`
  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: path },
    openGraph: {
      title: `${page.title} | use.ÉCLAT`,
      description: page.description,
      url: path,
    },
  }
}

export default async function InstitutionalPage(props: Props) {
  const params = await props.params
  const page = await loadPage(params.institutionalSlug)
  if (!page) notFound()

  const base = getBaseURL()
  const url = `${base}/${params.countryCode}/${page.slug}`

  return (
    <div className="content-container py-12 small:py-16">
      <WebPageJsonLd
        title={page.title}
        description={page.description}
        url={url}
        type={page.schemaType}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Início", url: `${base}/${params.countryCode}` },
          { name: page.title, url },
        ]}
      />
      <article className="max-w-2xl mx-auto">
        <h1 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-8">
          {page.title}
        </h1>
        <Markdown source={page.body} />
      </article>
    </div>
  )
}
