"use server"

import { cepValido, normalizarCep, parseRespostaCep, urlProvedorCep } from "@lib/util/cep"
import { montarCotacao, type OpcaoCotada } from "@lib/util/cotacao-sacola"
import { retrieveCart, updateCart } from "./cart"
import { getPrazosDeFrete } from "./frete"
import { calculatePriceForShippingOption, listCartShippingMethods } from "./fulfillment"

export type ResultadoCotacao = { ok: true; cep: string; lugar: string | null; opcoes: OpcaoCotada[] } | { ok: false; erro: string }

/**
 * Cotação da sacola pelo CEP (diagnóstico 2026-09-25). Grava no carrinho só CEP, cidade e UF — o
 * checkout reaproveita o CEP e completa o resto. Se a cliente já tem endereço completo no carrinho
 * (voltou do checkout), o endereço dela é mantido e a cotação usa o CEP dele.
 */
export async function cotarFreteDaSacola(cepDigitado: string): Promise<ResultadoCotacao> {
  const cart = await retrieveCart(undefined, "id,shipping_address.*")
  if (!cart) return { ok: false, erro: "Sua sacola expirou. Recarregue a página." }

  const temEndereco = !!cart.shipping_address?.address_1
  const cep = temEndereco ? normalizarCep(cart.shipping_address?.postal_code ?? "") : normalizarCep(cepDigitado)
  if (!cepValido(cep)) return { ok: false, erro: "Digite um CEP com 8 números." }

  let lugar: string | null = temEndereco
    ? [cart.shipping_address?.city, cart.shipping_address?.province].filter(Boolean).join(" / ") || null
    : null

  if (!temEndereco) {
    const endereco = await fetch(urlProvedorCep(cep), { cache: "no-store", signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then(parseRespostaCep)
      .catch(() => null)
    if (endereco) lugar = `${endereco.cidade} / ${endereco.uf}`
    try {
      await updateCart({
        shipping_address: {
          postal_code: cep,
          country_code: "br",
          ...(endereco ? { city: endereco.cidade, province: endereco.uf } : {}),
        },
      })
    } catch {
      return { ok: false, erro: "Não foi possível calcular agora. Tente de novo em instantes." }
    }
  }

  const opcoes = (await listCartShippingMethods(cart.id)) ?? []
  const calculadas = await Promise.all(
    opcoes.filter((o) => o.price_type === "calculated").map((o) => calculatePriceForShippingOption(o.id, cart.id))
  )
  const precos: Record<string, number> = {}
  for (const c of calculadas) if (c?.id && typeof c.amount === "number") precos[c.id] = c.amount
  const prazos = await getPrazosDeFrete(cart.id)

  const cotacao = montarCotacao(opcoes, precos, prazos)
  if (!cotacao.length) return { ok: false, erro: "Não encontramos entrega para este CEP. Confira os números." }
  return { ok: true, cep, lugar, opcoes: cotacao }
}
