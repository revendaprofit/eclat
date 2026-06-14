// Cliente Evolution API (envio de WhatsApp) — uso no servidor.
const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || "eclat"

// Envia texto e retorna o id da mensagem na Evolution (para idempotência).
export async function sendWhatsappText(
  number: string,
  text: string
): Promise<{ ok: boolean; evolutionMsgId?: string; error?: string }> {
  try {
    const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
      method: "POST",
      headers: { apikey: EVO_KEY as string, "Content-Type": "application/json" },
      body: JSON.stringify({ number, text }),
    })
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` }
    const data = await res.json()
    return { ok: true, evolutionMsgId: data?.key?.id }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}
