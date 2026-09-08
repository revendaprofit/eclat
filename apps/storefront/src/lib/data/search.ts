import "server-only"

import { listProducts } from "./products"
import { MAX_PRODUCTS, MIN_QUERY, type ProductHit } from "@lib/util/search-suggest"

// Até 5 produtos para o dropdown da busca (spec §9). Nunca lança: dropdown vazio é melhor
// que barra quebrada. Usa listProducts (cache/revalidate de 5 min, mesmos fields padrão).
// Server-only: chamada só pela Route Handler `/api/busca/sugestoes` (I1 — antes era server
// action pública, que qualquer cliente podia invocar direto com `q`/`countryCode` arbitrários).
export async function suggestProducts(q: string, countryCode: string): Promise<ProductHit[]> {
  if (typeof q !== "string") return []
  try {
    const termo = q.trim().slice(0, 64)
    if (termo.length < MIN_QUERY) return []
    const cc = typeof countryCode === "string" ? countryCode.trim().slice(0, 2).toLowerCase() : ""
    const { response } = await listProducts({ countryCode: cc, queryParams: { q: termo, limit: MAX_PRODUCTS } })
    return response.products
      .filter((p) => !!p.handle)
      .map((p) => ({ id: p.id, title: p.title ?? "", handle: p.handle as string, thumbnail: p.thumbnail ?? null }))
  } catch (e) {
    console.error("[search] sugestões", e)
    return []
  }
}
