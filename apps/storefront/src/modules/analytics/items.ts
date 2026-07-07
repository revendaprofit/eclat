import { HttpTypes } from "@medusajs/types"
import { EcommercePayload, GA4Item } from "./track"

// Constrói payloads de e-commerce (schema GA4) a partir dos objetos do Medusa.
const n = (v: unknown): number | undefined =>
  typeof v === "number" ? v : undefined

/* eslint-disable @typescript-eslint/no-explicit-any */

export function productToViewItem(
  product: HttpTypes.StoreProduct
): EcommercePayload {
  const v: any = product.variants?.[0]
  const price = v?.calculated_price?.calculated_amount
  return {
    currency: (v?.calculated_price?.currency_code || "brl").toUpperCase(),
    value: n(price),
    items: [
      {
        item_id: v?.sku || product.id,
        item_name: product.title || undefined,
        price: n(price),
        quantity: 1,
        item_category: (product.categories?.[0] as any)?.name,
      },
    ],
  }
}

export function variantToAddToCart(
  product: HttpTypes.StoreProduct,
  variant: any,
  quantity: number
): EcommercePayload {
  const price = variant?.calculated_price?.calculated_amount
  return {
    currency: (variant?.calculated_price?.currency_code || "brl").toUpperCase(),
    value: n(price) != null ? (n(price) as number) * quantity : undefined,
    items: [
      {
        item_id: variant?.sku || variant?.id || product.id,
        item_name: product.title || undefined,
        price: n(price),
        quantity,
      },
    ],
  }
}

export function cartToBeginCheckout(cart: HttpTypes.StoreCart): EcommercePayload {
  return {
    currency: (cart.currency_code || "brl").toUpperCase(),
    value: n((cart as any).total),
    items: (cart.items || []).map(
      (it: any): GA4Item => ({
        item_id: it.variant_sku || it.product_id || it.id,
        item_name: it.product_title || it.title,
        price: n(it.unit_price),
        quantity: it.quantity,
      })
    ),
  }
}

export function orderToPurchase(order: HttpTypes.StoreOrder): EcommercePayload {
  return {
    currency: (order.currency_code || "brl").toUpperCase(),
    value: n((order as any).total),
    transaction_id: order.display_id ? String(order.display_id) : order.id,
    items: (order.items || []).map(
      (it: any): GA4Item => ({
        item_id: it.variant_sku || it.product_id || it.id,
        item_name: it.product_title || it.title,
        price: n(it.unit_price),
        quantity: it.quantity,
      })
    ),
  }
}
