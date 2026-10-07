// Parcerias com influencers (spec docs/superpowers/specs/2026-09-25-parcerias-influencer-design.md).
// Módulo PURO: sem React nem rede (Vitest). A venda é a verdade do Medusa (`order.promotions[].code`);
// aqui só se decide o que conta, quanto vale e como se apresenta. Dinheiro em CENTAVOS inteiros.
//
// Regras (decisões do dono, 2026-09-25):
// - comissão = % sobre o valor das PEÇAS efetivamente pago (depois do desconto, sem frete) = `item_total`;
// - só conta pedido pago (mesmo conjunto de status do DRE) e não cancelado;
// - arredondamento por pedido, meio para cima;
// - os NOME20 antigos (comissão 0) entram no controle para mostrar quem usou e quando.
import { pagamentoConfirmado } from "./pagamento-despacho"

export type Parceria = {
  codigo: string
  nome: string
  instagram: string | null
  whatsapp: string | null
  desconto_percentual: number
  comissao_percentual: number
  medusa_promotion_id: string
  medusa_campaign_id: string | null
  ativa: boolean
  notas: string | null
  criado_em: string
  updated_at?: string
}

// Pedido como a Admin API devolve com `fields=id,display_id,status,payment_status,item_total,created_at,email,promotions.code`.
// `item_total` vem em reais decimais (unidade do Medusa v2 na Admin API).
export type PedidoComCupom = {
  id: string
  display_id: number
  status: string
  payment_status: string | null
  item_total: number | null
  created_at: string
  email?: string | null
  promotions?: { code?: string | null }[] | null
}

export type Venda = {
  order_id: string
  display_id: number
  criado_em: string
  email: string | null
  base_centavos: number
  comissao_centavos: number
  conta: boolean
  motivo: "cancelado" | "aguardando pagamento" | null
}

export type Totais = { pedidos: number; base_centavos: number; comissao_centavos: number }

export const centavos = (reais: number | null | undefined): number => Math.round((Number(reais) || 0) * 100)

// Meio para cima, por pedido (R8). Math.round faz isso para valores positivos.
export function comissaoCentavos(base_centavos: number, percentual: number): number {
  if (!(base_centavos > 0) || !(percentual > 0)) return 0
  return Math.round((base_centavos * percentual) / 100)
}

export function temCupom(pedido: Pick<PedidoComCupom, "promotions">, codigo: string): boolean {
  const alvo = codigo.trim().toUpperCase()
  return (pedido.promotions ?? []).some((p) => (p.code ?? "").toUpperCase() === alvo)
}

export function vendaDaParceria(pedido: PedidoComCupom, parceria: Pick<Parceria, "comissao_percentual">): Venda {
  const cancelado = pedido.status === "canceled"
  const pago = pagamentoConfirmado(pedido.payment_status)
  const conta = !cancelado && pago
  const base = centavos(pedido.item_total)
  return {
    order_id: pedido.id,
    display_id: pedido.display_id,
    criado_em: pedido.created_at,
    email: pedido.email ?? null,
    base_centavos: base,
    comissao_centavos: conta ? comissaoCentavos(base, parceria.comissao_percentual) : 0,
    conta,
    motivo: cancelado ? "cancelado" : pago ? null : "aguardando pagamento",
  }
}

// Todas as vendas com o cupom da parceira, mais recentes primeiro.
export function vendasDaParceria(pedidos: PedidoComCupom[], parceria: Pick<Parceria, "codigo" | "comissao_percentual">): Venda[] {
  return pedidos
    .filter((p) => temCupom(p, parceria.codigo))
    .map((p) => vendaDaParceria(p, parceria))
    .sort((a, b) => b.criado_em.localeCompare(a.criado_em))
}

// Data do pedido comparada pelo dia em UTC (mesmo critério do filtro `created_at` do DRE).
export function noPeriodo(venda: Pick<Venda, "criado_em">, inicio: string, fim: string): boolean {
  const dia = venda.criado_em.slice(0, 10)
  return dia >= inicio && dia <= fim
}

export function totais(vendas: Venda[]): Totais {
  const t: Totais = { pedidos: 0, base_centavos: 0, comissao_centavos: 0 }
  for (const v of vendas) {
    if (!v.conta) continue
    t.pedidos += 1
    t.base_centavos += v.base_centavos
    t.comissao_centavos += v.comissao_centavos
  }
  return t
}

export type Periodo = { inicio: string; fim: string }

// Mês (YYYY-MM-DD → YYYY-MM-DD) que contém a data, e o mês anterior.
export function mesDe(dataISO: string): Periodo {
  const [a, m] = dataISO.slice(0, 7).split("-").map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, "0")
  return { inicio: `${a}-${mm}-01`, fim: `${a}-${mm}-${String(ultimo).padStart(2, "0")}` }
}
export function mesAnterior(dataISO: string): Periodo {
  const [a, m] = dataISO.slice(0, 7).split("-").map(Number)
  const d = new Date(Date.UTC(a, m - 2, 1))
  return mesDe(d.toISOString())
}

export type ResumoParceria = {
  mes_atual: Totais
  mes_anterior: Totais
  total: Totais
  pendentes: number // pedidos com o cupom que ainda não contam (aguardando pagamento)
}

export function resumoParceria(vendas: Venda[], hojeISO: string): ResumoParceria {
  const atual = mesDe(hojeISO)
  const anterior = mesAnterior(hojeISO)
  return {
    mes_atual: totais(vendas.filter((v) => noPeriodo(v, atual.inicio, atual.fim))),
    mes_anterior: totais(vendas.filter((v) => noPeriodo(v, anterior.inicio, anterior.fim))),
    total: totais(vendas),
    pendentes: vendas.filter((v) => v.motivo === "aguardando pagamento").length,
  }
}

// ---- Formulário (nova parceria / edição) ----
export type NovaParceria = {
  codigo: string
  nome: string
  instagram: string | null
  whatsapp: string | null
  desconto_percentual: number
  comissao_percentual: number
  notas: string | null
}

const txt = (v: unknown): string => (typeof v === "string" ? v.trim() : "")

export function normalizarInstagram(v: unknown): string | null {
  const s = txt(v).replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/.*$/, "")
  return s || null
}

// Dígitos com DDI 55, mesmo formato do CRM. DDD + número (10 ou 11 dígitos) ganha o 55.
export function normalizarWhatsApp(v: unknown): string | null {
  const d = txt(v).replace(/\D/g, "").replace(/^0+/, "")
  if (!d) return null
  if (d.length === 10 || d.length === 11) return "55" + d
  return d
}

function percentual(v: unknown, min: number, rotulo: string, erros: string[]): number {
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > 100) erros.push(`${rotulo} precisa ser inteiro entre ${min} e 100.`)
  return n
}

export function validarNovaParceria(input: Record<string, unknown>): { ok: true; valor: NovaParceria } | { ok: false; erros: string[] } {
  const erros: string[] = []
  const codigo = txt(input.codigo).toUpperCase()
  if (!/^[A-Z0-9]{3,20}$/.test(codigo)) erros.push("Código: só letras e números, de 3 a 20 caracteres (ex.: PATY10).")
  const nome = txt(input.nome)
  if (!nome) erros.push("Nome da parceira é obrigatório.")
  const desconto = percentual(input.desconto_percentual ?? 10, 1, "Desconto da cliente", erros)
  const comissao = percentual(input.comissao_percentual ?? 5, 0, "Comissão", erros)
  if (erros.length) return { ok: false, erros }
  return {
    ok: true,
    valor: {
      codigo,
      nome,
      instagram: normalizarInstagram(input.instagram),
      whatsapp: normalizarWhatsApp(input.whatsapp),
      desconto_percentual: desconto,
      comissao_percentual: comissao,
      notas: txt(input.notas) || null,
    },
  }
}

export type EdicaoParceria = Partial<Pick<Parceria, "nome" | "instagram" | "whatsapp" | "comissao_percentual" | "notas" | "ativa">>

// Só os campos enviados; o desconto NÃO se edita (está na promoção do Medusa — trocar é criar outro cupom).
export function validarEdicao(input: Record<string, unknown>): { ok: true; valor: EdicaoParceria } | { ok: false; erros: string[] } {
  const erros: string[] = []
  const valor: EdicaoParceria = {}
  if ("nome" in input) {
    const nome = txt(input.nome)
    if (!nome) erros.push("Nome da parceira é obrigatório.")
    valor.nome = nome
  }
  if ("instagram" in input) valor.instagram = normalizarInstagram(input.instagram)
  if ("whatsapp" in input) valor.whatsapp = normalizarWhatsApp(input.whatsapp)
  if ("comissao_percentual" in input) valor.comissao_percentual = percentual(input.comissao_percentual, 0, "Comissão", erros)
  if ("notas" in input) valor.notas = txt(input.notas) || null
  if ("ativa" in input) {
    if (typeof input.ativa !== "boolean") erros.push("ativa precisa ser true ou false.")
    valor.ativa = input.ativa as boolean
  }
  if (!Object.keys(valor).length) erros.push("Nada para alterar.")
  if (erros.length) return { ok: false, erros }
  return { ok: true, valor }
}

export const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })

// Texto pronto para mandar à parceira (WhatsApp).
export function mensagemParaParceira(p: Pick<Parceria, "codigo" | "nome" | "desconto_percentual" | "comissao_percentual">): string {
  const primeiro = p.nome.split(" ")[0]
  const comissao = p.comissao_percentual
    ? ` E ${p.comissao_percentual}% de tudo o que for pago com o seu cupom é seu — fechamos e pagamos todo mês.`
    : ""
  return `Oi, ${primeiro}! Seu cupom na use.ÉCLAT é ${p.codigo}: ${p.desconto_percentual}% nas peças para quem usar, em useeclat.com.br.${comissao}`
}
