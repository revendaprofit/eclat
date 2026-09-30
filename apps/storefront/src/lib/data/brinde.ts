"use server"

// Presente por faixa: chamadas à rota /store/carts/:id/brinde (backend) e às opções do presente.
// Nada aqui pode quebrar a sacola: falhou = sem presente na tela.
import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { cookies } from "next/headers"
import { getAuthHeaders, getCacheTag, getCartId } from "./cookies"
import { rotuloDaVariante, type EstadoBrinde, type FaixaId, type OpcaoDePresente } from "@lib/util/brinde"

const COOKIE_AVISO = "_eclat_brinde_aviso"

export async function getEstadoBrinde(cartId?: string): Promise<EstadoBrinde | null> {
  const id = cartId || (await getCartId())
  if (!id) return null
  const headers = { ...(await getAuthHeaders()) }
  return sdk.client
    .fetch<EstadoBrinde>(`/store/carts/${id}/brinde`, { method: "GET", headers, cache: "no-store" })
    .then((e) => (e && typeof e.base_centavos === "number" ? e : null))
    .catch(() => null)
}

/** Variantes de cada presente (só produto publicado). `disponivel` = tem estoque. */
export async function getOpcoesDePresente(
  faixas: { id: FaixaId; product_handle: string }[],
  regionId: string
): Promise<Partial<Record<FaixaId, OpcaoDePresente[]>>> {
  const saida: Partial<Record<FaixaId, OpcaoDePresente[]>> = {}
  await Promise.all(
    faixas.map(async (f) => {
      try {
        const { products } = await sdk.client.fetch<{ products: HttpTypes.StoreProduct[] }>(`/store/products`, {
          method: "GET",
          query: {
            handle: f.product_handle,
            region_id: regionId,
            fields: "id,handle,*variants,*variants.options,*variants.options.option,+variants.inventory_quantity",
          },
          next: { revalidate: 60 },
        })
        const variantes = products?.[0]?.variants ?? []
        saida[f.id] = variantes.map((v) => ({
          variant_id: v.id,
          rotulo: rotuloDaVariante(v.options as never) || v.title || "Única",
          disponivel: !v.manage_inventory || v.allow_backorder || (v.inventory_quantity ?? 0) > 0,
        }))
      } catch {
        saida[f.id] = []
      }
    })
  )
  return saida
}

async function revalidarCarrinho() {
  revalidateTag(await getCacheTag("carts"))
  revalidateTag(await getCacheTag("fulfillment"))
}

export async function escolherPresente(variantId: string): Promise<{ ok: true } | { ok: false; mensagem: string }> {
  const cartId = await getCartId()
  if (!cartId) return { ok: false, mensagem: "Sua sacola expirou. Atualize a página." }
  const headers = { ...(await getAuthHeaders()) }
  try {
    await sdk.client.fetch(`/store/carts/${cartId}/brinde`, { method: "POST", headers, body: { variant_id: variantId } })
    await revalidarCarrinho()
    return { ok: true }
  } catch (e) {
    const msg = (e as { message?: string })?.message
    return { ok: false, mensagem: msg || "Não foi possível escolher o presente agora." }
  }
}

export async function removerPresente(): Promise<void> {
  const cartId = await getCartId()
  if (!cartId) return
  const headers = { ...(await getAuthHeaders()) }
  await sdk.client.fetch(`/store/carts/${cartId}/brinde`, { method: "DELETE", headers }).catch(() => null)
  await revalidarCarrinho()
}

/**
 * Depois de mexer na sacola (quantidade, remover peça, cupom): se o presente deixou de valer, sai sozinho e fica
 * um aviso de 1 minuto para a tela mostrar. Nunca lança.
 */
export async function ajustarPresente(): Promise<void> {
  try {
    const e = await getEstadoBrinde()
    if (!e?.presente || e.valido) return
    const cartId = await getCartId()
    const headers = { ...(await getAuthHeaders()) }
    await sdk.client.fetch(`/store/carts/${cartId}/brinde`, { method: "DELETE", headers })
    ;(await cookies()).set(COOKIE_AVISO, e.motivo || "Seu presente saiu da sacola.", { maxAge: 60, path: "/" })
    await revalidarCarrinho()
  } catch (err) {
    console.error("[brinde] ajustar", err)
  }
}

export async function lerAvisoDoPresente(): Promise<string | null> {
  try {
    return (await cookies()).get(COOKIE_AVISO)?.value ?? null
  } catch {
    return null
  }
}

export type DadosDoPresente = {
  estado: EstadoBrinde | null
  opcoes: Partial<Record<FaixaId, OpcaoDePresente[]>>
  aviso: string | null
}

/** Tudo o que a sacola e o checkout precisam para mostrar o presente, numa chamada. */
export async function getPresenteDaSacola(cart: { id: string; region_id?: string | null } | null): Promise<DadosDoPresente> {
  if (!cart?.id) return { estado: null, opcoes: {}, aviso: null }
  const [estado, aviso] = await Promise.all([getEstadoBrinde(cart.id), lerAvisoDoPresente()])
  const opcoes = estado?.liberadas.length && cart.region_id ? await getOpcoesDePresente(estado.liberadas, cart.region_id) : {}
  return { estado, opcoes, aviso }
}
