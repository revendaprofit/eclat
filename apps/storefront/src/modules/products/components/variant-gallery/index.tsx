"use client"

import type { HttpTypes } from "@medusajs/types"
import ImageGallery from "@modules/products/components/image-gallery"
import { imagesForColor } from "@lib/util/pdp-variants"
import { useProductSelection } from "../product-selection"

// Galeria que segue a cor escolhida (spec §8). SSR = fotos do ?v_id (canônico);
// no client, trocar a cor troca as fotos sem ir ao servidor.
export default function VariantGallery({ ssrImages, productTitle }: { ssrImages: HttpTypes.StoreProductImage[]; productTitle?: string }) {
  const { product, color } = useProductSelection()
  const images = color ? imagesForColor(product, color) : ssrImages
  return <ImageGallery images={images.length ? images : ssrImages} productTitle={productTitle} />
}
