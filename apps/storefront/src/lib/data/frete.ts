"use server"

import { sdk } from "@lib/config"
import type { Prazos, RegrasDeFrete } from "@lib/util/frete"
import { getAuthHeaders } from "./cookies"

/** Pisos do frete grátis. `null` se o backend ainda não tiver a rota (deploy da vitrine antes do backend). */
export async function getRegrasDeFrete(): Promise<RegrasDeFrete | null> {
  return sdk.client
    .fetch<RegrasDeFrete>(`/store/frete/regras`, { method: "GET", next: { revalidate: 300 } })
    .then((r) => (typeof r?.piso_mg === "number" && typeof r?.piso_brasil === "number" ? r : null))
    .catch(() => null)
}

/** Prazo por serviço para o carrinho. Nunca lança: sem prazo, a tela só não mostra a linha. */
export async function getPrazosDeFrete(cartId: string): Promise<Prazos> {
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<{ prazos: Prazos }>(`/store/frete/prazos`, { method: "GET", query: { cart_id: cartId }, headers, cache: "no-store" })
    .then((r) => r?.prazos ?? {})
    .catch(() => ({}))
}
