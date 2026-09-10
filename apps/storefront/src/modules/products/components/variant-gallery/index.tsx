"use client"

import type { HttpTypes } from "@medusajs/types"
import ImageGallery from "@modules/products/components/image-gallery"
import { imagesForColor } from "@lib/util/pdp-variants"
import { useMemo } from "react"
import { useProductSelection } from "../product-selection"

// Galeria que segue a cor escolhida (spec §8). SSR = fotos do ?v_id (canônico);
// no client, trocar a cor troca as fotos sem ir ao servidor.
export default function VariantGallery({
  ssrImages,
  productTitle,
  productHandle,
  youtubeId,
}: {
  ssrImages: HttpTypes.StoreProductImage[]
  productTitle?: string
  productHandle?: string
  // product.metadata.youtube_id já validado por parseYoutubeId (no template)
  youtubeId?: string | null
}) {
  const { product, color } = useProductSelection()
  // useMemo (não só uma expressão inline): sem isso `images` é um array novo a cada
  // render, e o ImageGallery abaixo não consegue distinguir "mesma lista, novo render"
  // de "lista realmente trocou" — o que quebrava o reset do carrossel na troca de cor.
  const images = useMemo(() => {
    const forColor = color ? imagesForColor(product, color) : ssrImages
    return forColor.length ? forColor : ssrImages
  }, [product, color, ssrImages])
  return (
    <ImageGallery
      images={images}
      productTitle={productTitle}
      productHandle={productHandle}
      youtubeId={youtubeId}
    />
  )
}
