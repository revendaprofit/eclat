import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// IA em modo SUGESTÃO (Google Gemini): lê a conversa e redige a próxima resposta
// na voz da Éclat. O operador aprova/edita/envia — nada é enviado automaticamente.

const GEMINI_MODEL = "gemini-2.5-flash"

const VOZ_ECLAT = `Você é a atendente da use.ÉCLAT — marca premium e independente de moda fitness,
o "athleisure da mulher inteira". Você atende clientes pelo WhatsApp.

Voz da marca:
- Português do Brasil, calorosa, elegante e próxima — sem ser forçada nem exagerada.
- Mensagens curtas de WhatsApp (1 a 3 frases, no máximo 2 parágrafos curtos).
- Pode usar 1 emoji sutil quando fizer sentido (ex.: ✨), nunca vários.
- Acolhe e valoriza a cliente; incentiva sem pressionar.

Regras:
- Ajude com produtos, tamanhos (P/M/G/GG), tecido, cuidados, preços em R$, frete e dúvidas gerais.
- NUNCA invente preço, estoque, prazo ou política que você não tem certeza. Se não souber, diga que vai
  confirmar e retornar.
- Não prometa o que não pode garantir. Nunca diga que é uma IA.
- Responda SOMENTE com o texto da mensagem a enviar — sem aspas, sem "Sugestão:", sem comentários.`

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 })
  }

  // histórico recente da conversa
  const res = await sb(
    `message?conversation_id=eq.${id}&select=direcao,texto,timestamp&order=timestamp.asc&limit=40`
  )
  if (!res.ok) {
    return NextResponse.json({ error: await res.text() }, { status: 500 })
  }
  const msgs = (await res.json()) as Array<{ direcao: string; texto: string | null }>

  const transcricao = msgs
    .map((m) => `[${m.direcao === "in" ? "CLIENTE" : "ÉCLAT"}] ${m.texto ?? ""}`)
    .join("\n")

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
      {
        method: "POST",
        headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VOZ_ECLAT }] },
          contents: [
            {
              role: "user",
              parts: [
                {
                  text:
                    "Conversa até agora (CLIENTE = pessoa, ÉCLAT = você):\n\n" +
                    (transcricao || "(ainda sem mensagens)") +
                    "\n\nEscreva a próxima mensagem da ÉCLAT.",
                },
              ],
            },
          ],
          generationConfig: { maxOutputTokens: 2000, temperature: 0.7 },
        }),
      }
    )

    const data = await r.json()
    if (!r.ok) {
      return NextResponse.json(
        { error: `Gemini: ${data?.error?.message ?? r.status}` },
        { status: 502 }
      )
    }

    const suggestion = (
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? ""
    ).trim()

    return NextResponse.json({ suggestion })
  } catch (e) {
    return NextResponse.json(
      { error: `IA falhou: ${(e as Error).message}` },
      { status: 502 }
    )
  }
}
