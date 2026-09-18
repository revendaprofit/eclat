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
//
// Proteção do número (API não oficial): duas mensagens com "digitando…" entre elas,
// a saudação sem link primeiro e o convite depois, e um teto de respostas por hora.
// Nunca usar este caminho para disparo a quem não escreveu primeiro.
export const CLUBE_SAUDACAO = [
  "Oi! Que bom ter você no Clube Éclat ✨",
  "",
  "A pré-venda da Coleção Lumière já está aberta em useeclat.com.br: você reserva a sua peça agora e os envios começam em 10/10. O pagamento é por Pix, combinado aqui no WhatsApp logo depois do pedido.",
  "",
  "São poucas peças nesse primeiro lote: quem reservar primeiro leva. No Clube você fica sabendo primeiro da reposição e das próximas cores.",
].join("\n")

// Cupom de primeira compra (criado em 17/09/2026: 10%, 1 uso por cliente, não vale para
// peças em conjunto — o conjunto já sai por R$ 299). Override por env se o código mudar.
export const CLUBE_CUPOM = process.env.CLUBE_ECLAT_CUPOM || "CLUBE10"

export const CLUBE_CONVITE = [
  `Aqui está a sua entrada no grupo: ${CLUBE_GRUPO_URL}`,
  "",
  `E o seu cupom de primeira compra: *${CLUBE_CUPOM}* — 10% na peça avulsa ou no macaquinho, uso único, é só digitar na sacola. O conjunto top + short já sai por R$ 299.`,
  "",
  "Te espero lá 💛",
].join("\n")

// Compatibilidade: texto completo (usado só para registro na conversa).
export const CLUBE_BOAS_VINDAS = `${CLUBE_SAUDACAO}\n\n${CLUBE_CONVITE}`

const DELAY_SAUDACAO_MS = 4000
const DELAY_CONVITE_MS = 6000
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

  await sendWhatsappText(opts.number, CLUBE_SAUDACAO, DELAY_SAUDACAO_MS)
  const sent = (await sendWhatsappText(opts.number, CLUBE_CONVITE, DELAY_CONVITE_MS)) as
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
