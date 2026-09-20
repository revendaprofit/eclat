"use client"

import { useState } from "react"
import { HttpTypes } from "@medusajs/types"
import { deleteLineItem, updateLineItem } from "@lib/data/cart"
import { convertToLocale } from "@lib/util/money"
import ErrorMessage from "@modules/checkout/components/error-message"
import LineItemPrice from "@modules/common/components/line-item-price"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import Thumbnail from "@modules/products/components/thumbnail"

// Peça na sacola, em cartão (redesenho 2026-09): foto em retrato, nome, variação, etiqueta de
// conjunto, quantidade em − / + (alvos de toque de 44px) e total da linha. Substitui a linha de
// tabela do tema padrão, que cortava a coluna "Total" no celular. O `Item` antigo continua servindo
// o resumo do checkout (type="preview").
const MAX_POR_LINHA = 10

export default function ItemCard({
  item,
  currencyCode,
  etiqueta,
}: {
  item: HttpTypes.StoreCartLineItem
  currencyCode: string
  etiqueta?: string | null
}) {
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function mudarQuantidade(quantity: number) {
    if (quantity < 1 || quantity > MAX_POR_LINHA || ocupado) return
    setErro(null)
    setOcupado(true)
    await updateLineItem({ lineId: item.id, quantity })
      .catch((e: Error) => setErro(e.message))
      .finally(() => setOcupado(false))
  }

  async function remover() {
    if (ocupado) return
    setErro(null)
    setOcupado(true)
    await deleteLineItem(item.id).catch((e: Error) => {
      setErro(e.message)
      setOcupado(false)
    })
  }

  const href = `/products/${item.product_handle}`
  const botaoQtd =
    "h-11 w-11 flex items-center justify-center text-lg text-eclat-grafite transition-colors hover:bg-eclat-blush-claro disabled:opacity-30 disabled:hover:bg-transparent"

  return (
    <li
      className={`flex gap-4 small:gap-6 py-5 border-b border-eclat-pedra/40 last:border-b-0 transition-opacity ${ocupado ? "opacity-60" : ""}`}
      data-testid="product-row"
      aria-busy={ocupado}
    >
      <LocalizedClientLink href={href} className="block w-24 small:w-28 shrink-0" aria-label={item.product_title ?? undefined}>
        <Thumbnail thumbnail={item.thumbnail} images={item.variant?.product?.images} size="portrait" className="!p-0 !rounded-md !shadow-none" />
      </LocalizedClientLink>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <LocalizedClientLink href={href} className="font-serif text-xl leading-tight text-eclat-grafite hover:text-eclat-terracota break-words" data-testid="product-title">
              {item.product_title}
            </LocalizedClientLink>
            {item.variant?.title && (
              <p className="mt-1 text-sm text-eclat-grafite/65 break-words" data-testid="product-variant">
                {item.variant.title}
              </p>
            )}
            {etiqueta && (
              <span
                className="mt-2 inline-block rounded-sm bg-eclat-blush-claro px-1.5 py-0.5 text-[11px] uppercase tracking-wider text-eclat-terracota-escuro"
                data-testid="etiqueta-conjunto"
              >
                {etiqueta}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right">
            <LineItemPrice item={item} style="tight" currencyCode={currencyCode} />
            {item.quantity > 1 && (
              <p className="text-xs text-eclat-grafite/50 whitespace-nowrap">
                {convertToLocale({ amount: item.unit_price ?? 0, currency_code: currencyCode })} cada
              </p>
            )}
          </div>
        </div>

        <div className="mt-auto flex items-center justify-between gap-3 pt-4 small:justify-start small:gap-6">
          <div className="inline-flex items-center rounded-md border border-eclat-pedra overflow-hidden" role="group" aria-label={`Quantidade de ${item.product_title}`}>
            <button type="button" className={botaoQtd} onClick={() => mudarQuantidade(item.quantity - 1)} disabled={ocupado || item.quantity <= 1} aria-label="Diminuir quantidade" data-testid="product-qty-minus">
              −
            </button>
            <span className="w-9 text-center text-sm tabular-nums" aria-live="polite" data-testid="product-qty">
              {item.quantity}
            </span>
            <button type="button" className={botaoQtd} onClick={() => mudarQuantidade(item.quantity + 1)} disabled={ocupado || item.quantity >= MAX_POR_LINHA} aria-label="Aumentar quantidade" data-testid="product-qty-plus">
              +
            </button>
          </div>
          <button
            type="button"
            onClick={remover}
            disabled={ocupado}
            className="min-h-[44px] px-1 text-sm text-eclat-grafite/60 underline underline-offset-4 decoration-eclat-pedra hover:text-eclat-terracota hover:decoration-eclat-terracota disabled:opacity-40"
            data-testid="product-delete-button"
          >
            Remover
          </button>
        </div>
        <ErrorMessage error={erro} data-testid="product-error-message" />
      </div>
    </li>
  )
}
