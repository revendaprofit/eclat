"use server"

// Ações de servidor do pagamento Mercado Pago (Parte 4, F2).
// Spec: docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md §5–§6.
//
// Tudo que identifica a compradora (CPF, e-mail, valor) é lido do CARRINHO no servidor — o
// navegador só manda o que só ele tem: o token de uso único do Brick, a bandeira e as parcelas.
import { sdk } from "@lib/config"
import { normalizarCpf } from "@lib/util/cpf"
import { dadosDoPagador } from "@lib/util/pagamento-dados"
import { isMercadoPago } from "@lib/util/pagamento-mercadopago"
import { HttpTypes } from "@medusajs/types"
import { revalidateTag } from "next/cache"
import { redirect } from "next/navigation"
import { initiatePaymentSession, retrieveCart } from "./cart"
import { getAuthHeaders, getCacheTag, removeCartId } from "./cookies"
import { listCartPaymentMethods } from "./payment"

const CAMPOS_DO_CARRINHO =
  "id,email,total,shipping_total,discount_total,metadata,region_id,*items,*billing_address,*shipping_address,*payment_collection.payment_sessions"

const ERRO_GENERICO =
  "Não conseguimos iniciar o pagamento agora. Tenta de novo em instantes ou escolhe outra forma de pagamento."

// Recusas de REGRA DE CUPOM vêm do backend com texto para a cliente (ex.: cupom de primeira compra já
// usado no CPF) — essas passam; qualquer outro erro continua genérico, sem vazar detalhe técnico.
function mensagemDoErro(e: unknown): string {
  const m = String((e as { message?: string })?.message ?? "")
  const i = m.toLowerCase().indexOf("o cupom ")
  return i >= 0 ? m.slice(i).replace(/\.*$/, "") + "." : ERRO_GENERICO
}

export type ResultadoDoCartao =
  | { resultado: "recusado"; mensagem: string }
  | { resultado: "pendente" }
  | { resultado: "erro"; mensagem: string }

type Contexto = { cart: HttpTypes.StoreCart; providerId: string; base: Record<string, unknown> }

/** Carrinho + provider + os dados do pagador que o provider exige (spec §5.3 / §6.1). */
async function contextoDoPagamento(): Promise<Contexto | null> {
  const cart = await retrieveCart(undefined, CAMPOS_DO_CARRINHO)
  if (!cart?.region_id) return null
  const providers = await listCartPaymentMethods(cart.region_id)
  const providerId = providers?.find((p) => isMercadoPago(p.id))?.id
  const cpf = normalizarCpf(String(cart.metadata?.cpf ?? ""))
  if (!providerId || !cpf || !cart.email) return null
  return {
    cart,
    providerId,
    base: {
      cpf,
      email: cart.email,
      nomeTitular: cart.billing_address?.first_name ?? cart.shipping_address?.first_name ?? undefined,
      // sobrenome, telefone, endereço e itens: o antifraude do Mercado Pago pontua cada campo
      ...dadosDoPagador(cart),
    },
  }
}

const sessaoDoMercadoPago = (colecao: HttpTypes.StorePaymentCollection | undefined) =>
  colecao?.payment_sessions?.find((s) => isMercadoPago(s.provider_id))

/**
 * Tenta transformar o carrinho em pedido. Com o pagamento ainda pendente o Medusa responde erro
 * `not_allowed` (coberto pelo teste de integração do backend) — aqui isso é só "ainda não".
 * Num carrinho que o webhook já concluiu, `complete` devolve o MESMO pedido: é assim que a tela
 * de Pix descobre o pedido de quem ficou com a página aberta.
 */
async function concluirSePago(cartId: string): Promise<void> {
  const headers = { ...(await getAuthHeaders()) }
  const res = await sdk.store.cart.complete(cartId, {}, headers).catch(() => null)
  if (res?.type !== "order") return

  revalidateTag(await getCacheTag("carts"))
  revalidateTag(await getCacheTag("orders"))
  await removeCartId()
  const pais = res.order.shipping_address?.country_code?.toLowerCase()
  redirect(`/${pais}/order/${res.order.id}/confirmed`)
}

/** Gera (ou regenera) o código Pix para o valor atual do carrinho. */
export async function gerarPix(deviceId?: string): Promise<{ erro?: string }> {
  const ctx = await contextoDoPagamento()
  if (!ctx) return { erro: ERRO_GENERICO }
  try {
    await initiatePaymentSession(ctx.cart, {
      provider_id: ctx.providerId,
      data: { ...ctx.base, metodo: "pix", ...(deviceId ? { device_id: deviceId } : {}) },
    })
    return {}
  } catch (e) {
    return { erro: mensagemDoErro(e) }
  }
}

/** Chamado pelo `onSubmit` do Card Payment Brick. Aprovado → redireciona para a confirmação. */
export async function pagarComCartao(dados: {
  token: string
  bandeira: string
  parcelas: number
  nomeTitular?: string
  finalCartao?: string
  /** Id do aparelho (`MP_DEVICE_SESSION_ID`), criado pelo SDK do Mercado Pago no navegador. */
  deviceId?: string
}): Promise<ResultadoDoCartao> {
  const ctx = await contextoDoPagamento()
  if (!ctx || !dados.token || !dados.bandeira) return { resultado: "erro", mensagem: ERRO_GENERICO }

  let sessao: HttpTypes.StorePaymentSession | undefined
  try {
    const resp = await initiatePaymentSession(ctx.cart, {
      provider_id: ctx.providerId,
      data: {
        ...ctx.base,
        metodo: "cartao",
        token: dados.token,
        bandeira: dados.bandeira,
        parcelas: dados.parcelas,
        ...(dados.nomeTitular ? { nomeTitular: dados.nomeTitular } : {}),
        ...(dados.finalCartao ? { final_cartao: dados.finalCartao } : {}),
        ...(dados.deviceId ? { device_id: dados.deviceId } : {}),
      },
    })
    sessao = sessaoDoMercadoPago(resp?.payment_collection)
  } catch (e) {
    return { resultado: "erro", mensagem: mensagemDoErro(e) }
  }

  if (!sessao) return { resultado: "erro", mensagem: ERRO_GENERICO }
  if (sessao.status === "error") {
    return { resultado: "recusado", mensagem: String(sessao.data?.mensagem_recusa ?? ERRO_GENERICO) }
  }

  await concluirSePago(ctx.cart.id) // aprovado: redireciona e não volta
  return { resultado: "pendente" } // em análise no Mercado Pago: a tela passa a consultar
}

/** Consulta periódica das telas de espera (Pix e cartão em análise). */
export async function conferirPagamento(): Promise<{ pago: false }> {
  const cart = await retrieveCart(undefined, "id")
  if (cart) await concluirSePago(cart.id)
  return { pago: false }
}
