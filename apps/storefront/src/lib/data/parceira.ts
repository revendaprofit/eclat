import "server-only"

// Link da creator: busca o cupom do apelido no backend e põe o cupom na sacola de quem chegou pelo link.
// Nada aqui pode quebrar a compra: qualquer falha = sacola como estava.
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"
import { getAuthHeaders, getCacheTag } from "./cookies"
import { codigosOcultosMantidos, cuponsVisiveis } from "@lib/util/carrinho-conjunto"
import { COOKIE_PARCEIRA, decidirCupomDaParceira, lerParceira, limparApelido } from "@lib/util/parceira"

/** Cupom da parceria ATIVA dona do apelido; null se o link não existe (ou o backend ainda não tem a rota). */
export async function codigoDoApelido(apelido: string): Promise<string | null> {
  const a = limparApelido(apelido)
  if (!a) return null
  return sdk.client
    .fetch<{ codigo?: string }>(`/store/parcerias/${a}`, { method: "GET", next: { revalidate: 60 } })
    .then((r) => (typeof r?.codigo === "string" && r.codigo ? r.codigo.toUpperCase() : null))
    .catch(() => null)
}

/**
 * Se a cliente chegou por um link de creator (cookie), põe o cupom dela na sacola — só se a sacola não tiver
 * outro cupom — e grava de qual link/vídeo ela veio (`metadata.parceria_link` e `parceria_conteudo`, que seguem
 * para o pedido). Devolve true se mudou a sacola.
 */
export async function aplicarCupomDaParceira(cartId: string): Promise<boolean> {
  try {
    const parceira = lerParceira((await cookies()).get(COOKIE_PARCEIRA)?.value)
    if (!parceira) return false
    const headers = { ...(await getAuthHeaders()) }
    const { cart } = await sdk.client.fetch<HttpTypes.StoreCartResponse>(`/store/carts/${cartId}`, {
      method: "GET",
      query: { fields: "id,metadata,*promotions" },
      headers,
      cache: "no-store",
    })
    const visiveis = cuponsVisiveis(cart.promotions).map((p) => p.code).filter((c): c is string => !!c)
    if (decidirCupomDaParceira({ parceira, metadata: cart.metadata, cuponsVisiveis: visiveis }) === "nada") return false

    await sdk.store.cart.update(
      cartId,
      {
        promo_codes: [...codigosOcultosMantidos(cart.promotions), parceira.codigo],
        metadata: { ...(cart.metadata ?? {}), parceria_link: parceira.codigo, parceria_conteudo: parceira.conteudo },
      },
      {},
      headers
    )
    revalidateTag(await getCacheTag("carts"))
    revalidateTag(await getCacheTag("fulfillment"))
    return true
  } catch (e) {
    console.error("[parceira] aplicar cupom", e)
    return false
  }
}
