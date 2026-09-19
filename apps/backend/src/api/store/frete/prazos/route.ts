// Prazo de entrega por serviço para o passo Entrega (spec §4.5): `calculatePrice` do Medusa só
// devolve preço. Lê o MESMO cache do provider (cotador.ts), então não custa outra ida à SuperFrete.
// Nunca derruba o checkout: sem CEP, sem token ou com a API fora do ar, devolve `{ prazos: {} }`.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { obterCotador } from "../../../../modules/superfrete/cotador"
import { cabeNoMiniEnvios, montarPacote } from "../../../../modules/superfrete/embalagem"
import { parametrosDoAmbiente } from "../../../../modules/superfrete/parametros"
import { precosDeVitrine } from "../../../../modules/superfrete/preco"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = req.query.cart_id
  if (typeof cartId !== "string" || !cartId.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cart_id é obrigatório.")
  }
  res.setHeader("Cache-Control", "no-store")

  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "items.quantity", "items.variant.weight", "items.product.weight", "shipping_address.postal_code"],
    filters: { id: cartId },
  })
  const cart = data[0]
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Carrinho ${cartId} não encontrado.`)

  const prazos: Record<string, { min: number; max: number }> = {}
  const cep = String(cart.shipping_address?.postal_code ?? "").replace(/\D/g, "")
  if (cep.length === 8 && cart.items?.length) {
    try {
      const pacote = montarPacote(cart.items.map((i: any) => ({ quantidade: Number(i.quantity), peso_g: i.variant?.weight ?? i.product?.weight ?? null })))
      const cotacoes = (await obterCotador().cotar(cep, pacote)).filter((c) => c.servico !== "mini" || cabeNoMiniEnvios(pacote))
      // Só as opções que o provider de fato oferece (sem as dominadas — spec §4.4).
      const visiveis = precosDeVitrine(cotacoes, parametrosDoAmbiente())
      for (const c of cotacoes) {
        if (typeof visiveis[c.servico] === "number") prazos[c.servico] = { min: c.prazoMin, max: c.prazoMax }
      }
    } catch {
      // o provider já loga a falha da cotação; aqui o prazo só fica ausente
    }
  }
  res.json({ prazos })
}
