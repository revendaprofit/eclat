import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parceirasDoProduto } from "../../../../../modules/beneficio-conjunto/catalogo-conjuntos"

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const { product_id } = req.params
  res.json(await parceirasDoProduto(req.scope, product_id))
}
