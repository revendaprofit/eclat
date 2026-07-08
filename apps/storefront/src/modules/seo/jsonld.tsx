import { HttpTypes } from "@medusajs/types"
import { getBaseURL } from "@lib/util/env"

// Dados estruturados (Schema.org / JSON-LD) para SEO e GEO (citação por IA).
/* eslint-disable @typescript-eslint/no-explicit-any */

function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      // JSON-LD precisa ser injetado como texto
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  )
}

export function OrganizationJsonLd() {
  const base = getBaseURL()
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Organization",
        name: "use.ÉCLAT",
        alternateName: "ÉCLAT",
        url: base,
        logo: `${base}/brand/logo-terracota.png`,
        description:
          "use.ÉCLAT — moda fitness premium e independente. Athleisure da mulher inteira: leggings, tops e conjuntos que sustentam, valorizam e resplandecem.",
        slogan: "A luz da mulher inteira",
      }}
    />
  )
}

export function WebSiteJsonLd() {
  const base = getBaseURL()
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "use.ÉCLAT",
        url: base,
        inLanguage: "pt-BR",
        potentialAction: {
          "@type": "SearchAction",
          target: {
            "@type": "EntryPoint",
            urlTemplate: `${base}/br/busca?q={search_term_string}`,
          },
          "query-input": "required name=search_term_string",
        },
      }}
    />
  )
}

export function ProductJsonLd({
  product,
  url,
}: {
  product: HttpTypes.StoreProduct
  url: string
}) {
  const v: any = product.variants?.[0]
  const price = v?.calculated_price?.calculated_amount
  const img = product.thumbnail || (product.images?.[0] as any)?.url
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.title,
        ...(img ? { image: [img] } : {}),
        description: product.description || product.title,
        brand: { "@type": "Brand", name: "use.ÉCLAT" },
        ...(v?.sku ? { sku: v.sku } : {}),
        ...(price != null
          ? {
              offers: {
                "@type": "Offer",
                price: Number(price).toFixed(2),
                priceCurrency: "BRL",
                availability: "https://schema.org/InStock",
                url,
                itemCondition: "https://schema.org/NewCondition",
              },
            }
          : {}),
      }}
    />
  )
}

export function BreadcrumbJsonLd({
  items,
}: {
  items: { name: string; url: string }[]
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          item: it.url,
        })),
      }}
    />
  )
}

export function FaqJsonLd({
  items,
}: {
  items: { q: string; a: string }[]
}) {
  if (!items?.length) return null
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((it) => ({
          "@type": "Question",
          name: it.q,
          acceptedAnswer: { "@type": "Answer", text: it.a },
        })),
      }}
    />
  )
}
