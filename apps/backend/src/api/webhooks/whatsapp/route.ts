import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import {
  getOrCreateConversation,
  getOrCreateLeadByWhatsapp,
  insertMessageIdempotent,
  setMessageMedia,
  supabaseConfigured,
  uploadToStorage,
} from "../../../lib/supabase"
import { getMediaBase64 } from "../../../lib/evolution"

const MEDIA_TIPOS = new Set(["audio", "imagem", "video", "doc"])

function extFromMime(mime?: string | null): string {
  if (!mime) return "bin"
  const m = mime.split(";")[0].trim()
  const map: Record<string, string> = {
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "video/mp4": "mp4",
    "application/pdf": "pdf",
  }
  return map[m] || m.split("/")[1] || "bin"
}

// Webhook da Evolution API (inbound). Recebe eventos do WhatsApp e grava em
// conversation + message no Supabase (Cockpit Fase 1A). Idempotente por evolution_msg_id.
// Segurança: valida ?token= contra WHATSAPP_WEBHOOK_SECRET. Sempre responde 200.

type MsgInfo = { tipo: string; texto: string; media_mime: string | null }

function parseMessage(message: Record<string, any> | undefined): MsgInfo {
  if (!message) return { tipo: "texto", texto: "[sem conteúdo]", media_mime: null }
  if (message.conversation)
    return { tipo: "texto", texto: message.conversation, media_mime: null }
  if (message.extendedTextMessage?.text)
    return { tipo: "texto", texto: message.extendedTextMessage.text, media_mime: null }
  if (message.imageMessage)
    return {
      tipo: "imagem",
      texto: message.imageMessage.caption || "[imagem]",
      media_mime: message.imageMessage.mimetype || null,
    }
  if (message.videoMessage)
    return {
      tipo: "video",
      texto: message.videoMessage.caption || "[vídeo]",
      media_mime: message.videoMessage.mimetype || null,
    }
  if (message.audioMessage)
    return { tipo: "audio", texto: "[áudio]", media_mime: message.audioMessage.mimetype || null }
  if (message.documentMessage)
    return {
      tipo: "doc",
      texto: message.documentMessage.fileName || message.documentMessage.caption || "[documento]",
      media_mime: message.documentMessage.mimetype || null,
    }
  return { tipo: "texto", texto: "[mensagem não-texto]", media_mime: null }
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve("logger")

  const expected = process.env.WHATSAPP_WEBHOOK_SECRET
  if (expected && req.query.token !== expected) {
    return res.status(401).json({ error: "token inválido" })
  }

  try {
    const body = (req.body || {}) as Record<string, any>
    if (body.event !== "messages.upsert" || !supabaseConfigured()) {
      return res.status(200).json({ received: true })
    }

    const instancia = body.instance || process.env.EVOLUTION_INSTANCE || "eclat"
    const data = body.data
    const messages: Record<string, any>[] = Array.isArray(data?.messages)
      ? data.messages
      : data
      ? [data]
      : []

    for (const m of messages) {
      const key = m.key || {}
      const remoteJid: string = key.remoteJid || ""
      if (remoteJid.endsWith("@g.us") || remoteJid === "status@broadcast") continue

      const number = remoteJid.replace(/@.*/, "")
      if (!number) continue

      const fromMe = Boolean(key.fromMe)
      const pushName = m.pushName || "Contato WhatsApp"
      const { tipo, texto, media_mime } = parseMessage(m.message)
      const ts = m.messageTimestamp
        ? new Date(Number(m.messageTimestamp) * 1000).toISOString()
        : new Date().toISOString()

      // Garante lead para o contato e vincula à conversa
      const leadId = await getOrCreateLeadByWhatsapp(number, {
        nome: pushName,
        origem: "whatsapp",
        status: "novo",
      })

      const conversationId = await getOrCreateConversation(number, instancia, {
        nome_contato: pushName,
        lead_id: leadId,
        alvo_tipo: "lead",
      })

      await insertMessageIdempotent({
        conversation_id: conversationId,
        direcao: fromMe ? "out" : "in",
        tipo,
        texto,
        media_mime,
        status: m.status || null,
        origem: "humano",
        timestamp: ts,
        evolution_msg_id: key.id,
      })

      // Mídia: baixa da Evolution, guarda no Storage e atualiza a mensagem (best-effort).
      if (MEDIA_TIPOS.has(tipo) && key.id) {
        try {
          const media = await getMediaBase64(m)
          if (media?.base64) {
            const mime = media.mimetype || media_mime || "application/octet-stream"
            const path = `${conversationId}/${key.id}.${extFromMime(mime)}`
            await uploadToStorage("whatsapp", path, Buffer.from(media.base64, "base64"), mime)
            await setMessageMedia(key.id, path, mime)
          }
        } catch (e) {
          logger.warn(`[whatsapp] mídia não baixada (${key.id}): ${(e as Error).message}`)
        }
      }
    }

    return res.status(200).json({ received: true })
  } catch (err) {
    logger.error(`[whatsapp] erro no webhook: ${(err as Error).message}`)
    return res.status(200).json({ received: true, error: true })
  }
}

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.status(200).json({ ok: true, hook: "whatsapp" })
}
