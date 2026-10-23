// Vendas fora do site (sócia, 2026-10-15/16). Regras puras: validação, desconto (R$ ou %), perfil (cliente /
// embaixadora 20% / creator custo zero ou % livre / uso próprio = custo zero, sócia e família), taxa do cartão por parcela → líquido, situação da cobrança e
// textos. Dinheiro em centavos. Desenho em docs/superpowers/specs/2026-10-15-vendas-fora-do-site-design.md.

export type Pagamento = "pix" | "dinheiro" | "cartao" | "a_prazo" | "cortesia"
export type Canal = "whatsapp" | "presencial" | "instagram" | "outro"
export type TipoDesconto = "valor" | "percentual"
export type Perfil = "cliente" | "embaixadora" | "creator" | "uso_proprio"

export const PAGAMENTOS: { id: Pagamento; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao", label: "Cartão (maquininha)" },
  { id: "a_prazo", label: "A prazo (combinar a data)" },
  { id: "cortesia", label: "Cortesia (sem cobrança)" },
]
export const CANAIS: { id: Canal; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "presencial", label: "Presencial" },
  { id: "instagram", label: "Instagram" },
  { id: "outro", label: "Outro" },
]
export const PERFIS: { id: Perfil; label: string }[] = [
  { id: "cliente", label: "Cliente" },
  { id: "embaixadora", label: "Embaixadora" },
  { id: "creator", label: "Creator" },
  { id: "uso_proprio", label: "Uso próprio" },
]
/** Desconto fixo da embaixadora (sócia, 2026-10-16). */
export const EMBAIXADORA_PERCENTUAL = 20

/** Taxas da maquininha, em % (ex.: 3.49). `debito` e crédito por nº de parcelas. Editável na tela; nasce vazia. */
export type TaxasCartao = { debito: number | null; credito: Record<string, number | null> }
export const PARCELAS_MAX = 12
export function taxasVazias(): TaxasCartao {
  const credito: Record<string, number | null> = {}
  for (let i = 1; i <= PARCELAS_MAX; i++) credito[String(i)] = null
  return { debito: null, credito }
}
export function normalizarTaxas(raw: unknown): TaxasCartao {
  const base = taxasVazias()
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 100 ? Math.round(v * 100) / 100 : null)
  base.debito = num(r.debito)
  const c = (r.credito && typeof r.credito === "object" ? r.credito : {}) as Record<string, unknown>
  for (const k of Object.keys(base.credito)) base.credito[k] = num(c[k])
  return base
}
/** Taxa (em %) para o nº de parcelas: 0 = débito, 1..12 = crédito. Null quando não configurada. */
export function taxaPara(taxas: TaxasCartao, parcelas: number): number | null {
  if (parcelas === 0) return taxas.debito
  return taxas.credito[String(parcelas)] ?? null
}

export type ItemVenda = {
  variant_id: string
  produto: string
  variacao: string | null
  sku: string | null
  quantidade: number
  preco_centavos: number
  inventory_item_id?: string | null
}

export type VendaExterna = {
  id: string
  criado_em: string
  data: string
  canal: Canal
  cliente_nome: string
  cliente_whatsapp: string
  cliente_email: string | null
  medusa_customer_id: string | null
  itens: ItemVenda[]
  subtotal_centavos: number
  desconto_centavos: number
  total_centavos: number
  pagamento: Pagamento
  pago: boolean
  pago_em: string | null
  vencimento: string | null
  lembrete_enviado_em: string | null
  estoque_baixado: boolean
  unboxing_enviado_em: string | null
  observacoes: string | null
  cancelada_em: string | null
  // parte 2 (16/10)
  tipo_desconto?: TipoDesconto
  desconto_percentual?: number | null
  perfil?: Perfil
  parcelas?: number | null
  taxa_percentual?: number | null
  taxa_centavos?: number
  liquido_centavos?: number | null
}

export type NovaVenda = {
  data: string
  canal: Canal
  cliente_nome: string
  cliente_whatsapp: string
  cliente_email?: string
  itens: ItemVenda[]
  tipo_desconto?: TipoDesconto
  desconto_centavos?: number // quando tipo_desconto = valor
  desconto_percentual?: number // quando tipo_desconto = percentual
  perfil?: Perfil
  pagamento: Pagamento
  parcelas?: number // cartão: 0 = débito
  pago?: boolean
  vencimento?: string
  observacoes?: string
  baixar_estoque?: boolean
  enviar_unboxing?: boolean
}

/** Mesma regra do despacho: só dígitos, com 55 na frente. */
export function normalizarWhatsapp(v: string | null | undefined): string {
  const d = String(v ?? "").replace(/\D/g, "")
  if (d.length === 10 || d.length === 11) return `55${d}`
  return d
}

export function whatsappValido(d: string): boolean {
  return /^55\d{10,11}$/.test(d)
}

export function subtotalDe(itens: ItemVenda[]): number {
  return itens.reduce((s, i) => s + i.quantidade * i.preco_centavos, 0)
}

/** Desconto em centavos a partir do tipo: R$ direto ou % do subtotal (arredondado ao centavo). */
export function descontoEmCentavos(subtotal: number, tipo: TipoDesconto, valorCentavos = 0, percentual = 0): number {
  if (tipo === "percentual") {
    const p = Math.min(100, Math.max(0, Number(percentual) || 0))
    return Math.min(subtotal, Math.round((subtotal * p) / 100))
  }
  return Math.min(subtotal, Math.max(0, Math.round(Number(valorCentavos) || 0)))
}

export function totais(itens: ItemVenda[], descontoCentavos = 0): { subtotal: number; total: number } {
  const subtotal = subtotalDe(itens)
  return { subtotal, total: Math.max(0, subtotal - Math.max(0, descontoCentavos)) }
}

/** Taxa do cartão em centavos e líquido. Sem taxa configurada → null (a tela avisa). */
export function liquidoDoCartao(total: number, parcelas: number, taxas: TaxasCartao): { taxa_percentual: number; taxa_centavos: number; liquido_centavos: number } | null {
  const t = taxaPara(taxas, parcelas)
  if (t == null) return null
  const taxa_centavos = Math.round((total * t) / 100)
  return { taxa_percentual: t, taxa_centavos, liquido_centavos: total - taxa_centavos }
}

/** Valida e normaliza o lançamento. Devolve a linha pronta para o Supabase ou o erro. */
export function prepararVenda(v: NovaVenda, hoje: string, taxas: TaxasCartao = taxasVazias()): { linha: Record<string, unknown> } | { erro: string } {
  const nome = String(v.cliente_nome ?? "").trim()
  if (!nome) return { erro: "Informe o nome da cliente." }
  const whatsapp = normalizarWhatsapp(v.cliente_whatsapp)
  if (!whatsappValido(whatsapp)) return { erro: "Confira o WhatsApp: DDD + número, 10 ou 11 dígitos." }
  const itens = (v.itens ?? []).filter((i) => i && i.variant_id && Number(i.quantidade) > 0)
  if (!itens.length) return { erro: "Escolha pelo menos uma peça." }
  for (const i of itens) {
    if (!Number.isInteger(i.quantidade) || i.quantidade <= 0) return { erro: `Quantidade inválida em ${i.produto}.` }
    if (!Number.isInteger(i.preco_centavos) || i.preco_centavos < 0) return { erro: `Preço inválido em ${i.produto}.` }
  }
  const perfil: Perfil = PERFIS.some((p) => p.id === v.perfil) ? (v.perfil as Perfil) : "cliente"
  // Embaixadora: sempre 20%. Creator: custo zero (100%) ou o % informado. Uso próprio (sócia, 23/10): peças que a
  // sócia pega para ela e para a família — sempre custo zero; o custo puro da peça vai para o financeiro, como creator.
  let tipo: TipoDesconto = v.tipo_desconto === "percentual" ? "percentual" : "valor"
  let percentual = Number(v.desconto_percentual ?? 0)
  if (perfil === "embaixadora") {
    tipo = "percentual"
    percentual = EMBAIXADORA_PERCENTUAL
  } else if (perfil === "creator") {
    tipo = "percentual"
    if (v.desconto_percentual == null || !Number.isFinite(percentual) || percentual < 0 || percentual > 100) return { erro: "Creator: informe o % de desconto (100 = custo zero)." }
  } else if (perfil === "uso_proprio") {
    tipo = "percentual"
    percentual = 100
  }
  if (tipo === "percentual" && (!Number.isFinite(percentual) || percentual < 0 || percentual > 100)) return { erro: "Desconto em %: entre 0 e 100." }
  const subtotal = subtotalDe(itens)
  const desconto = descontoEmCentavos(subtotal, tipo, v.desconto_centavos, percentual)
  const total = Math.max(0, subtotal - desconto)

  let pagamento = v.pagamento
  if (total === 0) pagamento = "cortesia"
  if (!PAGAMENTOS.some((p) => p.id === pagamento)) return { erro: "Escolha a forma de pagamento." }
  if (pagamento === "cortesia" && total > 0) return { erro: "Cortesia só quando o total é zero (use 100% de desconto)." }

  let parcelas: number | null = null
  let cartao: { taxa_percentual: number; taxa_centavos: number; liquido_centavos: number } | null = null
  if (pagamento === "cartao") {
    parcelas = Number(v.parcelas)
    if (!Number.isInteger(parcelas) || parcelas < 0 || parcelas > PARCELAS_MAX) return { erro: "Cartão: informe débito ou o número de parcelas (1 a 12)." }
    cartao = liquidoDoCartao(total, parcelas, taxas)
    if (!cartao) return { erro: `Cartão: a taxa para ${parcelas === 0 ? "débito" : `${parcelas}x`} não está configurada. Preencha as taxas da maquininha na tela.` }
  }

  const aPrazo = pagamento === "a_prazo"
  if (aPrazo && !/^\d{4}-\d{2}-\d{2}$/.test(String(v.vencimento ?? ""))) return { erro: "Venda a prazo: informe a data combinada do pagamento." }
  if (aPrazo && String(v.vencimento) < hoje) return { erro: "A data combinada do pagamento já passou." }
  const pago = aPrazo ? false : v.pago !== false
  const data = /^\d{4}-\d{2}-\d{2}$/.test(String(v.data ?? "")) ? v.data : hoje
  return {
    linha: {
      data,
      canal: CANAIS.some((c) => c.id === v.canal) ? v.canal : "whatsapp",
      cliente_nome: nome,
      cliente_whatsapp: whatsapp,
      cliente_email: String(v.cliente_email ?? "").trim().toLowerCase() || null,
      itens: itens.map((i) => ({
        variant_id: i.variant_id,
        produto: i.produto,
        variacao: i.variacao ?? null,
        sku: i.sku ?? null,
        quantidade: i.quantidade,
        preco_centavos: i.preco_centavos,
        inventory_item_id: i.inventory_item_id ?? null,
      })),
      subtotal_centavos: subtotal,
      tipo_desconto: tipo,
      desconto_percentual: tipo === "percentual" ? percentual : null,
      desconto_centavos: desconto,
      total_centavos: total,
      perfil,
      pagamento,
      parcelas,
      taxa_percentual: cartao?.taxa_percentual ?? null,
      taxa_centavos: cartao?.taxa_centavos ?? 0,
      liquido_centavos: cartao ? cartao.liquido_centavos : total,
      pago,
      pago_em: pago ? new Date().toISOString() : null,
      vencimento: aPrazo ? v.vencimento : null,
      observacoes: String(v.observacoes ?? "").trim() || null,
    },
  }
}

export type Situacao = "paga" | "a_vencer" | "vence_hoje" | "atrasada" | "cancelada"

export function situacao(v: Pick<VendaExterna, "pago" | "vencimento" | "cancelada_em" | "pagamento">, hoje: string): Situacao {
  if (v.cancelada_em) return "cancelada"
  if (v.pago) return "paga"
  if (!v.vencimento) return "a_vencer"
  if (v.vencimento < hoje) return "atrasada"
  if (v.vencimento === hoje) return "vence_hoje"
  return "a_vencer"
}

export const SITUACOES: Record<Situacao, { txt: string; cls: string }> = {
  paga: { txt: "paga", cls: "bg-green-100 text-green-800" },
  a_vencer: { txt: "a vencer", cls: "bg-amber-100 text-amber-800" },
  vence_hoje: { txt: "vence hoje", cls: "bg-eclat-dourado/40 text-eclat-texto" },
  atrasada: { txt: "atrasada", cls: "bg-red-100 text-red-700" },
  cancelada: { txt: "cancelada", cls: "bg-gray-100 text-gray-600" },
}

export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] || "tudo bem"
}

// WhatsApp: espaço normal entre "R$" e o valor (o toLocaleString põe um espaço duro, que fica estranho no celular).
const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }).replace(/ /g, " ")
const dataBr = (iso: string) => iso.split("-").reverse().join("/")

/** Convite ao unboxing para venda fora do site — mesmo roteiro do despacho (superfrete-avisos.ts). */
export function textoUnboxing(nome: string): string {
  return [
    `Oi, ${primeiroNome(nome)}! 💛`,
    "Obrigada por escolher a use.ÉCLAT. ✨",
    "",
    "Quando as peças chegarem na sua mão, que tal fazer um unboxing e mostrar pra gente? 🎥 Um roteiro simples:",
    "1. Abra a embalagem mostrando a tag.",
    "2. Mostre a peça de perto: a frente, as costas, o tecido.",
    "3. Vista ou treine com ela, do seu jeito.",
    "4. Poste nos stories marcando *@eclat.use*.",
    "",
    "Marcou? Me manda o print aqui que você ganha um *voucher de 10% OFF* para a sua próxima compra. 💛",
  ].join("\n")
}

/** Lembrete no dia combinado (o mesmo texto que o backend manda sozinho às 9h). */
export function textoLembretePagamento(nome: string, totalCentavos: number, vencimento: string): string {
  return [
    `Oi, ${primeiroNome(nome)}! 💛`,
    `Passando para lembrar: hoje, ${dataBr(vencimento)}, é o dia combinado do pagamento das suas peças da use.ÉCLAT, no valor de *${brl(totalCentavos)}*.`,
    "",
    "Pode fazer pelo Pix e me mandar o comprovante por aqui? Se precisar da chave, é só pedir. ✨",
  ].join("\n")
}
