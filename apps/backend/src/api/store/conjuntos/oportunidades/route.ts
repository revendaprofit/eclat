// Oportunidades de completar um conjunto a partir do carrinho atual (Task 7). Nunca cacheável
// (estado por carrinho): `no-store`. Reaproveita avaliarCarrinho/mapaRaizes (Task 6) para o motor
// de pareamento; a única leitura própria daqui é achar candidatos publicados que preencheriam a
// categoria que falta, por coleção.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { avaliarCarrinho, mapaRaizes } from "../../../../modules/beneficio-conjunto/avaliar-carrinho"

const MAX_CANDIDATOS = 3

type ProdutoCandidato = { id: string; collection_id: string | null; categories?: { id: string }[] | null }

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const cartId = req.query.cart_id
  if (typeof cartId !== "string" || !cartId.trim()) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "cart_id é obrigatório.")
  }

  // `items.*` sozinho NÃO traz os totais calculados do item (subtotal etc. são campos
  // `.computed()` no LineItem — CartModuleService só decora o carrinho com os totais quando o
  // SELECT de topo pede um campo de total do próprio carrinho, ex. "subtotal"; sem isso
  // `avaliarCarrinho`/`linhasDoCarrinho` recebe `item.subtotal === undefined` e descarta a linha
  // inteira). "items.adjustments.*"/"items.tax_lines.*" são as relações que o decorador usa para
  // calcular discount_total/tax_total do item — confirmado empiricamente rodando o spec com o
  // conjunto de campos do ruling (só `items.*`) e vendo `subtotal` ausente do JSON do item.
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "subtotal",
      "items.*",
      "items.adjustments.*",
      "items.tax_lines.*",
      "items.product.id",
      "items.product.collection_id",
      "items.product.categories.id",
    ],
    filters: { id: cartId },
  })
  const cart = carts[0]
  if (!cart) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Carrinho ${cartId} não encontrado.`)

  const { resultado } = await avaliarCarrinho(req.scope, cart)

  const colecoesNecessarias = Array.from(new Set(resultado.oportunidades.map((o) => o.collection_id)))
  const raizes = await mapaRaizes(req.scope)
  const produtos: ProdutoCandidato[] = colecoesNecessarias.length
    ? (
        await query.graph({
          entity: "product",
          fields: ["id", "collection_id", "categories.id"],
          filters: { status: "published", collection_id: colecoesNecessarias },
        })
      ).data
    : []

  const oportunidades = resultado.oportunidades.map((o) => ({
    collection_id: o.collection_id,
    categoria_faltante: o.categoria_faltante,
    a_partir_do_item_id: o.a_partir_do_item_id,
    candidatos: produtos
      .filter((p) => p.collection_id === o.collection_id)
      .filter((p) => (p.categories ?? []).some((c) => raizes.get(c.id) === o.categoria_faltante))
      .slice(0, MAX_CANDIDATOS)
      .map((p) => p.id),
  }))

  res.set("Cache-Control", "no-store")
  res.json({ conjuntos: resultado.conjuntos, oportunidades })
}
