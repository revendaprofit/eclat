// Clube Éclat — resposta automática no WhatsApp (pré-lançamento).
// Quem manda "Quero entrar no Clube Éclat" (botão da página Em breve, anúncio
// click-to-WhatsApp ou texto parecido) recebe o link do grupo e vira lead marcado.
// Regras: só mensagens recebidas (nunca as nossas), uma vez por contato, nunca quebra o webhook.

import { getLeadByWhatsapp, insertMessageIdempotent, updateLead } from "./supabase"
import { evolutionConfigured, sendWhatsappText } from "./evolution"

export const CLUBE_INTERESSE = "Clube Éclat"
export const CLUBE_GRUPO_URL =
  process.env.CLUBE_ECLAT_GRUPO_URL ||
  "https://chat.whatsapp.com/I1KuK9EwkyqGrqsYGSkpyO"

const GATILHO = /clube|primeira m[ãa]o|quero entrar|lan[çc]amento|vip|em breve|lista/i

// Texto da pré-venda (15/09/2026): loja aberta em pré-venda, envios a partir de 10/10,
// pagamento por Pix combinado no WhatsApp. Ajustar quando a pré-venda acabar.
export const CLUBE_BOAS_VINDAS = [
  "Oi! Que bom ter você no Clube Éclat ✨",
  "",
  `Aqui está a sua entrada: ${CLUBE_GRUPO_URL}`,
  "",
  "A pré-venda da Coleção Lumière já está aberta em useeclat.com.br: você reserva a sua peça agora e os envios começam em 10/10. O pagamento é por Pix, combinado aqui no WhatsApp logo depois do pedido.",
  "",
  "São poucas peças nesse primeiro lote: quem reservar primeiro leva. No Clube você fica sabendo primeiro da reposição e das próximas cores.",
  "",
  "Te espero lá 💛",
].join("\n")

// Detecta se a mensagem veio de anúncio click-to-WhatsApp (a Meta anexa
// externalAdReply / entryPointConversionSource no contextInfo).
export function veioDeAnuncio(mensagem: Record<string, unknown>): boolean {
  try {
    const s = JSON.stringify(mensagem)
    return s.includes("externalAdReply") || s.includes("entryPointConversionSource")
  } catch {
    return false
  }
}

export function ehGatilhoDoClube(texto: string, mensagem: Record<string, unknown>): boolean {
  return GATILHO.test(texto || "") || veioDeAnuncio(mensagem)
}

// Envia as boas-vindas (uma vez por contato), registra a saída na conversa e marca o lead.
export async function responderClube(opts: {
  number: string
  conversationId: string
  mensagem: Record<string, unknown>
  log: (msg: string) => void
}): Promise<boolean> {
  if (!evolutionConfigured()) return false
  const lead = await getLeadByWhatsapp(opts.number)
  if (lead?.interesse && lead.interesse.includes(CLUBE_INTERESSE)) return false

  const sent = (await sendWhatsappText(opts.number, CLUBE_BOAS_VINDAS)) as
    | { key?: { id?: string } }
    | undefined
  const msgId = sent?.key?.id || `clube_${opts.number}_${Date.now()}`

  await insertMessageIdempotent({
    conversation_id: opts.conversationId,
    direcao: "out",
    tipo: "texto",
    texto: CLUBE_BOAS_VINDAS,
    media_mime: null,
    status: null,
    origem: "ia",
    timestamp: new Date().toISOString(),
    evolution_msg_id: msgId,
  })

  if (lead) {
    const fields: Record<string, unknown> = { interesse: CLUBE_INTERESSE }
    if (veioDeAnuncio(opts.mensagem) && lead.origem === "whatsapp") fields.origem = "anuncio"
    await updateLead(lead.id, fields)
  }
  opts.log(`[clube] boas-vindas enviadas para ${opts.number}`)
  return true
}
