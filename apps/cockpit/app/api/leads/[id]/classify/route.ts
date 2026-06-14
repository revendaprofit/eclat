import { NextResponse } from "next/server"
import { sb } from "@/lib/sb-admin"

// IA (Gemini) sugere o estágio do funil a partir da conversa do lead.
// Modo SUGESTÃO: NÃO move o lead — apenas devolve {estagio, motivo} para o
// operador confirmar.

const GEMINI_MODEL = "gemini-2.5-flash"
const ESTAGIOS = ["novo", "contatado", "negociando", "convertido", "perdido"]

const INSTRUCAO = `Você classifica em que estágio do funil de vendas da use.ÉCLAT a conversa de WhatsApp está.
Estágios possíveis:
- novo: lead recém-chegado, sem troca real de mensagens ainda.
- contatado: já houve conversa inicial, mas sem intenção clara de compra.
- negociando: a pessoa demonstrou interesse de compra (perguntou preço, tamanho, cor, forma de pagamento, frete, disponibilidade).
- convertido: comprou ou confirmou que vai comprar/fechar o pedido.
- perdido: desistiu, não tem interesse, ou sumiu/encerrou sem avançar.
Considere o conteúdo e a direção das mensagens (CLIENTE x ÉCLAT). Responda apenas no formato pedido.`

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const key = process.env.GEMINI_API_KEY
  if (!key) return NextResponse.json({ error: "GEMINI_API_KEY não configurada" }, { status: 500 })

  // conversa do lead
  const cr = await sb(`conversation?lead_id=eq.${id}&select=id&limit=1`)
  const convs = (await cr.json()) as Array<{ id: string }>
  const convId = convs?.[0]?.id
  if (!convId) {
    return NextResponse.json({ error: "Este lead ainda não tem conversa para analisar." }, { status: 400 })
  }

  const mr = await sb(
    `message?conversation_id=eq.${convId}&select=direcao,texto&order=timestamp.asc&limit=60`
  )
  const msgs = (await mr.json()) as Array<{ direcao: string; texto: string | null }>
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
          systemInstruction: { parts: [{ text: INSTRUCAO }] },
          contents: [
            {
              role: "user",
              parts: [{ text: "Conversa:\n\n" + (transcricao || "(sem mensagens)") }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 500,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                estagio: { type: "STRING", enum: ESTAGIOS },
                motivo: { type: "STRING" },
              },
              required: ["estagio", "motivo"],
            },
          },
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

    const raw =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text ?? "")
        .join("") ?? "{}"
    const parsed = JSON.parse(raw) as { estagio?: string; motivo?: string }
    const estagio = ESTAGIOS.includes(parsed.estagio ?? "") ? parsed.estagio : null
    if (!estagio) {
      return NextResponse.json({ error: "IA não retornou um estágio válido." }, { status: 502 })
    }

    return NextResponse.json({ estagio, motivo: parsed.motivo ?? "" })
  } catch (e) {
    return NextResponse.json({ error: `IA falhou: ${(e as Error).message}` }, { status: 502 })
  }
}
