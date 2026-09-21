// Quando o Cockpit pode despachar um pedido.
//
// Regra nova de 2026-09-20: pedido com o dinheiro devolvido NÃO sai. O estorno feito no painel
// do Mercado Pago não chegava até aqui (o Medusa não aceita "estornado" como aviso de
// pagamento), então o pedido #10 continuou "pago" e despachável depois de a cliente receber o
// dinheiro de volta. A reconciliação passou a registrar o estorno; esta função é a trava que
// transforma esse registro em recusa na hora de enviar a peça.

export type PedidoParaDespacho = {
  fulfillment_status?: string | null
  payment_status?: string | null
}

export type DecisaoDeDespacho = { pode: true } | { pode: false; motivo: string }

/** Situações de pagamento em que a peça não pode sair. */
const PAGAMENTO_IMPEDE: Record<string, string> = {
  refunded: "O pagamento deste pedido foi estornado — o dinheiro já voltou para a cliente. Não despache.",
  partially_refunded:
    "Parte do pagamento deste pedido foi estornada. Confira o valor no Mercado Pago antes de despachar.",
  canceled: "O pagamento deste pedido foi cancelado.",
  not_paid: "Este pedido não está pago.",
}

export function podeDespachar(pedido: PedidoParaDespacho): DecisaoDeDespacho {
  if (pedido.fulfillment_status && pedido.fulfillment_status !== "not_fulfilled") {
    return { pode: false, motivo: "Este pedido já foi despachado." }
  }
  const impedimento = PAGAMENTO_IMPEDE[pedido.payment_status ?? ""]
  if (impedimento) return { pode: false, motivo: impedimento }
  return { pode: true }
}
