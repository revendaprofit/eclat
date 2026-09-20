// Id do aparelho de quem está comprando, exigido pelo antifraude do Mercado Pago
// (header `X-Meli-Session-Id`). O script de segurança deles cria a variável global
// `MP_DEVICE_SESSION_ID` no navegador; sem ela a cobrança chega marcada como `security:none`
// e cai muito mais em `cc_rejected_high_risk` (achado de 2026-09-19 em produção).

export const SCRIPT_SEGURANCA_MP = "https://www.mercadopago.com/v2/security.js"

/** `undefined` quando o script ainda não terminou de carregar — nunca trava o pagamento por isso. */
export function deviceIdDoMercadoPago(): string | undefined {
  if (typeof window === "undefined") return undefined
  const id = (window as Window & { MP_DEVICE_SESSION_ID?: unknown }).MP_DEVICE_SESSION_ID
  return typeof id === "string" && id.trim() ? id.trim() : undefined
}
