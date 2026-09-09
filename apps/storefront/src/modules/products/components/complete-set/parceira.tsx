"use client"

import { useMemo, useState } from "react"
import Image from "next/image"
import type { HttpTypes } from "@medusajs/types"
import { addToCart } from "@lib/data/cart"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { variantToAddToCart } from "@modules/analytics/items"
import { showToast } from "@modules/common/components/toast"
import { Button, clx } from "@modules/common/components/ui"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { corParceira, formatarReais, precoMinDisponivel, slotMetadata } from "@lib/util/conjuntos"
import { findOption, imagesForColor, sizeAvailability, sizeValues, variantFor } from "@lib/util/pdp-variants"
import { useProductSelection } from "@modules/products/components/product-selection"

const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches

// Card de uma parceira dentro de "Complete o conjunto" (spec §7.3, ruling 5): foto na cor
// derivada da seleção da página (`corParceira`), nome, preço, tamanho próprio (chip, estilo do
// `QuickAdd`) e "Adicionar as duas". A peça-âncora vem de `useProductSelection()` — este
// componente é sempre descendente do `ProductSelectionProvider` da PDP (ver `templates/index.tsx`),
// nunca ganha um provider próprio como as peças da página do conjunto (`PecaDoConjunto`).
export default function Parceira({
  parceira,
  countryCode,
}: {
  parceira: HttpTypes.StoreProduct
  countryCode: string
}) {
  const {
    product: anchor,
    selectedVariant: anchorVariant,
    isComplete: anchorComplete,
    color: anchorColor,
  } = useProductSelection()

  const cor = useMemo(() => corParceira(parceira, anchorColor), [parceira, anchorColor])
  const [tamanho, setTamanho] = useState<string | null>(null)
  const [adicionando, setAdicionando] = useState(false)

  const colorOpt = findOption(parceira, "Cor")
  const sizeOpt = findOption(parceira, "Tamanho")
  const sizes = useMemo(() => sizeValues(parceira), [parceira])
  const avail = useMemo(() => sizeAvailability(parceira, cor), [parceira, cor])

  const parceiraVariant = useMemo(() => {
    if (sizeOpt && !tamanho) return null
    const sel: Record<string, string> = {}
    if (colorOpt && cor) sel[colorOpt.id] = cor
    if (sizeOpt && tamanho) sel[sizeOpt.id] = tamanho
    return variantFor(parceira, sel)
  }, [parceira, colorOpt, cor, sizeOpt, tamanho])

  // Desabilitado até a página TER tamanho escolhido (peça-âncora completa) e a parceira também
  // ter uma variante disponível escolhida (ruling 5).
  const podeAdicionar = !!anchorVariant && anchorComplete && !!parceiraVariant && !adicionando

  const preco = precoMinDisponivel(parceira)
  const imagem = imagesForColor(parceira, cor)[0]?.url ?? parceira.thumbnail ?? null
  const href = `/products/${parceira.handle}${cor ? `?cor=${encodeURIComponent(cor)}` : ""}`

  async function handleAdicionar() {
    if (!podeAdicionar || !anchorVariant || !parceiraVariant) return
    setAdicionando(true)
    const conjuntoHandle = `${anchor.handle}--${parceira.handle}`
    try {
      await addToCart({
        variantId: anchorVariant.id,
        quantity: 1,
        countryCode,
        metadata: slotMetadata(conjuntoHandle, 0),
      })
      pushEcommerceEvent("add_to_cart", {
        ...variantToAddToCart(anchor, anchorVariant, 1),
        item_list_name: "Complete o conjunto",
      })
      await addToCart({
        variantId: parceiraVariant.id,
        quantity: 1,
        countryCode,
        metadata: slotMetadata(conjuntoHandle, 1),
      })
      pushEcommerceEvent("add_to_cart", {
        ...variantToAddToCart(parceira, parceiraVariant, 1),
        item_list_name: "Complete o conjunto",
      })
      // Desktop: o dropdown da sacola já abre sozinho ao detectar a troca de quantidade de itens
      // (mesmo mecanismo do `QuickAdd`/`ConjuntoBuilder`). Mobile: toast.
      if (isMobile()) {
        showToast({
          message: `${anchor.title} e ${parceira.title} adicionados à sacola`,
          action: { label: "Ver sacola", href: "/cart" },
        })
      }
    } catch {
      showToast({ message: "Não foi possível adicionar. Tente de novo." })
    } finally {
      setAdicionando(false)
    }
  }

  return (
    <div className="flex flex-col gap-y-3" data-testid="parceira-conjunto">
      <LocalizedClientLink
        href={href}
        className="block relative w-full aspect-[9/16] overflow-hidden rounded-large bg-eclat-areia/40"
      >
        {imagem && (
          <Image
            src={imagem}
            alt={parceira.title ?? ""}
            fill
            quality={80}
            sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 16vw"
            className="object-cover object-center"
            draggable={false}
          />
        )}
      </LocalizedClientLink>
      <div>
        <p className="text-eclat-grafite" data-testid="parceira-nome">
          {parceira.title}
        </p>
        {preco !== null && (
          <p className="text-eclat-grafite/70 text-sm" data-testid="parceira-preco">
            {formatarReais(preco)}
          </p>
        )}
      </div>
      {sizeOpt && (
        <div className="flex flex-wrap gap-1.5">
          {sizes.map((s) => {
            const esgotado = avail[s] === false
            const on = tamanho === s
            return (
              <button
                key={s}
                type="button"
                disabled={esgotado || adicionando}
                onClick={() => setTamanho(s)}
                aria-pressed={on}
                className={clx(
                  "h-8 min-w-[36px] px-2 text-xs rounded border",
                  on
                    ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite"
                    : esgotado
                      ? "border-eclat-pedra/50 text-eclat-grafite/40 line-through cursor-not-allowed"
                      : "border-eclat-grafite hover:bg-eclat-grafite hover:text-eclat-luz"
                )}
                data-testid={`parceira-tamanho-${s}`}
              >
                {s}
              </button>
            )
          })}
        </div>
      )}
      <Button
        type="button"
        onClick={handleAdicionar}
        disabled={!podeAdicionar}
        isLoading={adicionando}
        variant="secondary"
        className="w-full h-10 text-sm"
        data-testid="adicionar-duas-button"
      >
        Adicionar as duas
      </Button>
    </div>
  )
}
