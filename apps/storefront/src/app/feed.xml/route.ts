import { getBaseURL } from "@lib/util/env"
import { getPrevenda } from "@lib/data/prevenda"
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

// Categoria da taxonomia do Google (obrigatória para vestuário no Merchant Center,
// junto com gender/age_group). Caminho completo em inglês, como o Google aceita.
const GPC_ACTIVEWEAR = "Apparel & Accessories > Clothing > Activewear"
// Acessórios não são Activewear: vão pelo handle da categoria (flat no Medusa), antes do casamento por nome.
const GPC_POR_HANDLE: Record<string, string> = {
  oculos: "Apparel & Accessories > Clothing Accessories > Sunglasses",
  meias: "Apparel & Accessories > Clothing > Underwear & Socks > Socks",
  acessorios: "Apparel & Accessories > Clothing Accessories",
}
function googleCategory(
  p: { title?: string | null; categories?: { handle?: string | null }[] | null },
  type?: string
): string {
  const handles = (p?.categories ?? []).map((c) => c?.handle ?? "")
  for (const h of ["oculos", "meias", "acessorios"]) {
    if (handles.includes(h)) return GPC_POR_HANDLE[h]
  }
  const t = `${type ?? ""} ${p?.title ?? ""}`.toLowerCase()
  if (/\btop\b|sutiã|bra/.test(t)) return `${GPC_ACTIVEWEAR} > Sports Bras`
  if (/short|bermuda/.test(t)) return `${GPC_ACTIVEWEAR} > Active Shorts`
  if (/legging|calça/.test(t)) return `${GPC_ACTIVEWEAR} > Active Pants`
  return GPC_ACTIVEWEAR // macaquinho, macacão, conjuntos e demais peças
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function GET() {
  const base = getBaseURL()
  // Pré-venda: Google/Meta aceitam availability=preorder + availability_date
  // (obrigatório declarar; "in stock" com envio em 25 dias viola a política).
  const [products, prevenda] = await Promise.all([listAllProductsForFeed(), getPrevenda()])

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
${extraImages.map((u: string) => `    <g:additional_image_link>${esc(u)}</g:additional_image_link>`).join("\n")}${extraImages.length ? "\n" : ""}    <g:availability>${variantInStock(v) ? (prevenda.ativa ? "preorder" : "in stock") : "out of stock"}</g:availability>
${prevenda.ativa && variantInStock(v) ? `    <g:availability_date>${prevenda.envios_a_partir}T00:00:00-03:00</g:availability_date>\n` : ""}
    <g:price>${Number(price).toFixed(2)} BRL</g:price>
    <g:brand>use.ÉCLAT</g:brand>
    <g:condition>new</g:condition>
    <g:identifier_exists>no</g:identifier_exists>
    <g:google_product_category>${esc(googleCategory(p, type))}</g:google_product_category>
    <g:gender>female</g:gender>
    <g:age_group>adult</g:age_group>
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
