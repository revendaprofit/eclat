import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { tentarAvisoDeDespacho } from "../../../../../lib/aviso-despacho"

// POST /admin/frete/aviso-despacho/:order_id — o Cockpit chama logo depois de despachar com etiqueta
// da SuperFrete (spec 2026-09-20-avisos-entrega-superfrete-design.md §9). Só pede ao remetente único
// que tente AGORA; quem decide se manda, e garante que manda uma vez só, é `tentarAvisoDeDespacho`.
// Como toda rota em /admin, exige login de admin no Medusa (401 sem ele). O corpo é ignorado.
//
// Respostas:
//   200 { aviso_despacho }  o aviso como ficou (null se o pedido não tem aviso de despacho)
//   404 { error }           pedido não existe
//   500 { error }           qualquer outra falha — o job de 5 min tenta de novo
//
// TEMPO: o Cockpit desiste em 5 s, e esta rota pode levar até ~15 s (o prazo do envio na Evolution).
// Tudo bem: o Express não interrompe o handler quando o cliente fecha a conexão — o envio segue aqui
// e sai uma vez (a reserva atômica garante). Se o processo morrer no meio, a reserva vira "incerto"
// em 10 min, que é o lado seguro. Não há o que encurtar aqui.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const orderId = req.params.order_id

  try {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const {
      data: [pedido],
    } = await query.graph({ entity: "order", fields: ["id"], filters: { id: orderId } })
    if (!pedido) return res.status(404).json({ error: "Pedido não encontrado." })

    const aviso = await tentarAvisoDeDespacho(req.scope, orderId, "cockpit")
    return res.json({ aviso_despacho: aviso })
  } catch (e) {
    // Sem dado pessoal: só o id do pedido e o tipo do erro.
    logger.error(`[aviso-despacho] rota admin: pedido ${orderId}: falhou (${(e as Error)?.name ?? "erro"}) — o job de 5 min tenta de novo`)
    return res.status(500).json({ error: "Não foi possível tentar o aviso de despacho agora. O backend tenta de novo em até 5 minutos." })
  }
}
