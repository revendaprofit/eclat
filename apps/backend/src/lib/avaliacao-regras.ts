// Pedido de avaliação pelo WhatsApp — regras puras (testadas em __tests__/avaliacao-regras.unit.spec.ts).
// Decisões do dono em 2026-09-30: 3 dias depois de entregue (10 dias depois do despacho quando não há
// dado de entrega), 1ª mensagem sem link, 2ª pede autorização para publicar, nada em troca.
// Ver architecture/avaliacao.md.
import { chaveContato, normalizarContato, primeiroNome } from "./recuperacao-regras"

const HORA = 3600_000
const DIA = 24 * HORA

export type EtapaAvaliacao =
  | "agendada" | "pedida" | "respondeu" | "autorizacao_pedida" | "autorizada" | "publicada" | "encerrada"

export type ConfigAvaliacao = { dias_apos_entrega: number; dias_apos_despacho: number; marco_zero: string }

// ---------- datas ----------

type Fulfillment = { shipped_at?: string | null; delivered_at?: string | null; canceled_at?: string | null }

export type PedidoBruto = {
  id: string
  display_id: number | string
  created_at: string
  status?: string | null
  email?: string | null
  metadata?: Record<string, unknown> | null
  shipping_address?: { first_name?: string | null; phone?: string | null } | null
  items?: { title?: string | null; product_title?: string | null; quantity?: number | null }[] | null
  fulfillments?: Fulfillment[] | null
}

const valida = (v: unknown): number | null => {
  const t = typeof v === "string" ? Date.parse(v) : NaN
  return Number.isFinite(t) ? t : null
}

/** Entrega: evento `order.delivered` do webhook da SuperFrete, ou "entregue" marcado no fulfillment. */
export function dataDeEntrega(p: PedidoBruto): number | null {
  const frete = (p.metadata?.frete ?? {}) as { eventos?: Record<string, unknown> }
  const doWebhook = valida(frete.eventos?.["order.delivered"])
  if (doWebhook) return doWebhook
  const marcadas = (p.fulfillments ?? []).filter((f) => !f.canceled_at).map((f) => valida(f.delivered_at)).filter((t): t is number => t !== null)
  return marcadas.length ? Math.max(...marcadas) : null
}

/** Despacho: o primeiro fulfillment enviado (não cancelado). */
export function dataDeDespacho(p: PedidoBruto): number | null {
  const envios = (p.fulfillments ?? []).filter((f) => !f.canceled_at).map((f) => valida(f.shipped_at)).filter((t): t is number => t !== null)
  return envios.length ? Math.min(...envios) : null
}

/** Quando o pedido de avaliação pode sair. Null = ainda não foi nem despachado. */
export function elegivelEm(p: PedidoBruto, cfg: Pick<ConfigAvaliacao, "dias_apos_entrega" | "dias_apos_despacho">): number | null {
  const entregue = dataDeEntrega(p)
  if (entregue) return entregue + cfg.dias_apos_entrega * DIA
  const despachado = dataDeDespacho(p)
  if (despachado) return despachado + cfg.dias_apos_despacho * DIA
  return null
}

// ---------- quem entra ----------

export type Candidata = {
  order_id: string
  display_id: number
  contato: string
  contato_chave: string
  nome: string | null
  pecas: string
  elegivel_em: string
}

/** Pedido → candidata a pedido de avaliação, ou o motivo de não entrar (para log/depuração). */
export function candidataDoPedido(p: PedidoBruto, cfg: ConfigAvaliacao): Candidata | { fora: string } {
  if (p.status === "canceled") return { fora: "cancelado" }
  if ((p.email ?? "").toLowerCase().endsWith("@eclat.local")) return { fora: "teste" }
  const marco = valida(cfg.marco_zero)
  if (marco && Date.parse(p.created_at) < marco) return { fora: "antes_do_marco_zero" }
  const quando = elegivelEm(p, cfg)
  if (!quando) return { fora: "nao_despachado" }
  const bruto = p.shipping_address?.phone ?? (p.metadata?.whatsapp as string | undefined) ?? null
  const contato = normalizarContato(bruto)
  const chave = chaveContato(bruto)
  if (!contato || !chave) return { fora: "sem_telefone" }
  return {
    order_id: p.id,
    display_id: Number(p.display_id),
    contato,
    contato_chave: chave,
    nome: primeiroNome(p.shipping_address?.first_name ?? null),
    pecas: descreverPecas(p.items ?? []),
    elegivel_em: new Date(quando).toISOString(),
  }
}

/**
 * "o Conjunto Aurora" (top + short da mesma linha), "o Macaquinho Solaris", "o Top Aurora e o Short
 * Orvalho", "as peças" (3+ títulos). Usa o nome do produto, sem cor/tamanho.
 */
export function descreverPecas(itens: { title?: string | null; product_title?: string | null }[]): string {
  const nomes = Array.from(new Set(itens.map((i) => (i.product_title || i.title || "").trim()).filter(Boolean)))
  if (!nomes.length) return "as peças"
  const linha = (n: string) => n.split(/\s+/).slice(1).join(" ").toLowerCase()
  const tops = nomes.filter((n) => /^top\b/i.test(n))
  const shorts = nomes.filter((n) => /^shorts?\b/i.test(n))
  if (nomes.length === 2 && tops.length === 1 && shorts.length === 1 && linha(tops[0]) === linha(shorts[0])) {
    const l = tops[0].split(/\s+/).slice(1).join(" ")
    return `o Conjunto ${l}`
  }
  if (nomes.length === 1) return `o ${nomes[0]}`
  if (nomes.length === 2) return `o ${nomes[0]} e o ${nomes[1]}`
  return "as peças"
}

// ---------- textos ----------

function escolher<T>(opcoes: T[], rand: () => number): T {
  return opcoes[Math.min(opcoes.length - 1, Math.floor(rand() * opcoes.length))]
}

function aplicar(modelo: string, v: Record<string, string>): string {
  return modelo.replace(/\{(\w+)\}/g, (_, k: string) => v[k] ?? "")
}

/**
 * 1ª mensagem: sem link, sem cupom. Pergunta como foi usar e convida a mandar foto. `modelo` (do
 * Cockpit) aceita {nome} {pecas} {persona}; sem modelo, variações sorteadas.
 */
export function textoPedido(
  p: { persona: string; nome: string | null; pecas: string; modelo?: string | null },
  rand = Math.random
): string {
  const quem = p.persona.trim() || "Camila"
  const oi = p.nome ? `Oi, ${p.nome}!` : "Oi!"
  if (p.modelo?.trim()) return aplicar(p.modelo.trim(), { nome: p.nome ?? "", pecas: p.pecas, persona: quem }).replace(/\s+,/g, ",")
  return escolher(
    [
      `${oi} Aqui é a ${quem}, da ÉCLAT 💛 Já deu pra treinar com ${p.pecas}? Me conta em uma frase o que achou — e se quiser mandar uma foto usando, eu amo ver.`,
      `${oi} ${quem} da ÉCLAT aqui 💛 E aí, como foi estrear ${p.pecas}? Queria muito saber o que você achou. Se tiver foto treinando, manda que eu adoro!`,
      `${oi} Tudo bem? Sou a ${quem}, da ÉCLAT ✨ Passando pra saber como foi com ${p.pecas} no treino. Me conta o que achou?`,
    ],
    rand
  )
}

export function textoAutorizacao(p: { modelo?: string | null }, rand = Math.random): string {
  if (p.modelo?.trim()) return p.modelo.trim()
  return escolher(
    [
      "Que bom ler isso! 🥹 Posso colocar seu comentário no nosso site, só com seu primeiro nome?",
      "Amei saber! 💛 Você deixa eu colocar o que você escreveu no nosso site? Vai só o seu primeiro nome.",
    ],
    rand
  )
}

export const TEXTO_NAO_AUTORIZOU = "Tranquilo! Obrigada por contar 💛"
export const TEXTO_AUTORIZOU = "Obrigada! 💛 Vai fazer muita diferença pra quem ainda não conhece a ÉCLAT."

/** Resposta à pergunta de autorização: "sim" publica (com clique no Cockpit), "nao" encerra, resto a equipe decide. */
export function classificarAutorizacao(texto: string | null | undefined): "sim" | "nao" | "ambigua" {
  const t = String(texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  if (!t) return "ambigua"
  const nao = /\b(nao|prefiro nao|melhor nao|nao precisa|sem site|nao quero|nao pode)\b/.test(t)
  const sim = /\b(sim|pode|claro|com certeza|lógico|logico|autorizo|fica a vontade|fique a vontade|pode sim|claro que sim|ok|okay|beleza|bora|manda ver|pode colocar|pode por|pode usar)\b/.test(t) || /^(👍|❤️|💛|🥰|😍|🙌|✅)+$/u.test(t)
  if (nao && !/\b(claro que sim|pode sim)\b/.test(t)) return "nao"
  if (sim) return "sim"
  return "ambigua"
}

// ---------- vencimentos ----------

export type LinhaAvaliacao = {
  etapa: EtapaAvaliacao
  elegivel_em: string
  pedido_em: string | null
  autorizacao_em: string | null
}

/** Motivo para encerrar uma linha parada (ou null). */
export function motivoParaEncerrar(l: LinhaAvaliacao, agora = new Date()): string | null {
  const t = agora.getTime()
  if (l.etapa === "agendada" && t - Date.parse(l.elegivel_em) > 7 * DIA) return "expirou"
  if (l.etapa === "pedida" && l.pedido_em && t - Date.parse(l.pedido_em) > 5 * DIA) return "sem_resposta"
  if (l.etapa === "autorizacao_pedida" && l.autorizacao_em && t - Date.parse(l.autorizacao_em) > 5 * DIA) return "nao_autorizou"
  return null
}

/** Uma avaliação por pessoa a cada 60 dias. */
export const JANELA_POR_PESSOA_DIAS = 60
