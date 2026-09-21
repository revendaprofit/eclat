// Reconciliação do Mercado Pago (spec §13, riscos 2 e 3; decisão D1).
//
// Duas redes de segurança, rodadas pelo job src/jobs/mercadopago-reconciliar.ts:
//
// 1. WEBHOOK QUE NÃO CHEGOU — sessão de pagamento do provider que ainda não virou Payment
//    (pending/authorized/captured sem `payment`) há mais de X minutos: consulta a order no MP e,
//    se está paga, roda o mesmo workflow que o webhook rodaria (`processPaymentWorkflow`,
//    ação "captured") — que autoriza, captura e conclui o carrinho. Cobre também a cliente que
//    fechou a aba depois de o cartão ser aprovado e antes do `complete`.
//
// 2. DINHEIRO RECEBIDO SEM PEDIDO — Payment capturado cuja coleção não está ligada a nenhum
//    pedido há mais de Y minutos (carrinho sumiu, estoque acabou, promoção venceu…). Achado da F1:
//    o Medusa engole esse erro (`completeCartAfterPaymentStep` com continueOnPermanentFailure),
//    então ninguém saberia. Tenta concluir uma última vez; se não vira pedido, ESTORNA no MP e
//    grava um erro no log com tudo que o atendimento precisa pra avisar a cliente.
//
// 3. ESTORNO FEITO NO MERCADO PAGO — o Medusa só aceita um punhado de avisos de pagamento
//    (autorizado, capturado, falhou, pendente, cancelado) e estorno NÃO está entre eles: um
//    estorno feito no painel do MP não tinha por onde chegar aqui. O pedido #10 (20/09) ficou
//    "pago" e despachável depois de o dinheiro ter voltado para a cliente. Aqui a rotina compara
//    o que o MP já devolveu com o que está registrado no Medusa e registra a diferença — o
//    provider reconhece que não há saldo a estornar e só anota, sem devolver nada em dobro.
//
// Nada aqui adivinha: só age quando o MP confirma o status e quando o Medusa confirma que não
// existe pedido. Os dois limiares são parâmetros pra os testes de integração rodarem com 0.
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { processPaymentWorkflow } from "@medusajs/medusa/core-flows"
import { ClienteMercadoPago, totalJaEstornado } from "./cliente"
import { paraAcaoDoWebhook } from "./status"

export const PROVIDER_ID = "pp_mercadopago_mercadopago"

export type OpcoesDeReconciliacao = {
  /** Idade mínima (min) de uma sessão sem Payment para ser consultada no MP. */
  minutosSemPayment?: number
  /** Idade mínima (min) de um Payment capturado sem pedido para ser estornado. */
  minutosSemPedido?: number
  limite?: number
  agora?: number
}

export type ResultadoDaReconciliacao = {
  sessoesConsultadas: number
  carrinhosConcluidos: number
  pagamentosSemPedido: number
  estornados: number
  /** Estornos feitos no Mercado Pago que passaram a constar também aqui. */
  estornosRegistrados: number
  erros: string[]
}

type SessaoSemPayment = {
  id: string
  status: string
  created_at: string
  data: Record<string, unknown> | null
  payment: { id: string } | null
}

type PagamentoCapturado = {
  id: string
  amount: number
  captured_at: string | null
  canceled_at: string | null
  data: Record<string, unknown> | null
  refunds: { amount: number }[] | null
  payment_collection: {
    id: string
    order: { id: string } | null
    cart: { id: string; completed_at: string | null } | null
  } | null
}

const minutos = (ms: number) => ms / 60000

export async function reconciliarPagamentos(
  container: MedusaContainer,
  opcoes: OpcoesDeReconciliacao = {}
): Promise<ResultadoDaReconciliacao | { pulado: true }> {
  const token = process.env.MERCADOPAGO_ACCESS_TOKEN
  if (!token) return { pulado: true }

  const { minutosSemPayment = 5, minutosSemPedido = 15, limite = 50, agora = Date.now() } = opcoes
  const cliente = new ClienteMercadoPago(token)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const pagamentoModule = container.resolve(Modules.PAYMENT)
  const r: ResultadoDaReconciliacao = {
    sessoesConsultadas: 0,
    carrinhosConcluidos: 0,
    pagamentosSemPedido: 0,
    estornados: 0,
    estornosRegistrados: 0,
    erros: [],
  }

  // ── 1. Sessões sem Payment: o MP já confirmou e o Medusa não soube? ──
  const { data: sessoes } = await query.graph({
    entity: "payment_session",
    fields: ["id", "status", "created_at", "data", "payment.id"],
    filters: { provider_id: PROVIDER_ID, status: ["pending", "authorized", "captured"] },
    pagination: { take: limite, order: { created_at: "DESC" } },
  })
  for (const s of sessoes as unknown as SessaoSemPayment[]) {
    const orderId = s.data?.mp_order_id as string | undefined
    if (s.payment || !orderId) continue
    if (minutos(agora - Date.parse(s.created_at)) < minutosSemPayment) continue
    try {
      r.sessoesConsultadas++
      const order = await cliente.buscarOrder(orderId)
      if (paraAcaoDoWebhook(order) !== "captured") continue
      await processPaymentWorkflow(container).run({
        input: { action: "captured", data: { session_id: s.id, amount: Number(order.total_amount) } },
      })
      r.carrinhosConcluidos++
      logger.info(`[mercadopago] reconciliação: sessão ${s.id} estava paga no MP (${orderId}) — carrinho concluído sem webhook`)
    } catch (e) {
      r.erros.push(`sessão ${s.id}: ${(e as Error).message}`)
    }
  }

  // ── 2. Payments capturados sem pedido: estorna e avisa ──
  const { data: pagamentos } = await query.graph({
    entity: "payment",
    fields: [
      "id",
      "amount",
      "captured_at",
      "canceled_at",
      "data",
      "refunds.amount",
      "payment_collection.id",
      "payment_collection.order.id",
      "payment_collection.cart.id",
      "payment_collection.cart.completed_at",
    ],
    filters: { provider_id: PROVIDER_ID },
    pagination: { take: limite, order: { created_at: "DESC" } },
  })
  for (const p of pagamentos as unknown as PagamentoCapturado[]) {
    if (!p.captured_at || p.canceled_at) continue
    if (p.payment_collection?.order?.id) continue
    if ((p.refunds ?? []).some((x) => Number(x.amount) > 0)) continue
    if (minutos(agora - Date.parse(p.captured_at)) < minutosSemPedido) continue
    r.pagamentosSemPedido++

    const orderId = p.data?.mp_order_id as string | undefined
    const cart = p.payment_collection?.cart
    try {
      // Última tentativa de concluir (pode ter sido só o webhook que falhou no meio).
      if (cart && !cart.completed_at && p.payment_collection) {
        const { data: sessoesDaColecao } = await query.graph({
          entity: "payment_session",
          fields: ["id"],
          filters: { payment_collection_id: p.payment_collection.id, provider_id: PROVIDER_ID },
        })
        const sessionId = (sessoesDaColecao as unknown as { id: string }[])[0]?.id
        if (sessionId) {
          await processPaymentWorkflow(container).run({
            input: { action: "captured", data: { session_id: sessionId, amount: Number(p.amount) } },
          })
          const { data: colecoes } = await query.graph({
            entity: "payment_collection",
            fields: ["id", "order.id"],
            filters: { id: p.payment_collection.id },
          })
          const depois = (colecoes as unknown as { order?: { id: string } | null }[])[0]
          if (depois?.order?.id) {
            r.carrinhosConcluidos++
            continue
          }
        }
      }

      await pagamentoModule.refundPayment({
        payment_id: p.id,
        amount: p.amount,
        note: "Reconciliação automática: pagamento aprovado sem pedido no Medusa (spec Parte 4, D1)",
      })
      r.estornados++
      logger.error(
        `[mercadopago] ESTORNO AUTOMÁTICO: payment ${p.id} (order MP ${orderId ?? "?"}, R$ ${Number(p.amount).toFixed(2)}) ` +
          `estava pago desde ${p.captured_at} e o carrinho ${cart?.id ?? "(sumiu)"} não virou pedido. ` +
          `Avisar a cliente: o dinheiro volta pelo mesmo meio de pagamento.`
      )
    } catch (e) {
      r.erros.push(`payment ${p.id}: ${(e as Error).message}`)
    }
  }

  // ── 3. Estorno feito no Mercado Pago que o Medusa não soube ──
  const { data: capturados } = await query.graph({
    entity: "payment",
    fields: ["id", "amount", "captured_at", "canceled_at", "data", "refunds.amount", "payment_collection.order.id"],
    filters: { provider_id: PROVIDER_ID },
    pagination: { take: limite, order: { created_at: "DESC" } },
  })
  for (const p of capturados as unknown as PagamentoCapturado[]) {
    const orderId = p.data?.mp_order_id as string | undefined
    if (!orderId || !p.captured_at || p.canceled_at) continue
    const estornadoAqui = (p.refunds ?? []).reduce((soma, x) => soma + Number(x.amount ?? 0), 0)
    if (estornadoAqui >= Number(p.amount) - 0.005) continue // já registrado
    try {
      const order = await cliente.buscarOrder(orderId)
      const estornadoLa = totalJaEstornado(order)
      const diferenca = estornadoLa - estornadoAqui
      if (diferenca <= 0.005) continue

      await pagamentoModule.refundPayment({
        payment_id: p.id,
        amount: diferenca,
        note: `Estorno feito no Mercado Pago (order ${orderId}) — registrado pela reconciliação`,
      })
      r.estornosRegistrados++
      logger.warn(
        `[mercadopago] ESTORNO REGISTRADO: payment ${p.id} (order MP ${orderId}) foi estornado no Mercado Pago em ` +
          `R$ ${estornadoLa.toFixed(2)} e aqui constava R$ ${estornadoAqui.toFixed(2)}. ` +
          `O pedido ${p.payment_collection?.order?.id ?? "(sem pedido)"} passa a constar como estornado — não despachar.`
      )
    } catch (e) {
      r.erros.push(`estorno do payment ${p.id}: ${(e as Error).message}`)
    }
  }

  return r
}
