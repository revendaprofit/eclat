// Traduz um pedido do Medusa nos dados prontos para o e-mail (tudo já formatado em texto).
// Função pura: o subscriber busca o pedido, esta função não fala com ninguém.

export type ItemDoEmail = {
  nome: string
  variante: string | null
  quantidade: number
  total: string
  foto: string | null
}

export type DadosPedido = {
  numero: string
  primeiroNome: string | null
  itens: ItemDoEmail[]
  subtotal: string
  frete: string
  desconto: string | null
  total: string
  endereco: string[]
  avisoEnvio: string | null
  lojaUrl: string
  pedidoUrl: string
  whatsapp: string
}

export type PrevendaDoEmail = { ativa?: boolean; envios_a_partir?: string; whatsapp?: string }

type Valor = number | string | { numeric?: unknown; value?: unknown } | null | undefined

type PedidoDoMedusa = {
  id?: string | null
  display_id?: number | string | null
  item_subtotal?: Valor
  shipping_total?: Valor
  discount_total?: Valor
  total?: Valor
  shipping_address?: {
    first_name?: string | null
    last_name?: string | null
    address_1?: string | null
    address_2?: string | null
    city?: string | null
    province?: string | null
    postal_code?: string | null
  } | null
  items?: Array<{
    title?: string | null
    product_title?: string | null
    variant_title?: string | null
    quantity?: Valor
    unit_price?: Valor
    thumbnail?: string | null
  } | null> | null
}

const WHATSAPP_PADRAO = "5531991184431"

// O Medusa entrega dinheiro ora como número, ora como BigNumber ({ numeric }) ou valor bruto
// ({ value, precision }) — mesma armadilha documentada em modules/mercadopago/dinheiro.ts.
function numero(v: Valor): number {
  if (typeof v === "object" && v !== null) {
    if (typeof v.numeric === "number") return v.numeric
    if (v.value !== undefined) return Number(v.value)
  }
  const n = Number(v ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function brl(v: Valor): string {
  const [inteiro, centavos] = numero(v).toFixed(2).split(".")
  return `R$ ${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${centavos}`
}

function cep(v?: string | null): string | null {
  const d = String(v ?? "").replace(/\D/g, "")
  return d.length === 8 ? `CEP ${d.slice(0, 5)}-${d.slice(5)}` : d ? `CEP ${d}` : null
}

export function montarDadosPedido(
  pedido: PedidoDoMedusa,
  ctx: { lojaUrl: string; prevenda?: PrevendaDoEmail | null }
): DadosPedido {
  const e = pedido.shipping_address
  const nomeCompleto = [e?.first_name, e?.last_name].filter(Boolean).join(" ").trim()
  const cidade = [e?.city, e?.province].filter(Boolean).join(" - ")
  const desconto = numero(pedido.discount_total)
  const frete = numero(pedido.shipping_total)
  const lojaUrl = ctx.lojaUrl.replace(/\/$/, "")
  const [, mes, dia] = String(ctx.prevenda?.envios_a_partir ?? "").split("-")

  return {
    numero: String(pedido.display_id ?? ""),
    primeiroNome: e?.first_name?.trim() || null,
    itens: (pedido.items ?? []).filter(Boolean).map((i) => ({
      nome: i!.product_title || i!.title || "Peça ÉCLAT",
      variante: i!.variant_title || null,
      quantidade: numero(i!.quantity) || 1,
      total: brl(numero(i!.unit_price) * (numero(i!.quantity) || 1)),
      foto: i!.thumbnail || null,
    })),
    subtotal: brl(pedido.item_subtotal),
    frete: frete > 0 ? brl(frete) : "Grátis",
    desconto: desconto > 0 ? brl(desconto) : null,
    total: brl(pedido.total),
    endereco: e ? ([nomeCompleto, e.address_1, e.address_2, cidade, cep(e.postal_code)].filter(Boolean) as string[]) : [],
    avisoEnvio: ctx.prevenda?.ativa && dia && mes ? `Pré-venda: os envios começam em ${dia}/${mes}.` : null,
    lojaUrl,
    // a página de confirmação abre pelo id, sem login — serve também para quem comprou como visitante
    pedidoUrl: pedido.id ? `${lojaUrl}/br/order/${pedido.id}/confirmed` : `${lojaUrl}/br/account/orders`,
    whatsapp: ctx.prevenda?.whatsapp || WHATSAPP_PADRAO,
  }
}
