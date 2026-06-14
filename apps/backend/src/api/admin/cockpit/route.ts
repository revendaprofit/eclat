import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sbCount, sbSelect, supabaseConfigured } from "../../../lib/supabase"

// Cockpit (Parte 7): consolida COMÉRCIO (Medusa) + RELACIONAMENTO (Supabase).
// SOMENTE LEITURA — invariante 2 (o Cockpit lê os dois e orquestra; não escreve nas fontes).
// Rota sob /admin → protegida por sessão de admin.

type StatusCount = Record<string, number>

function groupBy<T extends Record<string, any>>(rows: T[], key: string): StatusCount {
  return rows.reduce((acc: StatusCount, r) => {
    const k = (r[key] ?? "—") as string
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})
}

export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  // ----- COMÉRCIO (Medusa) -----
  const comercio: Record<string, unknown> = {}
  try {
    const { metadata: pMeta } = await query.graph({
      entity: "product",
      fields: ["id"],
      pagination: { take: 1, skip: 0 },
    })
    comercio.produtos = pMeta?.count ?? 0

    const { metadata: cMeta } = await query.graph({
      entity: "customer",
      fields: ["id"],
      pagination: { take: 1, skip: 0 },
    })
    comercio.clientes = cMeta?.count ?? 0

    const { data: orders, metadata: oMeta } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "status",
        "total",
        "currency_code",
        "email",
        "created_at",
      ],
      pagination: { take: 100, skip: 0 },
    })
    const sorted = [...orders].sort(
      (a, b) => (b.created_at > a.created_at ? 1 : -1)
    )
    comercio.pedidos_total = oMeta?.count ?? orders.length
    comercio.pedidos_por_status = groupBy(orders, "status")
    comercio.receita_pedidos_recentes = orders.reduce(
      (s, o) => s + (Number(o.total) || 0),
      0
    )
    comercio.moeda = orders[0]?.currency_code ?? "brl"
    comercio.pedidos_recentes = sorted.slice(0, 5).map((o) => ({
      display_id: o.display_id,
      status: o.status,
      total: Number(o.total) || 0,
      currency_code: o.currency_code,
      email: o.email,
      created_at: o.created_at,
    }))
  } catch (err) {
    logger.error(`[cockpit] erro lendo comércio: ${(err as Error).message}`)
    comercio.erro = "Falha ao ler dados do Medusa."
  }

  // ----- RELACIONAMENTO (Supabase) -----
  const relacionamento: Record<string, unknown> = {}
  if (!supabaseConfigured()) {
    relacionamento.erro = "Supabase não configurado."
  } else {
    try {
      relacionamento.leads_total = await sbCount("lead")
      relacionamento.clientes_rel = await sbCount("cliente_rel")
      relacionamento.conversas_total = await sbCount("conversa")

      const leads = await sbSelect<{ status: string }>("lead", "select=status")
      relacionamento.funil = groupBy(leads, "status")

      relacionamento.conversas_recentes = await sbSelect(
        "conversa",
        "select=id,canal,direcao,conteudo,ocorreu_em&order=ocorreu_em.desc&limit=5"
      )
    } catch (err) {
      logger.error(`[cockpit] erro lendo relacionamento: ${(err as Error).message}`)
      relacionamento.erro = "Falha ao ler dados do Supabase."
    }
  }

  return res.status(200).json({
    comercio,
    relacionamento,
    gerado_em: new Date().toISOString(),
  })
}
