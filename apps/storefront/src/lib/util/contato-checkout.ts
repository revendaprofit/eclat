// Contato da cliente no checkout (diagnóstico de 2026-09-25). Parte pura, testável.
//
// Achado: a primeira tela do checkout pedia endereço, CPF e, só no fim, o e-mail. Nada era salvo
// antes de "Continuar", então quem desistia no meio virava "Só sacola" no Cockpit, sem contato.
// Agora o PRIMEIRO passo é só WhatsApp + e-mail, gravados no carrinho na hora.
//
// O mesmo contato vem do aviso de boas-vindas (cookie `eclat_contato`): assim o carrinho de quem
// deixou o WhatsApp no aviso já nasce com o contato, e a recuperação 1 a 1 do Cockpit alcança ela.

export const COOKIE_CONTATO = "eclat_contato"

/** Só dígitos, sem o 55 do país: "(31) 99999-0000" → "31999990000". */
export function normalizarWhatsapp(v: string): string {
  const d = (v || "").replace(/\D/g, "")
  return /^55\d{10,11}$/.test(d) ? d.slice(2) : d
}

/** Celular brasileiro: DDD válido (11–99) + 9 + 8 dígitos. */
export function whatsappValido(v: string): boolean {
  return /^[1-9][1-9]9\d{8}$/.test(normalizarWhatsapp(v))
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v || "").trim())
}

export type Contato = { whatsapp: string; email: string }

export function validarContato(entrada: { whatsapp?: string; email?: string }): { contato: Contato } | { erro: string } {
  const whatsapp = normalizarWhatsapp(entrada.whatsapp ?? "")
  const email = (entrada.email ?? "").trim().toLowerCase()
  if (!whatsappValido(whatsapp)) return { erro: "Confira o WhatsApp: DDD + número de celular, 11 dígitos." }
  if (!emailValido(email)) return { erro: "Confira o e-mail." }
  return { contato: { whatsapp, email } }
}

/** Cookie do contato guardado (aviso de boas-vindas ou checkout). Campos vazios ficam de fora. */
export function serializarContato(c: Partial<Contato>): string {
  const o: Record<string, string> = {}
  const w = normalizarWhatsapp(c.whatsapp ?? "")
  const e = (c.email ?? "").trim().toLowerCase()
  if (whatsappValido(w)) o.w = w
  if (emailValido(e)) o.e = e
  return JSON.stringify(o)
}

export function lerContatoDoCookie(valor: string | undefined | null): Partial<Contato> {
  if (!valor) return {}
  try {
    const o = JSON.parse(valor) as Record<string, unknown>
    const r: Partial<Contato> = {}
    if (typeof o.w === "string" && whatsappValido(o.w)) r.whatsapp = normalizarWhatsapp(o.w)
    if (typeof o.e === "string" && emailValido(o.e)) r.email = o.e.trim().toLowerCase()
    return r
  } catch {
    return {}
  }
}

/**
 * O que gravar num carrinho a partir do contato guardado, sem apagar o que já existe:
 * e-mail só entra se o carrinho não tem; WhatsApp só entra se o metadata não tem.
 * Devolve null quando não há nada a mudar (evita uma escrita à toa).
 */
export function contatoParaCarrinho(
  cart: { email?: string | null; metadata?: Record<string, unknown> | null },
  contato: Partial<Contato>
): { email?: string; metadata?: Record<string, unknown> } | null {
  const mudanca: { email?: string; metadata?: Record<string, unknown> } = {}
  if (!cart.email && contato.email) mudanca.email = contato.email
  if (!cart.metadata?.whatsapp && contato.whatsapp) mudanca.metadata = { ...(cart.metadata ?? {}), whatsapp: contato.whatsapp }
  return Object.keys(mudanca).length ? mudanca : null
}

export type EtapaCheckout = "contato" | "address" | "delivery" | "payment"

/** Para onde o botão "Finalizar compra" leva, conforme o que o carrinho já tem. */
export function etapaDoCheckout(cart: {
  email?: string | null
  shipping_address?: { address_1?: string | null } | null
  shipping_methods?: unknown[] | null
}): EtapaCheckout {
  if (!cart?.email) return "contato"
  if (!cart.shipping_address?.address_1) return "address"
  if (!cart.shipping_methods?.length) return "delivery"
  return "payment"
}
