// Cliente da Evolution API (WhatsApp). Envio de mensagens (outbound).

const EVO_URL = process.env.EVOLUTION_API_URL
const EVO_KEY = process.env.EVOLUTION_API_KEY
const INSTANCE = process.env.EVOLUTION_INSTANCE || "eclat"

export function evolutionConfigured(): boolean {
  return Boolean(EVO_URL && EVO_KEY)
}

// Erro HTTP da Evolution com o status exposto. A mensagem é a MESMA de antes (quem já tratava
// `Error` segue igual); o `status` existe para quem precisa separar recusa permanente (4xx: número
// fora do WhatsApp, por exemplo) de falha passageira (5xx). Atenção: `message` carrega o corpo da
// resposta, que pode ecoar o número da cliente — quem loga dado pessoal deve logar só o `status`.
export class EvolutionHttpError extends Error {
  // Corpo cru da resposta, em campo PRIVADO de verdade (#): não aparece em JSON.stringify, em
  // inspeção de log nem em spread do erro. Só serve para o getter abaixo; nunca deve ser logado —
  // ele ecoa o número da cliente.
  readonly #corpo: string

  constructor(message: string, readonly status: number, corpo = "") {
    super(message)
    this.name = "EvolutionHttpError"
    this.#corpo = corpo
  }

  // True SÓ quando a Evolution recusou porque aquele número não tem WhatsApp: HTTP 400 com
  // `exists: false` no corpo (forma real: { response: { message: [{ exists: false, jid, number }] } }).
  // É a única recusa PERMANENTE e específica de uma cliente. Qualquer outro 4xx — chave errada
  // (401/403), instância ausente (404), limite (429), instância desconectada ou payload ruim (400
  // sem `exists: false`) — atinge todas as clientes e deve ser tratado como falha.
  get numeroInexistente(): boolean {
    if (this.status !== 400) return false
    try {
      const d = JSON.parse(this.#corpo) as { response?: { message?: unknown }; message?: unknown }
      const itens = Array.isArray(d?.response?.message) ? d.response.message : Array.isArray(d?.message) ? d.message : []
      return itens.some((i) => i && typeof i === "object" && (i as { exists?: unknown }).exists === false)
    } catch {
      return false
    }
  }
}

// Envia uma mensagem de texto via WhatsApp.
// `number` deve ser o telefone com DDI (ex.: 5531999999999), sem +, sem @s.whatsapp.net.
// `delayMs`: a Evolution mostra "digitando…" e espera esse tempo antes de enviar —
// ritmo humano, que é o que protege o número em automações de resposta.
// `opcoes.timeoutMs` (opcional): aborta a chamada depois desse tempo. Sem ele, nada muda para quem
// já chamava (sem timeout, como sempre foi).
export async function sendWhatsappText(number: string, text: string, delayMs = 0, opcoes: { timeoutMs?: number } = {}) {
  const res = await fetch(`${EVO_URL}/message/sendText/${INSTANCE}`, {
    method: "POST",
    headers: {
      apikey: EVO_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ number, text, ...(delayMs > 0 ? { delay: delayMs } : {}) }),
    ...(opcoes.timeoutMs ? { signal: AbortSignal.timeout(opcoes.timeoutMs) } : {}),
  })
  if (!res.ok) {
    const corpo = await res.text()
    throw new EvolutionHttpError(`Evolution sendText falhou: ${res.status} ${corpo}`, res.status, corpo)
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
