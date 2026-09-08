import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { BreadcrumbJsonLd } from "@modules/seo/jsonld"
import { getBaseURL } from "@lib/util/env"

export type Crumb = { name: string; href: string } // href sem o país, ex.: "/categories/leggings"

// Breadcrumb visível + JSON-LD a partir da mesma lista (uma fonte só).
export default function Breadcrumb({ items, countryCode }: { items: Crumb[]; countryCode: string }) {
  const base = getBaseURL()
  return (
    <>
      <BreadcrumbJsonLd items={items.map((c) => ({ name: c.name, url: `${base}/${countryCode}${c.href}` }))} />
      <nav aria-label="Você está aqui" className="text-xs text-eclat-grafite/60 flex flex-wrap items-center gap-x-2 mb-4" data-testid="breadcrumb">
        {items.map((c, i) => {
          const last = i === items.length - 1
          return (
            <span key={c.href} className="flex items-center gap-x-2">
              {last ? <span aria-current="page" className="text-eclat-grafite">{c.name}</span> : <LocalizedClientLink href={c.href} className="hover:text-eclat-grafite underline-offset-2 hover:underline">{c.name}</LocalizedClientLink>}
              {!last && <span aria-hidden>›</span>}
            </span>
          )
        })}
      </nav>
    </>
  )
}
