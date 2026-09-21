import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"

// Carrinhos abandonados para o Cockpit. SOMENTE LEITURA (invariante 2): o Medusa é a fonte da
// verdade do comércio e a Admin API padrão (2.15) não tem listagem de carrinhos, então esta rota
// só expõe o que já está gravado. Rota sob /admin → protegida por sessão de admin.
//
// "Abandonado" = carrinho NÃO concluído (completed_at nulo), com pelo menos 1 item, parado há
// `min_parado_min` minutos (padrão 60) e mexido nos últimos `dias` dias (padrão 30). Quem monta
// valor, contato e estágio é o Cockpit (apps/cockpit/lib/carrinhos.ts, com teste).

const num = (v: unknown, padrao: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : padrao
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const dias = num(req.query.dias, 30, 1, 180)
  const minParado = num(req.query.min_parado_min, 60, 0, 60 * 24 * 30)
  const agora = Date.now()
  const desde = new Date(agora - dias * 86400000)
  const ate = new Date(agora - minParado * 60000)

  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "created_at",
      "updated_at",
      "completed_at",
      "customer_id",
      "customer.first_name",
      "customer.last_name",
      "customer.email",
      "customer.phone",
      "shipping_address.first_name",
      "shipping_address.last_name",
      "shipping_address.phone",
      "shipping_address.city",
      "shipping_address.province",
      "items.id",
      "items.title",
      "items.variant_title",
      "items.variant_sku",
      "items.thumbnail",
      "items.quantity",
      "items.unit_price",
      "items.adjustments.amount",
    ],
    filters: { completed_at: null, updated_at: { $gte: desde, $lte: ate } },
    pagination: { take: 300, skip: 0, order: { updated_at: "DESC" } },
  })
  const carrinhos = (data ?? []).filter((c: any) => (c.items ?? []).length > 0)

  // Pagamento iniciado (Pix gerado / cartão tentado): consulta à parte e tolerante — se o vínculo
  // carrinho→cobrança mudar de nome numa versão futura, a lista continua saindo, só sem este selo.
  const pagamento: Record<string, string> = {}
  if (carrinhos.length) {
    try {
      const { data: comCobranca } = await query.graph({
        entity: "cart",
        fields: ["id", "payment_collection.status", "payment_collection.payment_sessions.provider_id", "payment_collection.payment_sessions.status"],
        filters: { id: carrinhos.map((c: any) => c.id) },
      })
      for (const c of comCobranca ?? []) {
        const pc = (c as any).payment_collection
        if (pc?.payment_sessions?.length) pagamento[(c as any).id] = String(pc.status ?? "iniciado")
      }
    } catch (e) {
      logger.warn(`carrinhos-abandonados: sem dados de cobrança (${(e as Error).message})`)
    }
  }

  res.json({
    dias,
    min_parado_min: minParado,
    carrinhos: carrinhos.map((c: any) => ({ ...c, pagamento_iniciado: pagamento[c.id] ?? null })),
  })
}
