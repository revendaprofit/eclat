import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getOrCreateLeadByWhatsapp,
  insertConversa,
  supabaseConfigured,
} from "../../../lib/supabase"

// Webhook da Evolution API (inbound). Recebe eventos do WhatsApp da marca e grava
// lead + conversa no Supabase (camada de relacionamento).
// Segurança: a Evolution não envia header custom de forma confiável, então validamos
// um token na query string (?token=...) contra WHATSAPP_WEBHOOK_SECRET.
// Sempre responde 200 para a Evolution não ficar reenviando (erros vão pro log).

function extractText(message: Record<string, any> | undefined): string {
  if (!message) return "[sem conteúdo]"
  return (
    message.conversation ||
    message.extendedTextMessage?.text ||
    message.imageMessage?.caption ||
    message.videoMessage?.caption ||
    (message.audioMessage ? "[áudio]" : "") ||
    (message.imageMessage ? "[imagem]" : "") ||
    (message.documentMessage ? "[documento]" : "") ||
    "[mensagem não-texto]"
  )
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")

  // Validação do token
  const expected = process.env.WHATSAPP_WEBHOOK_SECRET
  if (expected && req.query.token !== expected) {
    return res.status(401).json({ error: "token inválido" })
  }

  try {
    const body = (req.body || {}) as Record<string, any>
    const event: string | undefined = body.event

    if (event === "messages.upsert") {
      const data = body.data
      const messages: Record<string, any>[] = Array.isArray(data?.messages)
        ? data.messages
        : data
        ? [data]
        : []

      if (!supabaseConfigured()) {
        logger.warn("[whatsapp] Supabase não configurado; pulando gravação.")
      } else {
        for (const m of messages) {
          const key = m.key || {}
          const remoteJid: string = key.remoteJid || ""

          // Ignora grupos e status
          if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") {
            continue
          }

          const number = remoteJid.replace(/@.*/, "")
          if (!number) continue

          const fromMe = Boolean(key.fromMe)
          const direcao = fromMe ? "saida" : "entrada"
          const pushName = m.pushName || "Contato WhatsApp"
          const conteudo = extractText(m.message)

          const leadId = await getOrCreateLeadByWhatsapp(number, {
            nome: pushName,
            origem: "whatsapp",
            status: "novo",
          })

          await insertConversa({
            lead_id: leadId,
            canal: "whatsapp",
            direcao,
            conteudo,
            external_id: key.id,
          })
        }
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error(`[whatsapp] erro no webhook: ${(err as Error).message}`)
    // 200 mesmo assim para evitar reenvio em loop pela Evolution
    return res.status(200).json({ received: true, error: true })
  }
}

// Healthcheck simples (GET) — útil para validar a rota e o túnel.
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({ ok: true, hook: "whatsapp" })
}
