"use client"

import { agruparDescontos, type LinhaComAjustes } from "@lib/util/carrinho-conjunto"
import { convertToLocale } from "@lib/util/money"
import React from "react"

type CartTotalsProps = {
  totals: {
    total?: number | null
    subtotal?: number | null
    tax_total?: number | null
    currency_code: string
    item_subtotal?: number | null
    shipping_subtotal?: number | null
    discount_subtotal?: number | null
    items?: LinhaComAjustes[] | null
  }
}

const CartTotals: React.FC<CartTotalsProps> = ({ totals }) => {
  const {
    currency_code,
    total,
    tax_total,
    item_subtotal,
    shipping_subtotal,
    discount_subtotal,
  } = totals

  const grupos = agruparDescontos(totals.items)
  // Ruling 2: o que não for conjunto nem cupom de linha (ex.: ajuste de frete) fica na linha genérica.
  const restante = Math.max(0, Math.round((discount_subtotal ?? 0) * 100) - grupos.conjunto - grupos.cupom)

  return (
    <div>
      <div className="flex flex-col gap-y-2 txt-medium text-ui-fg-subtle ">
        <div className="flex items-center justify-between">
          <span>Subtotal (sem frete e impostos)</span>
          <span data-testid="cart-subtotal" data-value={item_subtotal || 0}>
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span>Frete</span>
          <span data-testid="cart-shipping" data-value={shipping_subtotal || 0}>
            {convertToLocale({ amount: shipping_subtotal ?? 0, currency_code })}
          </span>
        </div>
        {grupos.conjunto > 0 && (
          <div className="flex items-center justify-between">
            <span>Benefício Conjunto</span>
            <span className="text-ui-fg-interactive" data-testid="cart-beneficio-conjunto" data-value={grupos.conjunto}>
              - {convertToLocale({ amount: grupos.conjunto / 100, currency_code })}
            </span>
          </div>
        )}
        {grupos.cupom > 0 && (
          <div className="flex items-center justify-between">
            <span>Cupom</span>
            <span className="text-ui-fg-interactive" data-testid="cart-cupom" data-value={grupos.cupom}>
              - {convertToLocale({ amount: grupos.cupom / 100, currency_code })}
            </span>
          </div>
        )}
        {restante > 0 && (
          <div className="flex items-center justify-between">
            <span>Desconto</span>
            <span className="text-ui-fg-interactive" data-testid="cart-discount" data-value={restante}>
              - {convertToLocale({ amount: restante / 100, currency_code })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="flex gap-x-1 items-center ">Impostos</span>
          <span data-testid="cart-taxes" data-value={tax_total || 0}>
            {convertToLocale({ amount: tax_total ?? 0, currency_code })}
          </span>
        </div>
      </div>
      <div className="h-px w-full border-b border-gray-200 my-4" />
      <div className="flex items-center justify-between text-ui-fg-base mb-2 txt-medium ">
        <span>Total</span>
        <span
          className="txt-xlarge-plus"
          data-testid="cart-total"
          data-value={total || 0}
        >
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
      <div className="h-px w-full border-b border-gray-200 mt-4" />
    </div>
  )
}

export default CartTotals
