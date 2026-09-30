// Pedido de avaliação pelo WhatsApp — rótulos, validação e montagem do depoimento para o Cockpit.
// Quem envia é o backend (apps/backend/src/lib/avaliacao.ts); aqui só se vê, se controla e se publica.
// Ver architecture/avaliacao.md.

export type EtapaAvaliacao =
  | "agendada" | "pedida" | "respondeu" | "autorizacao_pedida" | "autorizada" | "publicada" | "encerrada"

export type AvaliacaoConfig = {
  ativo: boolean
  dias_apos_entrega: number
  dias_apos_despacho: number
  marco_zero: string
  texto_pedido: string | null
  texto_autorizacao: string | null
}

export type LinhaAvaliacao = {
  id: string
  origem: "pedido" | "manual"
  display_id: number | null
  nome: string | null
  contato: string | null
  pecas: string | null
  etapa: EtapaAvaliacao
  motivo_fim: string | null
  elegivel_em: string
  pedido_em: string | null
  pedido_texto: string | null
  resposta_texto: string | null
  resposta_em: string | null
  tem_foto: boolean
  autorizacao_em: string | null
  autorizou_texto: string | null
  autorizou_em: string | null
  publicado_em: string | null
  conversation_id: string | null
  criado_em: string
}

export const ETAPAS: Record<EtapaAvaliacao, string> = {
  agendada: "Agendada",
  pedida: "Pedida",
  respondeu: "Respondeu",
  autorizacao_pedida: "Aguardando autorização",
  autorizada: "Autorizou — pronta para publicar",
  publicada: "No site",
  encerrada: "Encerrada",
}

export const MOTIVOS: Record<string, string> = {
  sem_resposta: "Sem resposta em 5 dias",
  nao_autorizou: "Não autorizou publicar",
  pediu_para_parar: "Pediu para parar",
  humano_assumiu: "Equipe assumiu",
  ja_em_conversa: "Já estava em conversa",
  sem_whatsapp: "Número sem WhatsApp",
  expirou: "Expirou na fila",
  pedida_recentemente: "Já pedimos avaliação a ela nos últimos 60 dias",
  parado_pela_equipe: "Parado pela equipe",
}

const inteiro = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/** O que o Cockpit pode mudar. Devolve só os campos válidos, ou o primeiro erro em português. */
export function validarConfigAvaliacao(body: Record<string, unknown>): { campos: Record<string, unknown> } | { erro: string } {
  const campos: Record<string, unknown> = {}
  if ("ativo" in body) {
    if (typeof body.ativo !== "boolean") return { erro: "ativo precisa ser verdadeiro ou falso" }
    campos.ativo = body.ativo
  }
  if ("dias_apos_entrega" in body) {
    const n = inteiro(body.dias_apos_entrega, 0, 30)
    if (n === null) return { erro: "Dias depois da entrega: de 0 a 30" }
    campos.dias_apos_entrega = n
  }
  if ("dias_apos_despacho" in body) {
    const n = inteiro(body.dias_apos_despacho, 3, 45)
    if (n === null) return { erro: "Dias depois do despacho: de 3 a 45" }
    campos.dias_apos_despacho = n
  }
  for (const k of ["texto_pedido", "texto_autorizacao"] as const) {
    if (k in body) {
      const t = String(body[k] ?? "").trim()
      if (t.length > 600) return { erro: "Texto muito longo (máx. 600 caracteres)" }
      if (/https?:\/\/|www\./i.test(t)) return { erro: "Sem link na mensagem: número desconhecido com link é denunciado" }
      campos[k] = t || null
    }
  }
  return { campos }
}

export type Depoimento = { quote: string; author: string; origem?: string }

/**
 * Acrescenta a fala da cliente aos depoimentos do site (site_content "home.testimonials"), sem editar
 * o texto. Não duplica a mesma fala. Novo depoimento entra no começo (a PDP mostra os 3 primeiros).
 */
export function adicionarDepoimento(
  atual: { heading?: string; items?: Depoimento[] } | null | undefined,
  novo: { fala: string | null; nome: string | null }
): { heading: string; items: Depoimento[] } | { erro: string } {
  const fala = (novo.fala ?? "").trim()
  const autora = (novo.nome ?? "").trim()
  if (!fala) return { erro: "Ela não escreveu um comentário (só foto ou áudio). Transcreva na conversa antes de publicar." }
  if (!autora) return { erro: "Sem primeiro nome para assinar o depoimento." }
  const items = Array.isArray(atual?.items) ? atual!.items.filter((i) => i && i.quote) : []
  if (items.some((i) => i.quote.trim() === fala)) return { erro: "Esse comentário já está no site." }
  return { heading: atual?.heading || "O que elas dizem", items: [{ quote: fala, author: autora, origem: "WhatsApp" }, ...items] }
}

/** Números do painel. */
export function resumirAvaliacoes(linhas: LinhaAvaliacao[], inicioDoDia: string) {
  return {
    agendadas: linhas.filter((l) => l.etapa === "agendada").length,
    pedidas_hoje: linhas.filter((l) => l.pedido_em && l.pedido_em >= inicioDoDia).length,
    pedidas: linhas.filter((l) => l.pedido_em).length,
    responderam: linhas.filter((l) => l.resposta_em).length,
    autorizaram: linhas.filter((l) => l.autorizou_em).length,
    no_site: linhas.filter((l) => l.etapa === "publicada").length,
  }
}

// Mesmas regras do backend (apps/backend/src/lib/recuperacao-regras.ts), para o botão "Pedir avaliação".
export function normalizarContato(v: string | null | undefined): string | null {
  const d = String(v ?? "").replace(/\D/g, "")
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d
  return null
}

export function chaveContato(v: string | null | undefined): string | null {
  const n = normalizarContato(v)
  return n ? `55${n.slice(2, 4)}${n.slice(-8)}` : null
}

export function primeiroNome(nome: string | null | undefined): string | null {
  const primeiro = String(nome ?? "").trim().split(/\s+/)[0] ?? ""
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,20}$/.test(primeiro) || /[ée]clat/i.test(primeiro) || /^contato$/i.test(primeiro)) return null
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
}
