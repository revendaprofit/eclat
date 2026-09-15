// Cliente da Evolution API (WhatsApp). Envio de mensagens (outbound).

const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || "eclat"

export function evolutionConfigured(): boolean {
  return Boolean(EVO_URL && EVO_KEY)
}

// Envia uma mensagem de texto via WhatsApp.
// `number` deve ser o telefone com DDI (ex.: 5531999999999), sem +, sem @s.whatsapp.net.
// `delayMs`: a Evolution mostra "digitando…" e espera esse tempo antes de enviar —
// ritmo humano, que é o que protege o número em automações de resposta.
export async function sendWhatsappText(number: string, text: string, delayMs = 0) {
  const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: {
      apikey: EVO_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text, ...(delayMs > 0 ? { delay: delayMs } : {}) }),
  })
  if (!res.ok) {
    throw new Error(`Evolution sendText falhou: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

// Envia imagem por URL com legenda (grupo ou contato). `number` aceita JID de grupo (…@g.us).
export async function sendWhatsappMedia(number: string, mediaUrl: string, caption: string, delayMs = 0) {
  const res = await fetch(`${EVO_URL}/message/sendMedia/${INSTANCE}`, {
    method: "POST",
    headers: { apikey: EVO_KEY as string, "Content-Type": "application/json" },
    body: JSON.stringify({
      number,
      mediatype: "image",
      mimetype: "image/jpeg",
      media: mediaUrl,
      caption,
      fileName: "eclat.jpg",
      ...(delayMs > 0 ? { delay: delayMs } : {}),
    }),
  })
  if (!res.ok) {
    throw new Error(`Evolution sendMedia falhou: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

// Estado da sessão ("open" = conectada). Nunca lança.
export async function connectionState(): Promise<string> {
  try {
    const res = await fetch(`${EVO_URL}/instance/connectionState/${INSTANCE}`, { headers: { apikey: EVO_KEY as string } })
    const d = (await res.json()) as { instance?: { state?: string } }
    return d?.instance?.state ?? "unknown"
  } catch {
    return "unknown"
  }
}

// Baixa (decripta) a mídia de uma mensagem recebida. Recebe o objeto completo da
// mensagem (como veio no webhook). Retorna base64 + mimetype.
export async function getMediaBase64(
  message: Record<string, unknown>
): Promise<{ base64: string; mimetype?: string } | null> {
  const res = await fetch(`${EVO_URL}/chat/getBase64FromMediaMessage/${INSTANCE}`, {
    method: "POST",
    headers: { apikey: EVO_KEY as string, "Content-Type": "application/json" },
    body: JSON.stringify({ message, convertToMp4: false }),
  })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.base64) return null
  return { base64: data.base64, mimetype: data.mimetype }
}
