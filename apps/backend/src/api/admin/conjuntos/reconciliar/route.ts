import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconciliar } from "../../../../modules/beneficio-conjunto/sincronizar-promocao"

export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  res.json(await reconciliar(req.scope))
}
