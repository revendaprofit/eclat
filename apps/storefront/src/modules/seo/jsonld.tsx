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

// Disponibilidade real: em estoque se alguma variante tem quantidade > 0,
// não controla estoque ou aceita backorder.
function getAvailability(product: HttpTypes.StoreProduct) {
  const variants = (product.variants ?? []) as any[]
  if (!variants.length) {
    return "https://schema.org/InStock"
  }
  const inStock = variants.some(
    (v) =>
      v?.manage_inventory === false ||
      v?.allow_backorder === true ||
      (typeof v?.inventory_quantity === "number" && v.inventory_quantity > 0)
  )
  return inStock
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock"
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
                availability: getAvailability(product),
                url,
                itemCondition: "https://schema.org/NewCondition",
              },
            }
          : {}),
      }}
    />
  )
}

// Lista de produtos de uma página de listagem (loja/categoria/coleção).
export function ItemListJsonLd({
  name,
  items,
}: {
  name: string
  items: { name: string; url: string }[]
}) {
  if (!items?.length) return null
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "ItemList",
        name,
        numberOfItems: items.length,
        itemListElement: items.map((it, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: it.name,
          url: it.url,
        })),
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
