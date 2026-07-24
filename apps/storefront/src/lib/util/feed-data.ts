import { listProducts } from "@lib/data/products"

// Carrega o catálogo inteiro (paginado) com os campos necessários para feeds
// (Google Merchant / Microsoft / Meta / OpenAI). Fonte única — os feeds e o
// JSON-LD devem sempre concordar entre si (preço/estoque divergente derruba
// a confiança dos motores de IA).
/* eslint-disable @typescript-eslint/no-explicit-any */

export const FEED_CC = "br"

const PAGE = 100

export async function listAllProductsForFeed(): Promise<any[]> {
  const products: any[] = []
  try {
    let offset = 0
    for (;;) {
      const { response } = await listProducts({
        countryCode: FEED_CC,
        queryParams: {
          limit: PAGE,
          offset,
          fields:
            "handle,title,subtitle,description,thumbnail,status,*images," +
            "*variants.calculated_price,+variants.inventory_quantity," +
            "+variants.manage_inventory,+variants.allow_backorder," +
            "*variants.options,*variants.options.option,*categories",
        },
      })
      products.push(...response.products)
      offset += PAGE
      if (response.products.length < PAGE || offset >= response.count) break
    }
  } catch (e) {
    // feed sai vazio se a API falhar — mas o motivo precisa aparecer no log
    console.error("[feed] listAllProductsForFeed:", e)
  }
  return products.filter((p) => p.status === "published")
}

// Disponibilidade por variante (mesma regra do JSON-LD em modules/seo/jsonld.tsx)
export function variantInStock(v: any): boolean {
  return (
    v?.manage_inventory === false ||
    v?.allow_backorder === true ||
    (typeof v?.inventory_quantity === "number" && v.inventory_quantity > 0)
  )
}

// Valor de uma opção da variante pelo título da opção (ex.: Tamanho, Cor)
export function optionValue(v: any, pattern: RegExp): string | undefined {
  const opt = (v?.options ?? []).find((o: any) =>
    pattern.test(String(o?.option?.title ?? ""))
  )
  return opt?.value || undefined
}

export const SIZE_RE = /tamanho|size/i
export const COLOR_RE = /\bcor\b|color|colour/i

// Categoria(s) do produto como product_type ("Feminino > Leggings")
export function productType(p: any): string | undefined {
  const names = (p?.categories ?? [])
    .map((c: any) => c?.name)
    .filter(Boolean)
  return names.length ? names.join(" > ") : undefined
}
