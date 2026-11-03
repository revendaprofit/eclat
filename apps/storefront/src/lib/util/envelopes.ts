// Envelopes ÉCLAT (sócia, 03/11): a visitante ESCOLHE um de três benefícios da primeira compra e deixa o WhatsApp.
// É escolha, não sorteio: os três ficam à vista. Liga e desliga em site_content "boas_vindas" (modo "envelopes").
// A escolha vai para cart.metadata.envelope, que vira order.metadata.envelope, e o Cockpit mostra no pedido.

export type EnvelopeId = "voucher" | "consultoria" | "presente"

export type Envelope = { id: EnvelopeId; titulo: string; texto: string; nota: string }

export const ENVELOPES: Envelope[] = [
  { id: "voucher", titulo: "10% off", texto: "Voucher para a sua primeira compra", nota: "Voucher de 10%" },
  { id: "consultoria", titulo: "Consultoria", texto: "A gente te ajuda a escolher o melhor look", nota: "Consultoria de look" },
  { id: "presente", titulo: "Presente surpresa", texto: "Um mimo da nossa linha de brindes premium", nota: "Presente surpresa" },
]

export const COOKIE_ENVELOPE = "eclat_envelope"

export const TEXTO_ACEITE_ENVELOPE = "Ao continuar, aceito receber novidades e ofertas da ÉCLAT pelo WhatsApp. Posso sair quando quiser."

export const MENSAGEM_CONSULTORIA = "Oi! Escolhi a consultoria no site da ÉCLAT e quero ajuda para escolher o melhor look."

export function lerEnvelopeId(v: unknown): EnvelopeId | null {
  return ENVELOPES.some((e) => e.id === v) ? (v as EnvelopeId) : null
}

export type ConfigEnvelopes = { cupom: string; percentual: number }

/** Sem cupom válido não há envelopes: oferecer 10% sem código seria prometer o que não existe. */
export function lerConfigEnvelopes(v: unknown): ConfigEnvelopes | null {
  if (!v || typeof v !== "object") return null
  const o = v as Record<string, unknown>
  if (o.ativa !== true || o.modo !== "envelopes") return null
  const cupom = typeof o.cupom === "string" ? o.cupom.trim().toUpperCase() : ""
  const percentual = Number(o.percentual)
  if (!cupom || !Number.isFinite(percentual) || percentual <= 0 || percentual > 100) return null
  return { cupom, percentual }
}

/** Onde os envelopes não abrem: quem está pagando ou na conta não pode ser interrompido. `pathname` vem com o país. */
export function envelopesPermitidos(pathname: string): boolean {
  return !/^\/[a-z]{2}\/(cart|checkout|order|account)(\/|$)/.test(pathname)
}
