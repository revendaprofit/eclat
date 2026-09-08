import { HttpTypes } from "@medusajs/types"
import { sortByKey } from "./catalog-facets"

// Compatibilidade com o starter: chaves antigas → sortByKey. Removido na Task 4.
export type SortOptions = "price_asc" | "price_desc" | "created_at"
const MAP = { created_at: "novidades", price_asc: "menor-preco", price_desc: "maior-preco" } as const
export function sortProducts(products: HttpTypes.StoreProduct[], sortBy: SortOptions): HttpTypes.StoreProduct[] {
  return sortByKey(products, MAP[sortBy] ?? "novidades")
}
