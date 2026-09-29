// Recuperação automática de vendas — rótulos e validação da configuração para o Cockpit.
// Quem envia é o backend (apps/backend/src/lib/recuperacao.ts); aqui só se vê e se controla.
// Ver architecture/recuperacao.md.

export type Gatilho = "lead_site" | "carrinho" | "pix" | "anuncio"
export type Etapa = "aguardando" | "abordada" | "respondeu" | "oferta_enviada" | "encerrada"

export type RecuperacaoConfig = {
  whatsapp_ativo: boolean
  email_ativo: boolean
  persona: string
  cupom: string
  janela_inicio: string
  janela_fim: string
  max_abordagens_dia: number
  intervalo_min_min: number
  intervalo_max_min: number
  proximo_envio_em: string | null
  falhas_seguidas: number
}

export type LinhaRecuperacao = {
  id: string
  gatilho: Gatilho
  etapa: Etapa
  motivo_fim: string | null
  nome: string | null
  contato: string | null
  email: string | null
  dados: { itens?: { titulo: string; variante?: string | null; quantidade: number }[]; valor?: number | null } | null
  elegivel_em: string
  abordagem_em: string | null
  abordagem_texto: string | null
  resposta_em: string | null
  oferta_em: string | null
  oferta_texto: string | null
  email_em: string | null
  criado_em: string
}

export const GATILHOS: Record<Gatilho, string> = {
  pix: "Pix não pago",
  carrinho: "Carrinho parado",
  lead_site: "Lead do site",
  anuncio: "Lead de anúncio",
}

export const ETAPAS: Record<Etapa, string> = {
  aguardando: "Na fila",
  abordada: "Abordada",
  respondeu: "Respondeu",
  oferta_enviada: "Oferta enviada",
  encerrada: "Encerrada",
}

export const MOTIVOS: Record<string, string> = {
  comprou: "Comprou",
  pediu_para_parar: "Pediu para parar",
  humano_assumiu: "Equipe assumiu",
  ja_em_conversa: "Já estava em conversa",
  sem_resposta: "Sem resposta em 3 dias",
  expirou: "Expirou na fila",
  sem_whatsapp: "Número sem WhatsApp",
  so_email: "Só e-mail (sem WhatsApp)",
  mesma_pessoa: "Mesma pessoa de outra ocasião",
  contatada_recentemente: "Já contatada nos últimos 30 dias",
  parado_pela_equipe: "Parado pela equipe",
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/

const inteiro = (v: unknown, min: number, max: number): number | null => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : null
}

/**
 * Valida o que o Cockpit pode mudar. Devolve só os campos válidos, ou o primeiro erro em português.
 * Limites de segurança do número: até 40 abordagens/dia e intervalo mínimo de 5 minutos.
 */
export function validarConfig(body: Record<string, unknown>): { campos: Record<string, unknown> } | { erro: string } {
  const campos: Record<string, unknown> = {}
  for (const k of ["whatsapp_ativo", "email_ativo"] as const) {
    if (k in body) {
      if (typeof body[k] !== "boolean") return { erro: `${k} precisa ser verdadeiro ou falso` }
      campos[k] = body[k]
    }
  }
  if ("persona" in body) {
    const p = String(body.persona ?? "").trim()
    if (p.length < 2 || p.length > 30) return { erro: "O nome da persona precisa ter de 2 a 30 letras" }
    campos.persona = p
  }
  if ("cupom" in body) {
    const c = String(body.cupom ?? "").trim().toUpperCase()
    if (c && !/^[A-Z0-9_-]{3,30}$/.test(c)) return { erro: "Cupom inválido (letras, números, - e _)" }
    campos.cupom = c
  }
  for (const k of ["janela_inicio", "janela_fim"] as const) {
    if (k in body) {
      if (!HORA.test(String(body[k]))) return { erro: "Horário no formato 09:00" }
      campos[k] = String(body[k]).slice(0, 5)
    }
  }
  if ("max_abordagens_dia" in body) {
    const n = inteiro(body.max_abordagens_dia, 1, 40)
    if (n === null) return { erro: "Limite por dia entre 1 e 40" }
    campos.max_abordagens_dia = n
  }
  for (const k of ["intervalo_min_min", "intervalo_max_min"] as const) {
    if (k in body) {
      const n = inteiro(body[k], 5, 240)
      if (n === null) return { erro: "Intervalo entre 5 e 240 minutos" }
      campos[k] = n
    }
  }
  const ini = (campos.janela_inicio ?? body.janela_inicio) as string | undefined
  const fim = (campos.janela_fim ?? body.janela_fim) as string | undefined
  if (ini && fim && ini.slice(0, 5) >= fim.slice(0, 5)) return { erro: "O horário de início precisa ser antes do fim" }
  const min = (campos.intervalo_min_min ?? body.intervalo_min_min) as number | undefined
  const max = (campos.intervalo_max_min ?? body.intervalo_max_min) as number | undefined
  if (min !== undefined && max !== undefined && Number(min) > Number(max)) return { erro: "Intervalo mínimo maior que o máximo" }
  if (campos.whatsapp_ativo === true) campos.falhas_seguidas = 0 // religar zera o contador de falhas
  return { campos }
}

/** Números do painel: o que aconteceu com as ocasiões da lista. */
export function resumir(linhas: LinhaRecuperacao[], inicioDoDia: string) {
  const hoje = (iso: string | null) => Boolean(iso && iso >= inicioDoDia)
  return {
    na_fila: linhas.filter((l) => l.etapa === "aguardando").length,
    abordagens_hoje: linhas.filter((l) => hoje(l.abordagem_em)).length,
    abordadas: linhas.filter((l) => l.abordagem_em).length,
    responderam: linhas.filter((l) => l.resposta_em).length,
    emails: linhas.filter((l) => l.email_em).length,
    compraram: linhas.filter((l) => l.motivo_fim === "comprou").length,
  }
}

/** Início do dia de hoje em Brasília (UTC-3), em ISO. */
export function inicioDoDiaLocal(agora = new Date()): string {
  const local = new Date(agora.getTime() - 3 * 3600_000)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0)).toISOString()
}
