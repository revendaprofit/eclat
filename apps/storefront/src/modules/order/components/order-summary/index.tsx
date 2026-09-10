import { agruparDescontos } from "@lib/util/carrinho-conjunto"
import { convertToLocale } from "@lib/util/money"
import { HttpTypes } from "@medusajs/types"

type OrderSummaryProps = {
  order: HttpTypes.StoreOrder
}

const OrderSummary = ({ order }: OrderSummaryProps) => {
  const getAmount = (amount?: number | null) => {
    if (!amount) {
      return
    }

    return convertToLocale({
      amount,
      currency_code: order.currency_code,
    })
  }

  const grupos = agruparDescontos(order.items)
  // Ruling 2: mesma base do CartTotals (discount_subtotal). O tipo StoreOrder não declara o
  // campo (ver relatório da fix wave F4) — cai para discount_total quando ausente.
  const discountSubtotal =
    (order as { discount_subtotal?: number | null }).discount_subtotal ?? order.discount_total
  const restante = Math.max(
    0,
    Math.round((discountSubtotal ?? 0) * 100) - grupos.conjunto - grupos.cupom
  )

  return (
    <div>
      <h2 className="text-base-semi">Resumo do pedido</h2>
      <div className="text-small-regular text-ui-fg-base my-2">
        <div className="flex items-center justify-between text-base-regular text-ui-fg-base mb-2">
          <span>Subtotal</span>
          <span>{getAmount(order.subtotal)}</span>
        </div>
        <div className="flex flex-col gap-y-1">
          {grupos.conjunto > 0 && (
            <div className="flex items-center justify-between">
              <span>Benefício Conjunto</span>
              <span>- {getAmount(grupos.conjunto / 100)}</span>
            </div>
          )}
          {grupos.cupom > 0 && (
            <div className="flex items-center justify-between">
              <span>Cupom</span>
              <span>- {getAmount(grupos.cupom / 100)}</span>
            </div>
          )}
          {restante > 0 && (
            <div className="flex items-center justify-between">
              <span>Desconto</span>
              <span>- {getAmount(restante / 100)}</span>
            </div>
          )}
          {order.gift_card_total > 0 && (
            <div className="flex items-center justify-between">
              <span>Vale-presente</span>
              <span>- {getAmount(order.gift_card_total)}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>Frete</span>
            <span>{getAmount(order.shipping_total)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Impostos</span>
            <span>{getAmount(order.tax_total)}</span>
          </div>
        </div>
        <div className="h-px w-full border-b border-gray-200 border-dashed my-4" />
        <div className="flex items-center justify-between text-base-regular text-ui-fg-base mb-2">
          <span>Total</span>
          <span>{getAmount(order.total)}</span>
        </div>
      </div>
    </div>
  )
}

export default OrderSummary
