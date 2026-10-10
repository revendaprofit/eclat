"use server"

import { sdk } from "@lib/config"
import type { Prazos, RegrasDeFrete, ServicoDeFrete } from "@lib/util/frete"
import { cepValido, normalizarCep, parseRespostaCep, urlProvedorCep } from "@lib/util/cep"
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

export type OpcaoDaPeca = { servico: ServicoDeFrete; centavos: number; prazo_min: number; prazo_max: number }
export type CotacaoDaPeca =
  | { ok: true; cep: string; lugar: string | null; uf: string | null; opcoes: OpcaoDaPeca[] }
  | { ok: false; erro: string }

/**
 * Frete e prazo de UMA peça pelo CEP, na página do produto (2026-10-10). Não mexe no carrinho. Cidade/UF
 * vêm do provedor de CEP (a vitrine usa o UF para a régua do frete grátis). Backend sem a rota (deploy
 * da vitrine antes do backend) → `opcoes: []`, e o componente avisa que vai calcular no checkout.
 */
export async function cotarFreteDaPeca(cepDigitado: string, variantId: string): Promise<CotacaoDaPeca> {
  const cep = normalizarCep(cepDigitado)
  if (!cepValido(cep)) return { ok: false, erro: "Digite um CEP com 8 números." }
  const [endereco, resposta] = await Promise.all([
    fetch(urlProvedorCep(cep), { cache: "no-store", signal: AbortSignal.timeout(4000) })
      .then((r) => r.json())
      .then(parseRespostaCep)
      .catch(() => null),
    sdk.client
      .fetch<{ opcoes: OpcaoDaPeca[] }>(`/store/frete/cotacao`, { method: "GET", query: { cep, variant_id: variantId }, cache: "no-store" })
      .then((r) => (Array.isArray(r?.opcoes) ? r.opcoes : []))
      .catch(() => [] as OpcaoDaPeca[]),
  ])
  return { ok: true, cep, lugar: endereco ? `${endereco.cidade} / ${endereco.uf}` : null, uf: endereco?.uf ?? null, opcoes: resposta }
}
