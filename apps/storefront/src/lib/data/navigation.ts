import "server-only"

import { listCategories } from "./categories"
import { listCollections } from "./collections"
import { listProducts } from "./products"
import { getColorMap } from "./colors"
import { getIdsProdutosConjuntos } from "./conjuntos"
import { buildNavData, type NavData } from "@lib/util/navigation"

// Uma busca de produtos (≤100, com *categories/variantes/estoque — fields padrão) + categorias +
// coleções + mapa de cores + peças dos conjuntos → NavData. Nunca lança: navegação vazia é melhor
// que página quebrada. Menu, rodapé e sitemap leem daqui, então os três mostram as mesmas páginas.
export async function getNavigation(countryCode: string): Promise<NavData> {
  try {
    const [categories, collectionsRes, productsRes, colorMap, conjuntoProductIds] = await Promise.all([
      listCategories(),
      listCollections({ fields: "id,title,handle,metadata" }),
      listProducts({ countryCode, queryParams: { limit: 100 } }),
      getColorMap(),
      getIdsProdutosConjuntos(),
    ])
    return buildNavData({
      conjuntoProductIds,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories: categories as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      products: productsRes.response.products as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
      collections: collectionsRes.collections as any,
      colorMap,
    })
  } catch (e) {
    console.error("[navigation]", e)
    return { roots: [], feminine: [], collections: [] }
  }
}
