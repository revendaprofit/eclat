// Cliente da Evolution API (WhatsApp). Envio de mensagens (outbound).

const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || "eclat"

export function evolutionConfigured(): boolean {
  return Boolean(EVO_URL && EVO_KEY)
}

// Envia uma mensagem de texto via WhatsApp.
// `number` deve ser o telefone com DDI (ex.: 5531999999999), sem +, sem @s.whatsapp.net.
export async function sendWhatsappText(number: string, text: string) {
  const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: {
      apikey: EVO_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text }),
  })
  if (!res.ok) {
    throw new Error(`Evolution sendText falhou: ${res.status} ${await res.text()}`)
  }
  return res.json()
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
