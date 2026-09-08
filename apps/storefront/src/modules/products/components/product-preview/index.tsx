import { HttpTypes } from "@medusajs/types"
import { getColorMap } from "@lib/data/colors"
import { buildProductCardData } from "@lib/util/product-card-data"
import ProductCard from "../product-card"

// Server: prepara os dados do card (cores, fotos, estoque) e delega ao client.
export default async function ProductPreview({ product, isFeatured, region, listName }: { product: HttpTypes.StoreProduct; isFeatured?: boolean; region: HttpTypes.StoreRegion; listName?: string }) {
  const colorMap = await getColorMap()
  const countryCode = region.countries?.[0]?.iso_2 ?? "br"
  return <ProductCard data={buildProductCardData(product, colorMap)} countryCode={countryCode} listName={listName} aspect={isFeatured ? "featured" : "portrait"} />
}
