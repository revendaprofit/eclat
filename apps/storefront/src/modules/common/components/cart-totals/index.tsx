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
    shipping_methods?: { id: string }[] | null
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
    shipping_methods,
  } = totals

  const grupos = agruparDescontos(totals.items)
  // Ruling 2: o que não for conjunto nem cupom de linha (ex.: ajuste de frete) fica na linha genérica.
  const restante = Math.max(0, Math.round((discount_subtotal ?? 0) * 100) - grupos.conjunto - grupos.cupom)

  // Linha da nota: rótulo · pontilhado · valor (o pontilhado guia o olho em telas largas e some em nada no celular).
  const Linha = ({ rotulo, children, destaque }: { rotulo: string; children: React.ReactNode; destaque?: boolean }) => (
    <div className="flex items-baseline gap-2">
      <span className="shrink-0">{rotulo}</span>
      <span aria-hidden className="flex-1 -translate-y-[3px] border-b border-dotted border-eclat-pedra" />
      <span className={destaque ? "shrink-0 text-eclat-terracota" : "shrink-0 text-eclat-grafite"}>{children}</span>
    </div>
  )

  return (
    <div>
      <div className="flex flex-col gap-y-2.5 text-sm text-eclat-grafite/75">
        <Linha rotulo="Subtotal">
          <span data-testid="cart-subtotal" data-value={item_subtotal || 0}>
            {convertToLocale({ amount: item_subtotal ?? 0, currency_code })}
          </span>
        </Linha>
        <Linha rotulo="Frete">
          <span data-testid="cart-shipping" data-value={shipping_subtotal || 0}>
            {(shipping_methods?.length ?? 0) === 0
              ? "calculado no checkout"
              : (shipping_subtotal ?? 0) === 0
                ? "Grátis"
                : convertToLocale({ amount: shipping_subtotal ?? 0, currency_code })}
          </span>
        </Linha>
        {grupos.conjunto > 0 && (
          <Linha rotulo="Benefício Conjunto" destaque>
            <span data-testid="cart-beneficio-conjunto" data-value={grupos.conjunto / 100}>
              − {convertToLocale({ amount: grupos.conjunto / 100, currency_code })}
            </span>
          </Linha>
        )}
        {grupos.cupom > 0 && (
          <Linha rotulo="Cupom" destaque>
            <span data-testid="cart-cupom" data-value={grupos.cupom / 100}>
              − {convertToLocale({ amount: grupos.cupom / 100, currency_code })}
            </span>
          </Linha>
        )}
        {restante > 0 && (
          <Linha rotulo="Desconto" destaque>
            <span data-testid="cart-discount" data-value={restante / 100}>
              − {convertToLocale({ amount: restante / 100, currency_code })}
            </span>
          </Linha>
        )}
        {/* Impostos só aparecem quando existem: no Brasil o preço já é final, e a linha "R$ 0,00" era ruído. */}
        {(tax_total ?? 0) > 0 && (
          <Linha rotulo="Impostos">
            <span data-testid="cart-taxes" data-value={tax_total || 0}>
              {convertToLocale({ amount: tax_total ?? 0, currency_code })}
            </span>
          </Linha>
        )}
      </div>
      <div className="mt-5 flex items-baseline justify-between border-t border-eclat-grafite/80 pt-4 text-eclat-grafite">
        <span className="text-xs uppercase tracking-[0.2em]">Total</span>
        <span className="font-serif text-4xl leading-none tabular-nums" data-testid="cart-total" data-value={total || 0}>
          {convertToLocale({ amount: total ?? 0, currency_code })}
        </span>
      </div>
    </div>
  )
}

export default CartTotals
