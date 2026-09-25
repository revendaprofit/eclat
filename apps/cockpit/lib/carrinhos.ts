// Carrinhos abandonados: transforma o carrinho cru do Medusa (rota /admin/carrinhos-abandonados)
// na linha que a tela mostra. Puro, sem React nem rede (Vitest).
// Valores seguem a unidade do Medusa v2 (reais decimais), igual à tela de Pedidos.

export type CarrinhoCru = {
  id: string
  email?: string | null
  created_at: string
  updated_at: string
  customer_id?: string | null
  // WhatsApp do 1º passo do checkout ou do aviso de boas-vindas (vitrine, desde 2026-09-25)
  metadata?: { whatsapp?: unknown } | null
  customer?: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null } | null
  shipping_address?: { first_name?: string | null; last_name?: string | null; phone?: string | null; city?: string | null; province?: string | null } | null
  items?: {
    id: string
    title?: string | null
    variant_title?: string | null
    variant_sku?: string | null
    thumbnail?: string | null
    quantity?: number | null
    unit_price?: number | null
    adjustments?: { amount?: number | null }[] | null
  }[] | null
  pagamento_iniciado?: string | null
}

// sacola = só colocou peças; identificado = deixou e-mail/telefone no checkout; pagamento = gerou Pix / tentou cartão
export type Estagio = "sacola" | "identificado" | "pagamento"

export type CarrinhoAbandonado = {
  id: string
  nome: string | null
  email: string | null
  telefone: string | null
  cidade: string | null
  estagio: Estagio
  itens: { id: string; titulo: string; variacao: string | null; sku: string | null; foto: string | null; quantidade: number; preco: number }[]
  pecas: number
  valor: number
  criado_em: string
  parado_desde: string
  horas_parado: number
}

const txt = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null)

export function montarCarrinho(c: CarrinhoCru, agora: number = Date.now()): CarrinhoAbandonado {
  const itens = (c.items ?? []).map((i) => ({
    id: i.id,
    titulo: txt(i.title) ?? "Peça",
    variacao: txt(i.variant_title),
    sku: txt(i.variant_sku),
    foto: txt(i.thumbnail),
    quantidade: Math.max(0, Number(i.quantity) || 0),
    preco: Number(i.unit_price) || 0,
  }))
  const bruto = itens.reduce((s, i) => s + i.preco * i.quantidade, 0)
  const descontos = (c.items ?? []).reduce((s, i) => s + (i.adjustments ?? []).reduce((a, d) => a + (Number(d?.amount) || 0), 0), 0)
  const email = txt(c.email) ?? txt(c.customer?.email)
  const telefone = txt(c.shipping_address?.phone) ?? txt(c.metadata?.whatsapp) ?? txt(c.customer?.phone)
  const nome =
    [txt(c.shipping_address?.first_name), txt(c.shipping_address?.last_name)].filter(Boolean).join(" ") ||
    [txt(c.customer?.first_name), txt(c.customer?.last_name)].filter(Boolean).join(" ") ||
    null
  const cidade = [txt(c.shipping_address?.city), txt(c.shipping_address?.province)].filter(Boolean).join(" / ") || null
  const estagio: Estagio = c.pagamento_iniciado ? "pagamento" : email || telefone ? "identificado" : "sacola"
  return {
    id: c.id,
    nome,
    email,
    telefone,
    cidade,
    estagio,
    itens,
    pecas: itens.reduce((s, i) => s + i.quantidade, 0),
    valor: Math.max(0, Math.round((bruto - descontos) * 100) / 100),
    criado_em: c.created_at,
    parado_desde: c.updated_at,
    horas_parado: Math.max(0, (agora - new Date(c.updated_at).getTime()) / 3600000),
  }
}

// Telefone brasileiro → número para wa.me (55 + DDD + número). Sem DDD ou curto demais → null.
export function numeroWhatsApp(telefone: string | null | undefined): string | null {
  const d = String(telefone ?? "").replace(/\D/g, "").replace(/^0+/, "")
  if (d.length === 10 || d.length === 11) return "55" + d
  if ((d.length === 12 || d.length === 13) && d.startsWith("55")) return d
  return null
}

export function mensagemRecuperacao(c: Pick<CarrinhoAbandonado, "nome" | "itens">): string {
  const primeiro = c.nome?.split(" ")[0]
  const pecas = c.itens.map((i) => i.titulo + (i.variacao ? ` (${i.variacao})` : "")).join(", ")
  return `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui é da use.ÉCLAT. Vi que você separou ${pecas} e não finalizou. Posso te ajudar com tamanho, frete ou pagamento?`
}

export function linkWhatsApp(c: Pick<CarrinhoAbandonado, "nome" | "itens" | "telefone">): string | null {
  const n = numeroWhatsApp(c.telefone)
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(mensagemRecuperacao(c))}` : null
}

export function resumo(lista: CarrinhoAbandonado[]) {
  const por = (e: Estagio) => lista.filter((c) => c.estagio === e)
  const soma = (l: CarrinhoAbandonado[]) => Math.round(l.reduce((s, c) => s + c.valor, 0) * 100) / 100
  return {
    total: lista.length,
    valor: soma(lista),
    com_contato: lista.filter((c) => c.estagio !== "sacola").length,
    valor_com_contato: soma(lista.filter((c) => c.estagio !== "sacola")),
    pagamento: por("pagamento").length,
  }
}
