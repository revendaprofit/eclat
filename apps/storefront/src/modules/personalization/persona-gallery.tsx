"use client"

import { useEffect, useState } from "react"
import ImageGallery from "@modules/products/components/image-gallery"
import VariantGallery from "@modules/products/components/variant-gallery"
import { getPrefs, onPrefsChange } from "./prefs"
import type { PersonaMedia } from "@lib/data/personas"
import type { HttpTypes } from "@medusajs/types"

// Galeria da PDP com troca por persona ("Minha ÉCLAT").
// SSR/HTML canônico = imagens padrão do produto (SEO intacto).
// Após hidratar, se a cliente escolheu uma modelo E o produto tem fotos
// daquela persona, a galeria troca client-side.
// Sem persona com fotos: a galeria segue a cor escolhida (VariantGallery, spec §8).

export default function PersonaGallery({
  images,
  personaMedia,
  productTitle,
}: {
  images: HttpTypes.StoreProductImage[]
  personaMedia: PersonaMedia[]
  productTitle?: string
}) {
  const [personaId, setPersonaId] = useState<string | undefined>(undefined)

  useEffect(() => {
    setPersonaId(getPrefs().persona_id)
    return onPrefsChange((p) => setPersonaId(p.persona_id))
  }, [])

  const media = personaId
    ? personaMedia.find((m) => m.persona_id === personaId)
    : undefined

  const hasPersonaPhotos = !!media && media.images.length > 0
  const personaImages: HttpTypes.StoreProductImage[] = hasPersonaPhotos
    ? media!.images.map((url, i) => ({ id: `persona-${i}`, url }) as HttpTypes.StoreProductImage)
    : []

  return (
    <div className="relative">
      {hasPersonaPhotos ? (
        <ImageGallery images={personaImages} productTitle={productTitle} />
      ) : (
        <VariantGallery ssrImages={images} productTitle={productTitle} />
      )}
      {hasPersonaPhotos && (
        <p className="text-[10px] text-eclat-grafite/40 text-center mt-1">
          Fotos na sua modelo · imagens criadas com IA
        </p>
      )}
    </div>
  )
}
