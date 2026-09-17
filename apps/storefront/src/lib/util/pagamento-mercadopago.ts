// Regras puras do pagamento Mercado Pago na vitrine (Parte 4, F2).
// Spec: docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md §5–§6.
//
// O provider do Medusa é um só (`pp_mercadopago_mercadopago`), mas a cliente escolhe entre DOIS
// meios — Pix e cartão. A escolha viaja na URL (`?step=review&metodo=pix`) porque nenhuma sessão
// de pagamento existe até ela gerar o Pix ou enviar o cartão: a Orders API cria E processa a
// cobrança na mesma chamada (contrato documentado no service.ts do backend).
import { HttpTypes } from "@medusajs/types"

export type MetodoMercadoPago = "pix" | "cartao"

export type OpcaoDePagamento = {
  /** Valor do rádio: o id do provider, ou `provider#metodo` para os meios do Mercado Pago. */
  valor: string
  providerId: string
  metodo?: MetodoMercadoPago
}

export type DadosDoPix = {
  qrCode: string
  qrCodeBase64: string
  ticketUrl?: string
  expiraEm: number
}

export const isMercadoPago = (providerId?: string | null) =>
  !!providerId?.startsWith("pp_mercadopago_")

export const ehMetodoMercadoPago = (v: unknown): v is MetodoMercadoPago =>
  v === "pix" || v === "cartao"

export const valorDaOpcao = (providerId: string, metodo?: MetodoMercadoPago) =>
  metodo ? `${providerId}#${metodo}` : providerId

export function lerOpcao(valor: string): { providerId: string; metodo?: MetodoMercadoPago } {
  const [providerId, metodo] = valor.split("#")
  return { providerId, metodo: ehMetodoMercadoPago(metodo) ? metodo : undefined }
}

/**
 * Desdobra os providers da região nas opções que a cliente vê. O cartão só aparece se a chave
 * pública do Mercado Pago estiver configurada (sem ela o Brick não tem como tokenizar).
 */
export function opcoesDePagamento(
  providers: { id: string }[],
  cartaoDisponivel: boolean
): OpcaoDePagamento[] {
  return providers.flatMap((p) => {
    if (!isMercadoPago(p.id)) return [{ valor: p.id, providerId: p.id }]
    const metodos: MetodoMercadoPago[] = cartaoDisponivel ? ["pix", "cartao"] : ["pix"]
    return metodos.map((metodo) => ({ valor: valorDaOpcao(p.id, metodo), providerId: p.id, metodo }))
  })
}

export const tituloDoMetodo = (metodo: MetodoMercadoPago) =>
  metodo === "pix" ? "Pix" : "Cartão de crédito"

/**
 * O Pix que pode ser mostrado: gerado para ESTE valor de carrinho e ainda dentro da validade.
 * Nunca existe Pix vivo na tela com valor diferente do carrinho (spec §6.6).
 */
export function pixVigente(
  cart: Pick<HttpTypes.StoreCart, "total" | "payment_collection">,
  agora: number = Date.now()
): DadosDoPix | null {
  for (const sessao of cart.payment_collection?.payment_sessions ?? []) {
    const d = (sessao.data ?? {}) as Record<string, unknown>
    if (!isMercadoPago(sessao.provider_id) || sessao.status !== "pending") continue
    if (d.metodo !== "pix" || typeof d.qr_code !== "string" || !d.qr_code) continue
    if (Number(d.valor_total).toFixed(2) !== Number(cart.total).toFixed(2)) continue
    const expiraEm = typeof d.expira_em === "string" ? Date.parse(d.expira_em) : NaN
    if (!Number.isFinite(expiraEm) || expiraEm <= agora) continue
    return {
      qrCode: d.qr_code,
      qrCodeBase64: typeof d.qr_code_base64 === "string" ? d.qr_code_base64 : "",
      ticketUrl: typeof d.ticket_url === "string" ? d.ticket_url : undefined,
      expiraEm,
    }
  }
  return null
}

/** mm:ss que faltam (nunca negativo). */
export function tempoRestante(expiraEm: number, agora: number = Date.now()): string {
  const s = Math.max(0, Math.floor((expiraEm - agora) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`
}

/** Como o pagamento aparece na confirmação do pedido, a partir de `payment.data`. */
export function descricaoDoPagamento(data: Record<string, unknown> | null | undefined): string | null {
  if (!data || !ehMetodoMercadoPago(data.metodo)) return null
  if (data.metodo === "pix") return "Pix"
  const parcelas = Number(data.parcelas)
  const final = typeof data.final_cartao === "string" && data.final_cartao ? ` final ${data.final_cartao}` : ""
  return `Cartão de crédito${final}${parcelas > 1 ? ` em ${parcelas}x` : ""}`
}
