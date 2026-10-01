// Recuperação automática de vendas — regras PURAS (sem rede, sem banco), testadas em
// __tests__/recuperacao-regras.unit.spec.ts. Quem orquestra é lib/recuperacao.ts.
// Decisão do dono em 2026-09-29: a 1ª mensagem do WhatsApp é só uma abordagem de pessoa real
// ("Oi, tudo bem? Aqui é a Camila, da ÉCLAT"), sem link e sem oferta. A oferta só sai depois que a
// pessoa responde. Ver architecture/recuperacao.md.

export type Gatilho = "lead_site" | "carrinho" | "pix" | "anuncio"
export type Etapa = "aguardando" | "abordada" | "respondeu" | "oferta_enviada" | "encerrada"

export type ItemResumo = { titulo: string; variante?: string | null; quantidade: number }

export type DadosRecuperacao = {
  itens?: ItemResumo[]
  valor?: number | null
}

/** Quando duas ocasiões caem na mesma pessoa, fica a mais quente. */
export const PRIORIDADE: Record<Gatilho, number> = { pix: 4, carrinho: 3, anuncio: 2, lead_site: 1 }

const HORA = 3600_000
const MIN = 60_000

// ---------- contato ----------

/** Dígitos com DDI 55. Aceita "31999990000", "5531999990000", máscara etc. Null se não for BR válido. */
export function normalizarContato(v: string | null | undefined): string | null {
  const d = String(v ?? "").replace(/\D/g, "")
  if (d.length === 10 || d.length === 11) return `55${d}`
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d
  return null
}

/**
 * Chave de comparação: 55 + DDD + 8 últimos dígitos. O JID do WhatsApp de muitos celulares BR
 * vem SEM o nono dígito (5531 8743-9025), enquanto o site grava com ele (5531 98743-9025).
 */
export function chaveContato(v: string | null | undefined): string | null {
  const n = normalizarContato(v)
  if (!n) return null
  return `55${n.slice(2, 4)}${n.slice(-8)}`
}

const NOMES_GENERICOS = ["visitante do site", "contato whatsapp", "cliente"]

/** Primeiro nome apresentável, ou null quando o nome é genérico, da própria marca ou estranho. */
export function primeiroNome(nome: string | null | undefined): string | null {
  const bruto = String(nome ?? "").trim()
  if (!bruto) return null
  const baixo = bruto.toLowerCase()
  if (NOMES_GENERICOS.includes(baixo)) return null
  if (/[ée]clat/i.test(baixo)) return null
  const primeiro = bruto.split(/\s+/)[0]
  if (!/^[A-Za-zÀ-ÖØ-öø-ÿ'-]{2,20}$/.test(primeiro)) return null
  return primeiro.charAt(0).toUpperCase() + primeiro.slice(1).toLowerCase()
}

/** Pedido de parada na resposta — encerra na hora e não manda oferta. */
export function ehPedidoDeParada(texto: string | null | undefined): boolean {
  const t = String(texto ?? "").toLowerCase()
  return /\b(sair|pare|parar|stop|remover|descadastr\w*|bloque\w*|n[aã]o (quero|tenho interesse|me mande|mande mais)|sem interesse)\b/.test(t)
}

// ---------- tempo ----------

const FUSO = "America/Sao_Paulo"

function horaLocal(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", hour12: false })
    .format(d)
    .replace("24:", "00:")
}

/** Dentro do horário comercial configurado (fuso de Brasília). `inicio`/`fim` = "09:00" ou "09:00:00". */
export function dentroDaJanela(inicio: string, fim: string, agora = new Date()): boolean {
  const h = horaLocal(agora)
  return h >= inicio.slice(0, 5) && h < fim.slice(0, 5)
}

/** Início do dia de hoje em Brasília (UTC-3, sem horário de verão desde 2019), em ISO. */
export function inicioDoDiaLocal(agora = new Date()): string {
  const local = new Date(agora.getTime() - 3 * HORA)
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate(), 3, 0, 0)).toISOString()
}

/** Intervalo sorteado entre duas abordagens (decisão do dono: 15 a 60 minutos). */
export function sortearIntervaloMs(minMin: number, maxMin: number, rand = Math.random): number {
  const lo = Math.max(1, Math.min(minMin, maxMin))
  const hi = Math.max(lo, maxMin)
  return Math.round((lo + rand() * (hi - lo)) * MIN)
}

/** Tempo de "digitando…" antes de enviar: proporcional ao texto, entre 3 e 9 segundos. */
export function tempoDigitandoMs(texto: string, rand = Math.random): number {
  const base = texto.length * 45
  return Math.round(Math.min(9000, Math.max(3000, base)) + rand() * 1500)
}

// ---------- textos ----------

function escolher<T>(opcoes: T[], rand: () => number): T {
  return opcoes[Math.min(opcoes.length - 1, Math.floor(rand() * opcoes.length))]
}

/**
 * 1ª mensagem: só a abordagem de uma pessoa. Sem link, sem cupom, sem preço — quem recebe link de
 * um número desconhecido denuncia; quem recebe um "oi" responde. Variações para não repetir o texto.
 */
export function textoAbordagem(p: { persona: string; nome: string | null; gatilho: Gatilho }, rand = Math.random): string {
  const oi = p.nome ? `Oi, ${p.nome}!` : "Oi!"
  const quem = p.persona.trim() || "Camila"
  if (p.gatilho === "anuncio") {
    return escolher(
      [
        `${oi} Tudo bem? Aqui é a ${quem}, da ÉCLAT 😊 Conseguiu dar uma olhadinha nas peças?`,
        `${oi} Aqui é a ${quem}, da ÉCLAT. Passando pra saber se ficou alguma dúvida 😊`,
        `${oi} Tudo certo? ${quem} da ÉCLAT aqui. Você chegou a ver as peças que te interessaram?`,
      ],
      rand
    )
  }
  return escolher(
    [
      `${oi} Tudo bem? Aqui é a ${quem}, da ÉCLAT 😊`,
      `${oi} Tudo bem? ${quem} da ÉCLAT aqui 😊 Posso te fazer uma pergunta rapidinha?`,
      `${oi} Tudo certo por aí? Sou a ${quem}, da ÉCLAT ✨`,
      `Olá${p.nome ? `, ${p.nome}` : ""}! Aqui é a ${quem}, da ÉCLAT. Tudo bem com você?`,
    ],
    rand
  )
}

/** "o Macaquinho Solaris (Telha / M)" · "o Conjunto Aurora e mais 1 peça" · "algumas peças". */
export function resumoItens(itens: ItemResumo[] | undefined): string {
  const lista = (itens ?? []).filter((i) => i?.titulo)
  if (!lista.length) return "algumas peças"
  const [p] = lista
  const nome = `${p.titulo}${p.variante ? ` (${p.variante})` : ""}`
  const resto = lista.slice(1).reduce((s, i) => s + (i.quantidade || 1), 0) + Math.max(0, (p.quantidade || 1) - 1)
  return resto > 0 ? `${nome} e mais ${resto} ${resto === 1 ? "peça" : "peças"}` : nome
}

/** Link que a oferta leva. Carrinho e Pix voltam para a sacola (o carrinho vive no cookie do aparelho). */
export function linkDaOferta(gatilho: Gatilho, lojaUrl: string): string {
  const base = lojaUrl.replace(/\/+$/, "")
  return gatilho === "carrinho" || gatilho === "pix" ? `${base}/br/cart` : `${base}/br`
}

/**
 * 2ª mensagem, só depois que a pessoa respondeu: o motivo do contato, a oferta e o link.
 * Oferta: o PRESENTE por faixa quando a promoção está ligada (`presente` = frase pronta, modules/brinde/regra.ts);
 * senão o cupom do Cockpit, se houver. Nunca os dois — o BEMVINDA10 saiu em 2026-09-30 (decisão do dono).
 */
export function textoOferta(p: {
  gatilho: Gatilho
  dados: DadosRecuperacao
  cupom: string
  link: string
  presente?: string | null
}): string {
  const presente = p.presente?.trim() || ""
  const cupom = presente ? "" : p.cupom.trim()
  const comCupom = presente ? ` ${presente} 🎁` : cupom ? ` Se for sua primeira compra, o cupom ${cupom} dá 10% de desconto.` : ""
  switch (p.gatilho) {
    case "carrinho":
      return `Vi que você separou ${resumoItens(p.dados.itens)} no nosso site e não chegou a finalizar. Ficou alguma dúvida de tamanho ou de frete? Posso te ajudar 😊${comCupom} Sua sacola continua aqui: ${p.link}`
    case "pix":
      return `Vi que o Pix do seu pedido (${resumoItens(p.dados.itens)}) expirou antes do pagamento. Aconteceu alguma coisa? É só voltar na sacola que o site gera um Pix novo na hora: ${p.link} Se preferir, te ajudo por aqui 😊`
    case "lead_site":
      if (presente) return `Você deixou seu contato no nosso site 😊${comCupom} Quer que eu te indique as peças mais pedidas? Dá uma olhada: ${p.link}`
      return `Você deixou seu contato no nosso site pra ganhar 10% na primeira compra 😊${cupom ? ` Seu cupom é ${cupom}.` : ""} Quer que eu te indique as peças mais pedidas? Dá uma olhada: ${p.link}`
    case "anuncio":
      return `Se quiser, te ajudo a escolher tamanho e cor por aqui mesmo.${comCupom} As peças estão todas aqui: ${p.link}`
  }
}

/** Resposta educada a quem pediu para parar. */
export const TEXTO_PARADA = "Claro, sem problema! Não vou mais te chamar por aqui. Obrigada 😊"

// ---------- ocasiões ----------

type SessaoPagamento = { provider_id?: string | null; status?: string | null; data?: Record<string, unknown> | null }

export type CarrinhoBruto = {
  id: string
  email?: string | null
  updated_at: string | Date
  completed_at?: string | Date | null
  metadata?: Record<string, unknown> | null
  customer?: { first_name?: string | null; email?: string | null; phone?: string | null } | null
  shipping_address?: { first_name?: string | null; phone?: string | null } | null
  items?: Array<{ title?: string | null; variant_title?: string | null; quantity?: number | null; unit_price?: number | null }> | null
  payment_collection?: { payment_sessions?: SessaoPagamento[] | null } | null
}

export type Ocasiao = {
  gatilho: Gatilho
  chave: string
  contato: string | null
  contato_chave: string | null
  email: string | null
  nome: string | null
  cart_id?: string
  lead_id?: string
  elegivel_em: string
  dados: DadosRecuperacao
}

/** Carrinho vira ocasião se tem contato e parou: 1 h depois (carrinho) ou 30 min depois do Pix vencer. */
export function ocasiaoDoCarrinho(c: CarrinhoBruto, agora = new Date(), janelaDias = 3): Ocasiao | null {
  if (c.completed_at) return null
  const itens = (c.items ?? []).filter((i) => i?.title)
  if (!itens.length) return null
  const parado = new Date(c.updated_at).getTime()
  if (agora.getTime() - parado > janelaDias * 24 * HORA) return null

  const meta = c.metadata ?? {}
  const contato = normalizarContato(
    c.shipping_address?.phone ?? (typeof meta.whatsapp === "string" ? meta.whatsapp : null) ?? c.customer?.phone
  )
  const email = (c.email ?? c.customer?.email ?? "").trim().toLowerCase() || null
  if (!contato && !email) return null

  const pix = (c.payment_collection?.payment_sessions ?? []).find((s) => s?.data && (s.data as { metodo?: unknown }).metodo === "pix")
  let gatilho: Gatilho = "carrinho"
  let elegivel = parado + HORA
  if (pix) {
    gatilho = "pix"
    const expira = Date.parse(String((pix.data as { expira_em?: unknown }).expira_em ?? ""))
    elegivel = (Number.isFinite(expira) ? Math.max(expira, parado) : parado + 30 * MIN) + 30 * MIN
  }

  return {
    gatilho,
    chave: `carrinho:${c.id}`,
    contato,
    contato_chave: chaveContato(contato),
    email,
    nome: primeiroNome(c.shipping_address?.first_name ?? c.customer?.first_name ?? null),
    cart_id: c.id,
    elegivel_em: new Date(elegivel).toISOString(),
    dados: {
      itens: itens.map((i) => ({ titulo: String(i.title), variante: i.variant_title ?? null, quantidade: Number(i.quantity ?? 1) })),
      valor: itens.reduce((s, i) => s + Number(i.unit_price ?? 0) * Number(i.quantity ?? 1), 0) || null,
    },
  }
}

export type LeadBruto = {
  id: string
  nome: string | null
  whatsapp: string | null
  email: string | null
  origem: string | null
  status: string | null
  created_at: string
}

/** Lead do aviso de 10% do site: 2 h depois do aceite, até 7 dias. */
export function ocasiaoDoLeadSite(l: LeadBruto, agora = new Date()): Ocasiao | null {
  if (l.origem !== "site" || (l.status && l.status !== "novo")) return null
  const criado = Date.parse(l.created_at)
  if (!Number.isFinite(criado) || agora.getTime() - criado > 7 * 24 * HORA) return null
  const contato = normalizarContato(l.whatsapp)
  const email = l.email?.trim().toLowerCase() || null
  if (!contato && !email) return null
  return {
    gatilho: "lead_site",
    chave: `lead:${l.id}`,
    contato,
    contato_chave: chaveContato(contato),
    email,
    nome: primeiroNome(l.nome),
    lead_id: l.id,
    elegivel_em: new Date(criado + 2 * HORA).toISOString(),
    dados: {},
  }
}

/**
 * Lead que chegou pelo anúncio de WhatsApp e ficou parado: a última mensagem da conversa (de
 * qualquer lado) tem mais de 24 h e o lead tem até 14 dias. Como a pessoa escreveu primeiro, o
 * contato é a continuação de uma conversa que ela começou.
 */
export function ocasiaoDoLeadAnuncio(l: LeadBruto, ultimaMensagemEm: string | null, agora = new Date()): Ocasiao | null {
  if (l.origem !== "anuncio" || (l.status && l.status !== "novo")) return null
  const criado = Date.parse(l.created_at)
  if (!Number.isFinite(criado) || agora.getTime() - criado > 14 * 24 * HORA) return null
  const contato = normalizarContato(l.whatsapp)
  if (!contato) return null
  const ultima = Date.parse(ultimaMensagemEm ?? "") || criado
  return {
    gatilho: "anuncio",
    chave: `lead:${l.id}`,
    contato,
    contato_chave: chaveContato(contato),
    email: l.email?.trim().toLowerCase() || null,
    nome: primeiroNome(l.nome),
    lead_id: l.id,
    elegivel_em: new Date(ultima + 24 * HORA).toISOString(),
    dados: {},
  }
}

// ---------- decisões da fila ----------

export type LinhaRecuperacao = {
  id: string
  gatilho: Gatilho
  etapa: Etapa
  contato: string | null
  email: string | null
  elegivel_em: string
  abordagem_em: string | null
  resposta_em: string | null
  email_em: string | null
  criado_em: string
}

/**
 * E-mail: nunca junto com o WhatsApp. Sai quando não há WhatsApp (ou ele está desligado), ou
 * quando a abordagem do WhatsApp ficou 4 h sem resposta. Uma vez por ocasião. Anúncio não tem e-mail.
 */
export function deveMandarEmail(l: LinhaRecuperacao, whatsappAtivo: boolean, agora = new Date()): boolean {
  if (!l.email || l.email_em || l.gatilho === "anuncio") return false
  if (l.etapa === "encerrada" || l.resposta_em) return false
  if (Date.parse(l.elegivel_em) > agora.getTime()) return false
  if (!l.contato || !whatsappAtivo) return l.etapa === "aguardando"
  return l.etapa === "abordada" && !!l.abordagem_em && agora.getTime() - Date.parse(l.abordagem_em) >= 4 * HORA
}

/** Motivo para encerrar sem enviar mais nada, ou null. */
export function motivoParaEncerrar(l: LinhaRecuperacao, agora = new Date()): string | null {
  const idade = agora.getTime() - Date.parse(l.criado_em)
  if (l.etapa === "abordada" && l.abordagem_em && agora.getTime() - Date.parse(l.abordagem_em) > 3 * 24 * HORA) {
    return "sem_resposta"
  }
  if (l.etapa === "aguardando" && idade > 4 * 24 * HORA) return "expirou"
  return null
}
