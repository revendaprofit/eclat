// Leitura do pagamento de um pedido (Parte 4, F3 — spec §9/§10).
//
// Fonte: `payment_collections[].payments[]` do pedido na Admin API do Medusa (comércio é a
// fonte da verdade — nada disto é copiado para o Supabase). O `data` de cada pagamento é o que o
// provider gravou ao autorizar: pro Mercado Pago, `mp_order_id`, `mp_payment_id`, `metodo`,
// `bandeira`, `parcelas`, `final_cartao`, `tarifa_centavos` (a tarifa REAL cobrada pelo MP,
// achado da F0) e `liquido_centavos`. Tudo em centavos inteiros (Invariante 3).
export type PagamentoDoPedido = {
  provider_id: string
  amount: number
  captured_at?: string | null
  canceled_at?: string | null
  data?: Record<string, unknown> | null
}

export type ResumoDoPagamento = {
  /** "Pix", "Cartão de crédito", "Pix pelo WhatsApp" (provider manual) ou o id do provider. */
  metodo: string
  /** Complemento legível: "final 3311 · 3x", "1x", ou vazio. */
  detalhe: string
  tarifa_centavos: number | null
  liquido_centavos: number | null
  mp_order_id: string | null
  mp_payment_id: string | null
  ehMercadoPago: boolean
}

const ehMercadoPago = (providerId: string) => providerId.startsWith("pp_mercadopago_")

function centavosOuNull(v: unknown): number | null {
  return typeof v === "number" && Number.isInteger(v) ? v : null
}

/** Resume o pagamento "principal" do pedido (o primeiro não cancelado). `null` se não há pagamento. */
export function resumoDoPagamento(pagamentos: PagamentoDoPedido[] | null | undefined): ResumoDoPagamento | null {
  const p = (pagamentos ?? []).find((x) => !x.canceled_at) ?? pagamentos?.[0]
  if (!p) return null
  const d = (p.data ?? {}) as Record<string, unknown>

  if (!ehMercadoPago(p.provider_id)) {
    return {
      metodo: p.provider_id === "pp_system_default" ? "Pix pelo WhatsApp" : p.provider_id,
      detalhe: "",
      tarifa_centavos: null,
      liquido_centavos: null,
      mp_order_id: null,
      mp_payment_id: null,
      ehMercadoPago: false,
    }
  }

  const parcelas = Number(d.parcelas)
  const partes: string[] = []
  if (typeof d.final_cartao === "string" && d.final_cartao) partes.push(`final ${d.final_cartao}`)
  if (d.metodo === "cartao") partes.push(parcelas > 1 ? `${parcelas}x` : "1x")
  if (typeof d.bandeira === "string" && d.bandeira) partes.push(d.bandeira)

  return {
    metodo: d.metodo === "pix" ? "Pix" : d.metodo === "cartao" ? "Cartão de crédito" : "Mercado Pago",
    detalhe: partes.join(" · "),
    tarifa_centavos: centavosOuNull(d.tarifa_centavos),
    liquido_centavos: centavosOuNull(d.liquido_centavos),
    mp_order_id: typeof d.mp_order_id === "string" ? d.mp_order_id : null,
    mp_payment_id: typeof d.mp_payment_id === "string" ? d.mp_payment_id : null,
    ehMercadoPago: true,
  }
}

export type PedidoComPagamentos = {
  payment_collections?: { payments?: PagamentoDoPedido[] | null }[] | null
}

/**
 * Linha "(−) Taxas de pagamento" do DRE: soma da tarifa real de cada pedido do período. Despesa
 * financeira, NÃO é COGS (decisão de 2026-06-15, task_plan Parte 4). Pedidos do provider manual
 * contam zero. Pagamentos do Mercado Pago que ainda não têm a tarifa gravada entram em
 * `sem_tarifa` — o DRE avisa, em vez de fingir que a taxa foi zero.
 */
export function taxasDePagamento(pedidos: PedidoComPagamentos[]): { total_centavos: number; sem_tarifa: number } {
  let total = 0
  let semTarifa = 0
  for (const pedido of pedidos) {
    for (const colecao of pedido.payment_collections ?? []) {
      for (const p of colecao.payments ?? []) {
        if (p.canceled_at || !ehMercadoPago(p.provider_id)) continue
        const tarifa = centavosOuNull((p.data ?? {}).tarifa_centavos)
        if (tarifa == null) semTarifa += 1
        else total += tarifa
      }
    }
  }
  return { total_centavos: total, sem_tarifa: semTarifa }
}
