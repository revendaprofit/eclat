import { listProducts } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { HttpTypes } from "@medusajs/types"
import { colorValues } from "@lib/util/pdp-variants"
import { normalizeColorName } from "@lib/util/colors"
import { sortByKey } from "@lib/util/catalog-facets"
import ProductPreview from "../product-preview"

// "Mais {categoria}" (spec §8): mesma categoria, cor do produto primeiro, depois novidades.
export default async function RelatedProducts({ product, countryCode }: { product: HttpTypes.StoreProduct; countryCode: string }) {
  const region = await getRegion(countryCode)
  if (!region) return null
  const cat = product.categories?.[0]
  const queryParams: HttpTypes.StoreProductListParams = cat ? { category_id: [cat.id], limit: 24 } : product.collection_id ? { collection_id: [product.collection_id], limit: 24 } : { limit: 24 }
  const { response } = await listProducts({ queryParams, countryCode })
  const outros = response.products.filter((p) => p.id !== product.id)
  if (!outros.length) return null
  const cor = colorValues(product)[0]
  const temCor = (p: HttpTypes.StoreProduct) => !!cor && colorValues(p).some((c) => normalizeColorName(c) === normalizeColorName(cor))
  const ordenados = [...sortByKey(outros.filter(temCor), "novidades"), ...sortByKey(outros.filter((p) => !temCor(p)), "novidades")].slice(0, 8)
  const titulo = cat ? `Mais ${cat.name}` : "Você também pode gostar"
  return (
    <div className="product-page-constraint">
      <div className="flex flex-col items-center text-center mb-16">
        <span className="text-base-regular text-gray-600 mb-6">{titulo}</span>
        <p className="text-2xl-regular text-ui-fg-base max-w-lg">Outras peças da ÉCLAT no mesmo estilo.</p>
      </div>
      <ul className="grid grid-cols-2 small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8">
        {ordenados.map((p) => (
          <li key={p.id}><ProductPreview region={region} product={p} listName={titulo} /></li>
        ))}
      </ul>
    </div>
  )
}
