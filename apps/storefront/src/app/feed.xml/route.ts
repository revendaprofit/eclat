import { listProducts } from "@lib/data/products"
import { getBaseURL } from "@lib/util/env"

// Feed de produtos (Google Merchant Center RSS 2.0). Serve também ao catálogo Meta.
// URL: /feed.xml — cadastrar no Merchant Center e no Gerenciador de Comércio da Meta.
const CC = "br"

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  const base = getBaseURL()

  let products: any[] = []
  try {
    const { response } = await listProducts({
      countryCode: CC,
      queryParams: {
        limit: 200,
        fields:
          "handle,title,description,thumbnail,status,*images,*variants.calculated_price",
      } as any,
    })
    products = response.products
  } catch {
    /* feed vazio se a API falhar */
  }

  const items = products
    .filter((p) => p.status === "published")
    .map((p) => {
      const v = p.variants?.[0]
      const price = v?.calculated_price?.calculated_amount
      const img = p.thumbnail || p.images?.[0]?.url
      if (price == null || !img || !p.handle) return ""
      return `  <item>
    <g:id>${esc(v?.sku || p.id)}</g:id>
    <g:title>${esc(p.title)}</g:title>
    <g:description>${esc(p.description || p.title)}</g:description>
    <g:link>${base}/${CC}/products/${esc(p.handle)}</g:link>
    <g:image_link>${esc(img)}</g:image_link>
    <g:availability>in stock</g:availability>
    <g:price>${Number(price).toFixed(2)} BRL</g:price>
    <g:brand>use.ÉCLAT</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
  </item>`
    })
    .filter(Boolean)
    .join("\n")

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>use.ÉCLAT</title>
  <link>${base}</link>
  <description>Catálogo use.ÉCLAT — athleisure premium</description>
${items}
</channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
