"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { useParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { variantToAddToCart } from "@modules/analytics/items"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { isVariantAvailable, type StockVariant } from "@lib/util/availability"
import { findOption, variantLabel } from "@lib/util/pdp-variants"
import type { ColorMap } from "@lib/util/colors"
import { useProductSelection } from "../product-selection"
import ColorSelect from "./color-select"
import SizeSelect from "./size-select"
import NotifyMe from "../notify-me"

type ProductActionsProps = { product: HttpTypes.StoreProduct; region: HttpTypes.StoreRegion; colorMap: ColorMap; disabled?: boolean }

export default function ProductActions({ product, colorMap, disabled }: ProductActionsProps) {
  const { selection, setValue, selectedVariant, isComplete } = useProductSelection()
  const [isAdding, setIsAdding] = useState(false)
  const [notifyFor, setNotifyFor] = useState<{ variantId: string; label: string } | null>(null)
  const countryCode = useParams().countryCode as string

  // Qualquer troca de opção limpa o pedido manual de "Avise-me": ele não deve sobreviver a uma nova
  // seleção (ex.: usuária pede aviso num tamanho esgotado e depois escolhe um tamanho disponível).
  useEffect(() => {
    setNotifyFor(null)
  }, [selection])

  const inStock = !!selectedVariant && isVariantAvailable(selectedVariant as StockVariant)
  const actionsRef = useRef<HTMLDivElement>(null)
  const inView = useIntersection(actionsRef, "0px")

  const handleAddToCart = async () => {
    if (!selectedVariant?.id) return null
    setIsAdding(true)
    try {
      await addToCart({ variantId: selectedVariant.id, quantity: 1, countryCode })
      pushEcommerceEvent("add_to_cart", variantToAddToCart(product, selectedVariant, 1))
    } finally {
      setIsAdding(false)
    }
  }

  const outrasOpcoes = (product.options ?? []).filter((o) => !/^(tamanho|cor)$/i.test(o.title ?? ""))
  const hasVariants = (product.variants?.length ?? 0) > 1
  const notify = notifyFor ?? (selectedVariant && !inStock ? { variantId: selectedVariant.id, label: variantLabel(product, selectedVariant) } : null)

  return (
    <div className="flex flex-col gap-y-2" ref={actionsRef}>
      {hasVariants && (
        <div className="flex flex-col gap-y-4">
          {findOption(product, "Cor") && <ColorSelect colorMap={colorMap} disabled={!!disabled || isAdding} />}
          {findOption(product, "Tamanho") && <SizeSelect disabled={!!disabled || isAdding} onNotify={(variantId, label) => setNotifyFor({ variantId, label })} />}
          {outrasOpcoes.map((option) => (
            <OptionSelect key={option.id} option={option} current={selection[option.id]} updateOption={setValue} title={option.title ?? ""} disabled={!!disabled || isAdding} data-testid="product-options" />
          ))}
          <Divider />
        </div>
      )}
      <ProductPrice product={product} variant={selectedVariant ?? undefined} />
      <Button
        onClick={handleAddToCart}
        disabled={!inStock || !selectedVariant || !!disabled || isAdding || !isComplete}
        variant="primary"
        className="w-full h-10"
        isLoading={isAdding}
        data-testid="add-product-button"
      >
        {!selectedVariant || !isComplete ? "Escolha as opções" : !inStock ? "Esgotado" : "Adicionar à sacola"}
      </Button>
      {notify && <NotifyMe key={notify.variantId} productId={product.handle ?? product.id} variantLabel={notify.label} />}
      <MobileActions
        product={product}
        variant={selectedVariant ?? undefined}
        options={selection}
        updateOptions={setValue}
        inStock={inStock}
        handleAddToCart={handleAddToCart}
        isAdding={isAdding}
        show={!inView}
        optionsDisabled={!!disabled || isAdding}
        colorMap={colorMap}
        onNotify={(variantId, label) => setNotifyFor({ variantId, label })}
      />
    </div>
  )
}
