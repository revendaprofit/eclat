// Aviso de boas-vindas da vitrine: a visitante deixa o WhatsApp (e, se quiser, o e-mail) e recebe
// o cupom de primeira compra na tela. O contato vira LEAD no Supabase (Kanban do Cockpit) —
// relacionamento é do Supabase (invariante 2). Aqui fica só a parte pura: validar e montar o lead.
// Regra do número: a marca NÃO manda mensagem para quem só deixou o contato; o aceite fica
// registrado nas notas do lead com data, hora e o texto que a pessoa viu.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type EntradaBoasVindas = { whatsapp?: unknown; email?: unknown; aceite?: unknown; texto_aceite?: unknown; site?: unknown }
export type LeadBoasVindas = { whatsapp: string; email: string | null; nota: string }

/** Celular brasileiro → só dígitos com DDI 55 (mesmo formato que o webhook do WhatsApp grava). */
export function normalizarWhatsapp(bruto: string): string | null {
  let d = bruto.replace(/\D/g, "")
  if (d.startsWith("55") && d.length >= 12) d = d.slice(2)
  if (d.length !== 10 && d.length !== 11) return null
  if (d.length === 11 && d[2] !== "9") return null
  return `55${d}`
}

export function validarBoasVindas(e: EntradaBoasVindas, agora: Date): { lead: LeadBoasVindas } | { erro: string } {
  if (typeof e.site === "string" && e.site.trim()) return { erro: "Requisição inválida." } // campo-isca: só robô preenche
  if (e.aceite !== true) return { erro: "É preciso aceitar receber as novidades para liberar o cupom." }
  const whatsapp = typeof e.whatsapp === "string" ? normalizarWhatsapp(e.whatsapp) : null
  if (!whatsapp) return { erro: "Confere o WhatsApp: DDD + número." }
  const emailBruto = typeof e.email === "string" ? e.email.trim().toLowerCase() : ""
  if (emailBruto && !EMAIL_RE.test(emailBruto)) return { erro: "Confere o e-mail." }
  const texto = typeof e.texto_aceite === "string" ? e.texto_aceite.trim().slice(0, 300) : ""
  return {
    lead: {
      whatsapp,
      email: emailBruto || null,
      nota: `[boas-vindas do site] Aceite em ${agora.toISOString()}${texto ? `: "${texto}"` : ""}`,
    },
  }
}
