import { getBaseURL } from "@lib/util/env"
import {
  FEED_CC as CC,
  listAllProductsForFeed,
  variantInStock,
  optionValue,
  productType,
  SIZE_RE,
  COLOR_RE,
} from "@lib/util/feed-data"

// Feed de produtos (Google Merchant Center RSS 2.0), nível de item = VARIANTE
// (item_group_id agrupa por produto), com tamanho/cor e estoque reais.
// O mesmo arquivo serve ao Microsoft Merchant Center (Bing/Copilot) e ao
// catálogo da Meta. URL: /feed.xml

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  const base = getBaseURL()
  const products = await listAllProductsForFeed()

  const items: string[] = []

  for (const p of products) {
    const img = p.thumbnail || p.images?.[0]?.url
    if (!img || !p.handle) continue

    const link = `${base}/${CC}/products/${esc(p.handle)}`
    const extraImages = (p.images ?? [])
      .map((i: any) => i?.url)
      .filter((u: string) => u && u !== img)
      .slice(0, 10)
    const type = productType(p)
    const variants = (p.variants ?? []).filter(
      (v: any) => v?.calculated_price?.calculated_amount != null
    )
    const hasGroup = variants.length > 1

    for (const v of variants) {
      const price = v.calculated_price.calculated_amount
      const size = optionValue(v, SIZE_RE)
      const color = optionValue(v, COLOR_RE)
      items.push(`  <item>
    <g:id>${esc(v.sku || v.id)}</g:id>
${hasGroup ? `    <g:item_group_id>${esc(p.handle)}</g:item_group_id>\n` : ""}    <g:title>${esc(p.title)}${size ? esc(` - ${size}`) : ""}${color ? esc(` ${color}`) : ""}</g:title>
    <g:description>${esc(p.description || p.subtitle || p.title)}</g:description>
    <g:link>${link}${v.id ? `?v_id=${esc(v.id)}` : ""}</g:link>
    <g:image_link>${esc(img)}</g:image_link>
${extraImages.map((u: string) => `    <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n")}${extraImages.length ? "\n" : ""}    <g:availability>${variantInStock(v) ? "in stock" : "out of stock"}</g:availability>
    <g:price>${Number(price).toFixed(2)} BRL</g:price>
    <g:brand>use.ÉCLAT</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
${size ? `    <g:size>${esc(size)}</g:size>\n` : ""}${color ? `    <g:color>${esc(color)}</g:color>\n` : ""}${type ? `    <g:product_type>${esc(type)}</g:product_type>\n` : ""}  </item>`)
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
  <title>use.ÉCLAT</title>
  <link>${base}</link>
  <description>Catálogo use.ÉCLAT — athleisure premium</description>
${items.join("\n")}
</channel>
</rss>`

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=0, s-maxage=3600",
    },
  })
}
