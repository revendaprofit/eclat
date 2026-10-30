"use client"

import { addToCart } from "@lib/data/cart"
import { useIntersection } from "@lib/hooks/use-in-view"
import { HttpTypes } from "@medusajs/types"
import { Button } from "@modules/common/components/ui"
import Divider from "@modules/common/components/divider"
import OptionSelect from "@modules/products/components/product-actions/option-select"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import ProductPrice from "../product-price"
import MobileActions from "./mobile-actions"
import { variantToAddToCart } from "@modules/analytics/items"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { isVariantAvailable, type StockVariant } from "@lib/util/availability"
import { findOption, rotuloSelecaoIncompleta, variantLabel } from "@lib/util/pdp-variants"
import type { ColorMap } from "@lib/util/colors"
import type { MeasureTable } from "@lib/util/measurements"
import { useProductSelection } from "../product-selection"
import ColorSelect from "./color-select"
import SizeSelect from "./size-select"
import NotifyMe from "../notify-me"
import { emCentavos, type Condicoes } from "@lib/util/condicoes"
import type { RegrasDeFrete } from "@lib/util/frete"
import { getProductPrice } from "@lib/util/get-product-price"
import FretePrazo from "../frete-prazo"

type ProductActionsProps = {
  product: HttpTypes.StoreProduct
  region: HttpTypes.StoreRegion
  colorMap: ColorMap
  disabled?: boolean
  // tabela de medidas da categoria do produto (null = sem recomendação, ex.: acessórios)
  measureTable?: MeasureTable | null
  // acessório sem tabela de medidas: some o link "Guia de medidas" (a aba não existe na PDP)
  semMedidas?: boolean
  condicoes?: Condicoes
  // pisos do frete grátis (régua no "Calcule o frete"); null = backend sem a rota
  regrasFrete?: RegrasDeFrete | null
}

export default function ProductActions({ product, colorMap, disabled, measureTable, semMedidas, condicoes, regrasFrete = null }: ProductActionsProps) {
  const { selection, setValue, selectedVariant, isComplete } = useProductSelection()
  const [isAdding, setIsAdding] = useState(false)
  const [comprando, setComprando] = useState(false)
  const router = useRouter()
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

  // "Comprar agora" (referência bechose.com.br, 2026-10-10): põe na sacola e já vai para o checkout.
  const handleComprarAgora = async () => {
    if (!selectedVariant?.id) return null
    setComprando(true)
    try {
      await addToCart({ variantId: selectedVariant.id, quantity: 1, countryCode })
      pushEcommerceEvent("add_to_cart", variantToAddToCart(product, selectedVariant, 1))
      router.push(`/${countryCode}/checkout?step=address`)
    } catch {
      setComprando(false)
    }
  }
  // Frete na PDP cota a variante escolhida; antes de escolher o tamanho, a primeira do produto (mesmo peso).
  const varianteParaFrete = selectedVariant?.id ?? product.variants?.[0]?.id ?? null
  const precoDaPeca = getProductPrice({ product, variantId: selectedVariant?.id })
  const precoCentavos = emCentavos((precoDaPeca.variantPrice ?? precoDaPeca.cheapestPrice)?.calculated_price_number ?? 0)

  const outrasOpcoes = (product.options ?? []).filter((o) => !/^(tamanho|cor)$/i.test(o.title ?? ""))
  const hasVariants = (product.variants?.length ?? 0) > 1
  const notify = notifyFor ?? (selectedVariant && !inStock ? { variantId: selectedVariant.id, label: variantLabel(product, selectedVariant) } : null)

  return (
    <div className="flex flex-col gap-y-2" ref={actionsRef}>
      {hasVariants && (
        <div className="flex flex-col gap-y-4">
          {findOption(product, "Cor") && <ColorSelect colorMap={colorMap} disabled={!!disabled || isAdding} />}
          {findOption(product, "Tamanho") && (
            <SizeSelect
              disabled={!!disabled || isAdding}
              onNotify={(variantId, label) => setNotifyFor({ variantId, label })}
              measureTable={measureTable}
              showGuide={!semMedidas}
            />
          )}
          {outrasOpcoes.map((option) => (
            <OptionSelect key={option.id} option={option} current={selection[option.id]} updateOption={setValue} title={option.title ?? ""} disabled={!!disabled || isAdding} data-testid="product-options" />
          ))}
          <Divider />
        </div>
      )}
      {/* O frete em destaque subiu para o topo da coluna, antes do título (sócia, 30/10) — ver templates/index.tsx. */}
      <ProductPrice product={product} variant={selectedVariant ?? undefined} condicoes={condicoes} />
      <Button
        onClick={handleAddToCart}
        disabled={!inStock || !selectedVariant || !!disabled || isAdding || !isComplete}
        variant="primary"
        className="w-full h-10"
        isLoading={isAdding}
        data-testid="add-product-button"
      >
        {!selectedVariant || !isComplete ? rotuloSelecaoIncompleta(product, selection) : !inStock ? "Esgotado" : "Adicionar à sacola"}
      </Button>
      {selectedVariant && isComplete && inStock && (
        <Button
          onClick={handleComprarAgora}
          disabled={!!disabled || isAdding || comprando}
          variant="secondary"
          className="w-full h-10"
          isLoading={comprando}
          data-testid="comprar-agora-button"
        >
          Comprar agora
        </Button>
      )}
      <FretePrazo variantId={varianteParaFrete} precoCentavos={precoCentavos} regras={regrasFrete} />
      {notify && <NotifyMe key={notify.variantId} productId={product.handle ?? product.id} variantLabel={notify.label} />}
      <MobileActions
        product={product}
        variant={selectedVariant ?? undefined}
        options={selection}
        updateOptions={setValue}
        inStock={inStock}
        handleAddToCart={handleAddToCart}
        handleComprarAgora={handleComprarAgora}
        isAdding={isAdding}
        show={!inView}
        optionsDisabled={!!disabled || isAdding}
        colorMap={colorMap}
        onNotify={(variantId, label) => setNotifyFor({ variantId, label })}
        measureTable={measureTable}
        semMedidas={semMedidas}
      />
    </div>
  )
}
