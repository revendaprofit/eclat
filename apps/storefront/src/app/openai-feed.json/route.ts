import { NextResponse } from "next/server"
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

// Feed de produtos em JSON no formato do OpenAI Product Feed / Agentic
// Commerce Protocol (campos alinhados à spec do Google Merchant, como a spec
// ACP). URL: /openai-feed.json — usar ao aplicar em
// https://developers.openai.com/commerce (expansão internacional pendente).
/* eslint-disable @typescript-eslint/no-explicit-any */

export async function GET() {
  const base = getBaseURL()
  const products = await listAllProductsForFeed()

  const items: any[] = []

  for (const p of products) {
    const img = p.thumbnail || p.images?.[0]?.url
    if (!img || !p.handle) continue

    const link = `${base}/${CC}/products/${p.handle}`
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
      const size = optionValue(v, SIZE_RE)
      const color = optionValue(v, COLOR_RE)
      items.push({
        id: v.sku || v.id,
        ...(hasGroup ? { item_group_id: p.handle } : {}),
        title: `${p.title}${size ? ` - ${size}` : ""}${color ? ` ${color}` : ""}`,
        description: p.description || p.subtitle || p.title,
        link: `${link}${v.id ? `?v_id=${v.id}` : ""}`,
        image_link: img,
        ...(extraImages.length ? { additional_image_link: extraImages } : {}),
        price: `${Number(v.calculated_price.calculated_amount).toFixed(2)} BRL`,
        availability: variantInStock(v) ? "in_stock" : "out_of_stock",
        ...(typeof v.inventory_quantity === "number"
          ? { inventory_quantity: v.inventory_quantity }
          : {}),
        brand: "use.ÉCLAT",
        condition: "new",
        ...(size ? { size } : {}),
        ...(color ? { color } : {}),
        ...(type ? { product_category: type } : {}),
        // descoberta/busca sim; checkout dentro do ChatGPT ainda não (Parte 4/MP)
        enable_search: true,
        enable_checkout: false,
      })
    }
  }

  return NextResponse.json(
    {
      merchant: "use.ÉCLAT",
      store_url: base,
      updated_at: new Date().toISOString(),
      products: items,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=0, s-maxage=3600",
      },
    }
  )
}
