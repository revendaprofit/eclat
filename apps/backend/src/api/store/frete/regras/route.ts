// Pisos do frete grátis, públicos (a vitrine mostra "faltam R$ X" — spec §4.6). Em centavos.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parametrosDoAmbiente } from "../../../../modules/superfrete/parametros"

export const GET = async (_req: MedusaRequest, res: MedusaResponse) => {
  const p = parametrosDoAmbiente()
  res.json({ piso_mg: p.pisoMg, piso_brasil: p.pisoBrasil })
}
