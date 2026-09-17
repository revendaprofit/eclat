// Validação da assinatura do webhook (`x-signature`), confirmada empiricamente na F0 contra a
// doc oficial do Mercado Pago (Checkout API via Orders, `checkout-api-orders/notifications`):
//
//   manifesto = `id:{data.id, em MINÚSCULAS};request-id:{x-request-id};ts:{ts};`
//   assinatura esperada = HMAC-SHA256(manifesto, segredo) em hexadecimal
//
// A mesma fórmula vale para a API de Payments e para a de Orders — só muda o formato do `id`
// (numérico lá, alfanumérico tipo `ORD01M28...` aqui, por isso o lowercase é obrigatório).
import { createHmac, timingSafeEqual } from "node:crypto"

export type EntradaAssinatura = {
  /** Header `x-signature` completo, formato `ts=...,v1=...`. */
  xSignature: string | undefined
  /** Header `x-request-id`. */
  xRequestId: string | undefined
  /** `data.id` do corpo da notificação (o id da order, ex. `ORDTST01...`). */
  dataId: string | undefined
  /** Segredo da aplicação (`MERCADOPAGO_WEBHOOK_SECRET`), revelado em Webhooks → Configurar notificações. */
  segredo: string | undefined
}

/** Extrai `{ts, v1}` do header `x-signature`. Devolve `null` se o formato não bater. */
function extrairPartes(xSignature: string): { ts: string; v1: string } | null {
  const partes = Object.fromEntries(
    xSignature
      .split(",")
      .map((p) => p.trim().split("=").map((s) => s.trim()))
      .filter((par): par is [string, string] => par.length === 2)
  )
  if (!partes.ts || !partes.v1) return null
  return { ts: partes.ts, v1: partes.v1 }
}

/**
 * Valida a assinatura de um webhook do Mercado Pago. Comparação em tempo constante — nunca usa
 * `===`/`includes` numa chave secreta ou derivado dela.
 */
export function assinaturaValida({ xSignature, xRequestId, dataId, segredo }: EntradaAssinatura): boolean {
  if (!xSignature || !segredo || !dataId) return false
  const partes = extrairPartes(xSignature)
  if (!partes) return false

  const manifesto = `id:${dataId.toLowerCase()};request-id:${xRequestId ?? ""};ts:${partes.ts};`
  const esperado = createHmac("sha256", segredo).update(manifesto).digest("hex")

  const a = Buffer.from(esperado, "hex")
  const b = Buffer.from(partes.v1, "hex")
  return a.length === b.length && timingSafeEqual(a, b)
}
