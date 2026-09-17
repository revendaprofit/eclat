// Mapa de status da Orders API do Mercado Pago para os dois enums que o Medusa entende.
//
// Tabela oficial `status`/`status_detail` de uma order (doc, lida em 17/09/2026,
// `checkout-api-orders/payment-management/status/order-status`) — reproduzida em
// docs/superpowers/specs/2026-09-17-pagamento-mercadopago-design.md §7.
//
// Duas saídas diferentes porque o Medusa usa dois vocabulários:
// - `PaymentSessionStatus` ("authorized"|"captured"|"pending"|"requires_more"|"error"|"canceled"):
//   usado quando NÓS respondemos a uma chamada (initiatePayment/authorizePayment/getPaymentStatus).
// - `PaymentActions` ("authorized"|"captured"|"failed"|"pending"|"requires_more"|"canceled"|"not_supported"):
//   usado quando é o WEBHOOK que está avisando o Medusa de uma mudança (getWebhookActionAndData).
//
// Achado importante (leitura de @medusajs/medusa/dist/subscribers/payment-webhook.js, 17/09):
// o assinante nativo do webhook SÓ chama o processPaymentWorkflow para as ações "authorized" e
// "captured" — "pending" cai num `when` sem ramo (não faz nada, só aguarda o próximo webhook,
// exatamente o que a decisão D1 da spec quer: Pix pendente não vira nada) e "not_supported",
// "canceled" e "failed" fazem o assinante retornar sem chamar o workflow nenhum. Ou seja: **o
// Medusa nunca reage sozinho a um estorno ou chargeback** — por isso o `service.ts` grava um
// aviso (log) como efeito colateral pro Cockpit acompanhar, além de devolver a ação correta.
export type StatusDaOrder = {
  status: string
  status_detail?: string
}

type StatusDaSessao = "authorized" | "captured" | "pending" | "requires_more" | "error" | "canceled"
type AcaoDoWebhook = "authorized" | "captured" | "failed" | "pending" | "requires_more" | "canceled" | "not_supported"

/**
 * Status usado quando O PRÓPRIO PROVIDER está respondendo (initiatePayment/authorizePayment/
 * getPaymentStatus) — ainda dentro do fluxo síncrono do checkout.
 */
export function paraStatusDaSessao({ status }: StatusDaOrder): StatusDaSessao {
  switch (status) {
    case "processed":
      return "captured"
    case "processing":
    case "action_required":
      // action_required cobre tanto "aguardando o banco confirmar o Pix" (o esperado, normal)
      // quanto "precisa de outra ação do comprador" — em ambos os casos o checkout não pode
      // travar; a vitrine mostra "confirmando" e espera o webhook (ou consulta de novo).
      return "pending"
    case "canceled":
    case "expired":
      return "canceled"
    case "failed":
      // Não existe "failed" em PaymentSessionStatus — "error" é o mais próximo e é o que faz
      // o checkout mostrar erro na hora (cartão recusado síncrono, spec §5 ponto 4).
      return "error"
    case "refunded":
    case "charged_back":
      // Não deveriam aparecer aqui (só surgem DEPOIS que a order já virou Payment, num momento
      // em que não estamos mais no fluxo initiate/authorize) — "error" é o fallback seguro pra
      // nunca fingir sucesso silenciosamente se isso acontecer.
      return "error"
    default:
      return "error"
  }
}

/**
 * Ação relatada ao Medusa quando é O WEBHOOK que está avisando de uma mudança.
 */
export function paraAcaoDoWebhook({ status }: StatusDaOrder): AcaoDoWebhook {
  switch (status) {
    case "processed":
      return "captured"
    case "processing":
    case "action_required":
      return "pending"
    case "canceled":
    case "expired":
      return "canceled"
    case "failed":
      return "failed"
    case "refunded":
    case "charged_back":
      // O Medusa não tem uma ação nativa pra isso (não_supported = "sem ramo automático"); o
      // service.ts grava um aviso pro Cockpit antes de devolver essa ação.
      return "not_supported"
    default:
      return "not_supported"
  }
}

/** Uma order é considerada "aprovada" (dinheiro já garantido) só neste status/status_detail. */
export function estaAprovada(order: StatusDaOrder): boolean {
  return order.status === "processed" && order.status_detail === "accredited"
}
