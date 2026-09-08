import "server-only"

import { listCategories } from "./categories"
import { listCollections } from "./collections"
import { listProducts } from "./products"
import { getColorMap } from "./colors"
import { buildNavData, type NavData } from "@lib/util/navigation"

// Uma busca de produtos (≤100, com *categories/variantes/estoque — fields padrão) + categorias +
// coleções + mapa de cores → NavData. Nunca lança: navegação vazia é melhor que página quebrada.
export async function getNavigation(countryCode: string): Promise<NavData> {
  try {
    const [categories, collectionsRes, productsRes, colorMap] = await Promise.all([
      listCategories(),
      listCollections({ fields: "id,title,handle,metadata" }),
      listProducts({ countryCode, queryParams: { limit: 100 } }),
      getColorMap(),
    ])
    return buildNavData({
      categories: categories as any,
      products: productsRes.response.products as any,
      collections: collectionsRes.collections as any,
      colorMap,
    })
  } catch (e) {
    console.error("[navigation]", e)
    return { roots: [], feminine: [], collections: [] }
  }
}
