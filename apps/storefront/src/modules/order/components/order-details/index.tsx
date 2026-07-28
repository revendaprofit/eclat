import { HttpTypes } from "@medusajs/types"
import { Text } from "@modules/common/components/ui"

type OrderDetailsProps = {
  order: HttpTypes.StoreOrder
  showStatus?: boolean
}

const OrderDetails = ({ order, showStatus }: OrderDetailsProps) => {
  const STATUS_PT: Record<string, string> = {
    not_fulfilled: "Em preparação",
    partially_fulfilled: "Parcialmente preparado",
    fulfilled: "Preparado",
    partially_shipped: "Parcialmente enviado",
    shipped: "Enviado",
    partially_delivered: "Parcialmente entregue",
    delivered: "Entregue",
    canceled: "Cancelado",
    not_paid: "Aguardando pagamento",
    awaiting: "Aguardando pagamento",
    authorized: "Autorizado",
    partially_authorized: "Parcialmente autorizado",
    captured: "Pago",
    partially_captured: "Parcialmente pago",
    partially_refunded: "Parcialmente reembolsado",
    refunded: "Reembolsado",
    requires_action: "Requer ação",
  }
  const formatStatus = (str: string) => {
    return STATUS_PT[str] ?? str.split("_").join(" ")
  }

  return (
    <div>
      <Text>
        Enviamos a confirmação do pedido para{" "}
        <span
          className="text-ui-fg-medium-plus font-semibold"
          data-testid="order-email"
        >
          {order.email}
        </span>
        .
      </Text>
      <Text className="mt-2">
        Data do pedido:{" "}
        <span data-testid="order-date">
          {new Date(order.created_at).toLocaleDateString("pt-BR")}
        </span>
      </Text>
      <Text className="mt-2 text-ui-fg-interactive">
        Número do pedido: <span data-testid="order-id">{order.display_id}</span>
      </Text>

      <div className="flex items-center text-compact-small gap-x-4 mt-4">
        {showStatus && (
          <>
            <Text>
              Status do pedido:{" "}
              <span className="text-ui-fg-subtle " data-testid="order-status">
                {formatStatus(order.fulfillment_status)}
              </span>
            </Text>
            <Text>
              Status do pagamento:{" "}
              <span
                className="text-ui-fg-subtle "
                sata-testid="order-payment-status"
              >
                {formatStatus(order.payment_status)}
              </span>
            </Text>
          </>
        )}
      </div>
    </div>
  )
}

export default OrderDetails
