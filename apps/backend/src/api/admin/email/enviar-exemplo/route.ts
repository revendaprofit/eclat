import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { getPrevenda } from "../../../../lib/prevenda"
import { montarDadosPedido } from "../../../../modules/resend/dados-pedido"

// POST /admin/email/enviar-exemplo { to, pedido_id? } → { id }
// Manda o e-mail "pedido confirmado" pelo caminho real (Notification Module → Resend) para
// conferir chave, domínio e aparência. ATENÇÃO ao nome da pasta: o `medusa build` descarta todo
// arquivo cujo caminho contenha "test" (até "teste") — a rota some em produção sem erro nenhum. Sem pedido_id usa um pedido de exemplo. Exige sessão admin.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { to, pedido_id } = (req.body || {}) as { to?: string; pedido_id?: string }
  if (!to || !/^\S+@\S+\.\S+$/.test(to)) return res.status(400).json({ error: "to (e-mail) obrigatório" })
  if (!process.env.RESEND_API_KEY) return res.status(503).json({ error: "RESEND_API_KEY não configurada neste ambiente" })

  try {
    let pedido: unknown = EXEMPLO
    if (pedido_id) {
      const { data } = await req.scope.resolve("query").graph({
        entity: "order",
        fields: ["id", "display_id", "total", "item_subtotal", "shipping_total", "discount_total", "items.*", "shipping_address.*"],
        filters: { id: pedido_id },
      })
      if (!data[0]) return res.status(404).json({ error: "pedido não encontrado" })
      pedido = data[0]
    }
    const lojaUrl = process.env.STOREFRONT_URL || "https://www.useeclat.com.br"
    const n = await req.scope.resolve(Modules.NOTIFICATION).createNotifications({
      to,
      channel: "email",
      template: "pedido-confirmado",
      trigger_type: "admin.email.exemplo",
      data: montarDadosPedido(pedido as never, { lojaUrl, prevenda: await getPrevenda() }),
    })
    return res.json({ id: n.id, external_id: n.external_id ?? null })
  } catch (e) {
    return res.status(502).json({ error: (e as Error).message })
  }
}

const EXEMPLO = {
  display_id: 1042,
  item_subtotal: 318,
  shipping_total: 24.9,
  discount_total: 19,
  total: 323.9,
  shipping_address: {
    first_name: "Ana", last_name: "Exemplo", address_1: "Rua das Flores, 100", address_2: "Apto 12 · Centro",
    city: "Belo Horizonte", province: "MG", postal_code: "30130000",
  },
  items: [
    { product_title: "Top Aurora", variant_title: "P / Telha", quantity: 1, unit_price: 159 },
    { product_title: "Short Aurora", variant_title: "P / Telha", quantity: 1, unit_price: 159 },
  ],
}
