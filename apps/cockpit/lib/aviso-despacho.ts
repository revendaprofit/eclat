// Aviso de despacho à cliente, quando o pedido sai com etiqueta da SuperFrete (spec
// 2026-09-20-avisos-entrega-superfrete-design.md §9, adendo de 2026-09-21).
//
// Por que existe: na primeira etiqueta real (pedido #21) o código de rastreio levou ~24 s para
// existir, e o WhatsApp saiu sem ele. Regra do dono: a mensagem de despacho ESPERA o código.
// Quem manda essa mensagem é UM remetente só — o backend (webhook `order.generated` + verificação a
// cada 5 min). Com o interruptor `avisoPeloBackend` ligado, o Cockpit não manda esse WhatsApp: ele
// grava o estado em `metadata.frete.aviso_despacho`, pede ao backend que tente na hora e mostra o
// estado na tela. Desligado (padrão), o Cockpit avisa na hora como antes.
//
// O despacho MANUAL (código digitado ou sem código) não passa por aqui: continua avisando na hora.

/**
 * Interruptor `SUPERFRETE_AVISO_PELO_BACKEND` (ambiente do Cockpit). Desligado — o PADRÃO — o
 * Cockpit avisa a cliente na hora também no despacho com etiqueta, como antes desta mudança; ligado,
 * o aviso passa para o backend. Existe porque o Cockpit vai ao ar sozinho no push (Vercel) e o
 * backend só com `railway up`: sem o interruptor, "Cockpit novo + backend velho" deixaria todo aviso
 * pendente para sempre. Só liga com o texto `true` (espaço e maiúscula tolerados, para um espaço
 * colado no painel do Vercel não desligar em silêncio); qualquer outra coisa desliga.
 */
export function avisoPeloBackend(env: Record<string, string | undefined> = process.env): boolean {
  return (env.SUPERFRETE_AVISO_PELO_BACKEND ?? "").trim().toLowerCase() === "true"
}

export type StatusAviso = "pendente" | "enviado" | "dispensado" | "sem_telefone" | "expirado"
export type AvisoDespacho = { status: StatusAviso; desde?: string; em?: string; por?: string }

const STATUS: ReadonlySet<string> = new Set<StatusAviso>(["pendente", "enviado", "dispensado", "sem_telefone", "expirado"])

/** O que gravar logo depois de despachar com etiqueta da SuperFrete. */
export function avisoAoDespacharComEtiqueta(p: { notificar: boolean; temTelefone: boolean; agora: string }): AvisoDespacho {
  if (!p.notificar) return { status: "dispensado", em: p.agora }
  if (!p.temTelefone) return { status: "sem_telefone", em: p.agora }
  return { status: "pendente", desde: p.agora }
}

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v)

/** Lê `metadata.frete.aviso_despacho`. Qualquer coisa fora do formato → null (nunca inventa estado). */
export function lerAvisoDespacho(metadata: unknown): AvisoDespacho | null {
  if (!ehObjeto(metadata) || !ehObjeto(metadata.frete)) return null
  const a = metadata.frete.aviso_despacho
  if (!ehObjeto(a) || typeof a.status !== "string" || !STATUS.has(a.status)) return null
  const aviso: AvisoDespacho = { status: a.status as StatusAviso }
  for (const k of ["desde", "em", "por"] as const) {
    if (typeof a[k] === "string") aviso[k] = a[k] as string
  }
  return aviso
}

// Hora de Brasília, fixa: a operação é no Brasil e o texto não pode depender do fuso do navegador.
function horaMinuto(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })
}

/** Frase para a tela do pedido. */
export function textoDoAviso(a: AvisoDespacho | null): string | null {
  if (!a) return null
  switch (a.status) {
    case "pendente":
      return "Aviso à cliente: aguardando o código de rastreio."
    case "enviado": {
      const hora = horaMinuto(a.em)
      return hora ? `Aviso à cliente enviado às ${hora}.` : "Aviso à cliente enviado."
    }
    case "dispensado":
      return "Aviso à cliente desligado no despacho."
    case "sem_telefone":
      return "Pedido sem telefone: a cliente não será avisada pelo WhatsApp."
    case "expirado":
      return "O código de rastreio não apareceu em 24 h. Avise a cliente à mão."
  }
}
