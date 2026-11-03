// Envelope escolhido no site (order.metadata.envelope): o que foi prometido à cliente na primeira compra.
const TEXTOS: Record<string, string> = {
  presente: "Envelope: PRESENTE SURPRESA. Colocar o brinde premium na caixa.",
  consultoria: "Envelope: consultoria de look. Combinar com a cliente pelo WhatsApp.",
  voucher: "Envelope: voucher de 10%.",
}

export function textoDoEnvelope(v: unknown): string | null {
  return typeof v === "string" ? (TEXTOS[v] ?? null) : null
}
