// Clube Éclat — resposta automática no WhatsApp.
// Quem manda "Quero entrar no Clube Éclat" (botão do site, anúncio click-to-WhatsApp ou texto
// parecido) recebe uma apresentação curta e vira lead marcado; a conversa segue com a Camila.
// Regras: só mensagens recebidas (nunca as nossas), uma vez por contato, nunca quebra o webhook.

import { getLeadByWhatsapp, insertMessageIdempotent, updateLead } from "./supabase"
import { evolutionConfigured, sendWhatsappText } from "./evolution"

export const CLUBE_INTERESSE = "Clube Éclat"
export const CLUBE_GRUPO_URL =
  process.env.CLUBE_ECLAT_GRUPO_URL ||
  "https://chat.whatsapp.com/I1KuK9EwkyqGrqsYGSkpyO"

const GATILHO = /clube|primeira m[ãa]o|quero entrar|lan[çc]amento|vip|em breve|lista/i

// Sócia, 26/10/2026: a resposta automática é SÓ apresentação e agradecimento, uma mensagem, sem link do grupo
// e sem cupom. Quem escreveu perguntou uma coisa; a Camila dá continuidade pessoalmente. (Até 26/10 saíam duas
// mensagens com coleção, link do grupo e cupom CLUBE10 — a pessoa "recebeu uma caralhada de informação".)
// Proteção do número (API não oficial): "digitando…" antes, teto de respostas por hora, uma vez por contato.
// Nunca usar este caminho para disparo a quem não escreveu primeiro.
export const CLUBE_APRESENTACAO = [
  "Oi! Aqui é a Camila, da ÉCLAT 💛",
  "",
  "Obrigada por falar com a gente. Já vi a sua mensagem e te respondo pessoalmente em instantes.",
].join("\n")

// Cupom de primeira compra (CLUBE10): continua existindo no Medusa e fixado no grupo, mas NÃO sai mais na
// resposta automática. Mantido aqui porque outras partes leem o código.
export const CLUBE_CUPOM = process.env.CLUBE_ECLAT_CUPOM || "CLUBE10"

// Texto registrado na conversa do Cockpit (igual ao enviado).
export const CLUBE_BOAS_VINDAS = CLUBE_APRESENTACAO

const DELAY_APRESENTACAO_MS = 4000
const TETO_POR_HORA = Number(process.env.CLUBE_MAX_RESPOSTAS_HORA || 40)
const janela: number[] = [] // timestamps das respostas na última hora (processo único no Railway)

function dentroDoTeto(): boolean {
  const agora = Date.now()
  while (janela.length && agora - janela[0] > 3_600_000) janela.shift()
  if (janela.length >= TETO_POR_HORA) return false
  janela.push(agora)
  return true
}

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
  if (!dentroDoTeto()) {
    opts.log(`[clube] teto de ${TETO_POR_HORA}/h atingido — ${opts.number} fica para atendimento humano`)
    return false
  }

  const sent = (await sendWhatsappText(opts.number, CLUBE_APRESENTACAO, DELAY_APRESENTACAO_MS)) as
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
