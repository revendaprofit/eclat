"use server"

import { listProducts } from "./products"
import { MAX_PRODUCTS, MIN_QUERY, type ProductHit } from "@lib/util/search-suggest"

// Até 5 produtos para o dropdown da busca (spec §9). Nunca lança: dropdown vazio é melhor
// que barra quebrada. Usa listProducts (cache/revalidate de 5 min, mesmos fields padrão).
export async function suggestProducts(q: string, countryCode: string): Promise<ProductHit[]> {
  const termo = q.trim()
  if (termo.length < MIN_QUERY) return []
  try {
    const { response } = await listProducts({ countryCode, queryParams: { q: termo, limit: MAX_PRODUCTS } })
    return response.products
      .filter((p) => !!p.handle)
      .map((p) => ({ id: p.id, title: p.title ?? "", handle: p.handle as string, thumbnail: p.thumbnail ?? null }))
  } catch (e) {
    console.error("[search] sugestões", e)
    return []
  }
}
