// Vendas fora do site (sócia, 2026-10-15). Regras puras: validação, totais, situação da cobrança e textos.
// Dinheiro em centavos. Desenho em docs/superpowers/specs/2026-10-15-vendas-fora-do-site-design.md.

export type Pagamento = "pix" | "dinheiro" | "cartao" | "a_prazo"
export type Canal = "whatsapp" | "presencial" | "instagram" | "outro"

export const PAGAMENTOS: { id: Pagamento; label: string }[] = [
  { id: "pix", label: "Pix" },
  { id: "dinheiro", label: "Dinheiro" },
  { id: "cartao", label: "Cartão" },
  { id: "a_prazo", label: "A prazo (combinar a data)" },
]
export const CANAIS: { id: Canal; label: string }[] = [
  { id: "whatsapp", label: "WhatsApp" },
  { id: "presencial", label: "Presencial" },
  { id: "instagram", label: "Instagram" },
  { id: "outro", label: "Outro" },
]

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
}

export type NovaVenda = {
  data: string
  canal: Canal
  cliente_nome: string
  cliente_whatsapp: string
  cliente_email?: string
  itens: ItemVenda[]
  desconto_centavos?: number
  pagamento: Pagamento
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

export function totais(itens: ItemVenda[], descontoCentavos = 0): { subtotal: number; total: number } {
  const subtotal = itens.reduce((s, i) => s + i.quantidade * i.preco_centavos, 0)
  return { subtotal, total: Math.max(0, subtotal - Math.max(0, descontoCentavos)) }
}

/** Valida e normaliza o lançamento. Devolve a linha pronta para o Supabase ou o erro. */
export function prepararVenda(v: NovaVenda, hoje: string): { linha: Record<string, unknown> } | { erro: string } {
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
  if (!PAGAMENTOS.some((p) => p.id === v.pagamento)) return { erro: "Escolha a forma de pagamento." }
  const desconto = Math.max(0, Math.round(Number(v.desconto_centavos ?? 0)))
  const { subtotal, total } = totais(itens, desconto)
  const aPrazo = v.pagamento === "a_prazo"
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
      desconto_centavos: desconto,
      total_centavos: total,
      pagamento: v.pagamento,
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
