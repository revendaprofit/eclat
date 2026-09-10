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

export const CLUBE_BOAS_VINDAS = [
  "Oi! Que bom ter você no Clube Éclat ✨",
  "",
  `Aqui está a sua entrada: ${CLUBE_GRUPO_URL}`,
  "",
  "Lá dentro você vê as peças antes de todo mundo e recebe o link do lote de estreia 24 horas antes da loja abrir.",
  "",
  "São poucas peças nesse primeiro lote: quem chegar primeiro leva. Quem ficar sem entra na frente na reposição.",
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
