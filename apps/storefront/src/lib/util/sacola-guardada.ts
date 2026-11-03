// "Guardar a sacola" (sócia, 03/11): depois de pôr uma peça na sacola, um cartão pede só o WhatsApp. Os carrinhos
// paravam sem contato, e a recuperação automática (architecture/recuperacao.md) só alcança quem deixou contato.
// Parte pura, testável, e leve: é importada pelos botões de compra, então não pode puxar o cartão junto.

export const EVENTO_SACOLA = "eclat:sacola-adicionada"
export const CHAVE_SACOLA = "eclat_sacola_guardada"
export const DIAS_SEM_REPETIR = 7

export const TEXTO_ACEITE_SACOLA = "Ao guardar, aceito receber mensagens da ÉCLAT sobre minha sacola pelo WhatsApp. Posso sair quando quiser."

/** Chamar depois que a peça entrou na sacola. Quem decide se o cartão aparece é o próprio cartão. */
export function avisarSacolaAdicionada() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENTO_SACOLA))
}

/** `guardou` = já deixou o WhatsApp, nunca mais pede. Número = quando fechou: não repete por 7 dias. */
export type EstadoSacola = "guardou" | number | null

export function lerEstadoSacola(valor: string | null): EstadoSacola {
  if (valor === "guardou") return "guardou"
  const n = Number(valor)
  return valor && Number.isFinite(n) ? n : null
}

export function podeOferecer(estado: EstadoSacola, agora: number): boolean {
  if (estado === "guardou") return false
  if (estado === null) return true
  return agora - estado >= DIAS_SEM_REPETIR * 24 * 60 * 60 * 1000
}

/** A sacola é a única rota que oferece sem precisar de peça recém-adicionada. `pathname` vem com o país. */
export function ehPaginaDaSacola(pathname: string): boolean {
  return /^\/[a-z]{2}\/cart\/?$/.test(pathname)
}

/** Rotas em que o cartão nunca aparece: quem está pagando ou na conta não pode ser interrompido. */
export function rotaProibida(pathname: string): boolean {
  return /^\/[a-z]{2}\/(checkout|order|account)(\/|$)/.test(pathname)
}
