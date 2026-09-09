"use client"

import { useEffect, useMemo } from "react"
import type { HttpTypes } from "@medusajs/types"
import type { ColorMap } from "@lib/util/colors"
import type { PecaCard } from "@lib/util/conjuntos"
import { imagesForColor } from "@lib/util/pdp-variants"
import { isVariantAvailable, type StockVariant } from "@lib/util/availability"
import VariantGallery from "@modules/products/components/variant-gallery"
import ColorSelect from "@modules/products/components/product-actions/color-select"
import SizeSelect from "@modules/products/components/product-actions/size-select"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useProductSelection } from "@modules/products/components/product-selection"

export type SelecaoPeca = { variant: HttpTypes.StoreProductVariant | null; completa: boolean }

// Uma peça do conjunto (spec §7.2, ruling 4): galeria + seletores de cor/tamanho da própria PDP,
// dentro do `ProductSelectionProvider` do produto — mesmos componentes da página de produto, só
// que lado a lado com as outras peças. Este componente É a "ponte": lê `useProductSelection()` e
// avisa o builder pai (`onChange`) toda vez que a variante escolhida ou a completude mudam.
//
// Guia de medidas: o link do `SizeSelect` (`href="#medidas"`, fixo — não dá pra alterar sem tocar
// o componente da PDP) não tem alvo nesta página, já que não repetimos a tabela de medidas por
// peça aqui (evita `id="medidas"` duplicado e colunas de tabela diferentes por categoria — ver
// decisão no relatório da task). Em vez disso, este componente expõe seu próprio link "Guia de
// medidas" apontando pra âncora `#medidas` da PDP da própria peça.
export default function PecaDoConjunto({
  peca,
  index,
  colorMap,
  onChange,
}: {
  peca: PecaCard
  index: number
  colorMap: ColorMap
  onChange: (index: number, info: SelecaoPeca) => void
}) {
  const { product, color, selectedVariant, isComplete } = useProductSelection()
  const ssrImages = useMemo(() => imagesForColor(product, color), [product, color])

  useEffect(() => {
    const disponivel = !!selectedVariant && isVariantAvailable(selectedVariant as StockVariant)
    onChange(index, { variant: selectedVariant, completa: isComplete && disponivel })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant, isComplete, index])

  return (
    <div className="flex flex-col gap-y-4" data-testid={`peca-conjunto-${index}`}>
      <h3 className="font-serif text-xl text-eclat-grafite">{peca.title}</h3>
      <VariantGallery ssrImages={ssrImages} productTitle={peca.title} />
      <div className="flex flex-col gap-y-4">
        <ColorSelect colorMap={colorMap} />
        <SizeSelect />
      </div>
      <LocalizedClientLink
        href={`/products/${peca.handle}#medidas`}
        className="text-xs underline text-eclat-grafite/70 self-start"
      >
        Guia de medidas — {peca.title}
      </LocalizedClientLink>
    </div>
  )
}
