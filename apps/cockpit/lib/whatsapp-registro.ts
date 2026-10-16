import { sendWhatsappText } from "@/lib/evolution"
import { sb } from "@/lib/sb-admin"

// Envia pelo WhatsApp da marca E registra na conversa do Cockpit (conversation + message), para a equipe ver o
// histórico e a resposta cair no lugar certo. Mesmo que a gravação falhe, o envio conta.
export async function enviarERegistrar(opts: {
  numero: string // só dígitos, com 55
  texto: string
  nome?: string | null
  medusa_customer_id?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  const r = await sendWhatsappText(opts.numero, opts.texto)
  if (!r.ok) return { ok: false, error: r.error }
  try {
    const inst = process.env.EVOLUTION_INSTANCE || "eclat"
    const cr = await sb(`conversation?select=id&contato_e164=eq.${opts.numero}&instancia_evolution=eq.${inst}&limit=1`)
    let cid = cr.ok ? ((await cr.json()) as { id: string }[])[0]?.id : undefined
    if (!cid) {
      const nc = await sb("conversation", {
        method: "POST",
        headers: { Prefer: "return=representation" },
        body: JSON.stringify({
          contato_e164: opts.numero,
          instancia_evolution: inst,
          nome_contato: opts.nome || "Cliente",
          alvo_tipo: "cliente",
          medusa_customer_id: opts.medusa_customer_id ?? null,
          status: "aberta",
        }),
      })
      if (nc.ok) cid = ((await nc.json()) as { id: string }[])[0]?.id
    }
    if (cid) {
      const agora = new Date().toISOString()
      await sb("message?on_conflict=evolution_msg_id", {
        method: "POST",
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
        body: JSON.stringify({
          conversation_id: cid,
          direcao: "out",
          tipo: "texto",
          texto: opts.texto,
          origem: "humano",
          status: "sent",
          timestamp: agora,
          evolution_msg_id: r.evolutionMsgId ?? `local-${Date.now()}`,
        }),
      })
      await sb(`conversation?id=eq.${cid}`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ultima_msg_em: agora }) })
    }
  } catch {
    /* registro é best-effort */
  }
  return { ok: true }
}
