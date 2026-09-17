import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { reconciliarDocumento, reconciliarPendentes } from "../../../../lib/fiscal/fiscal-reconciliar"

// POST /admin/fiscal/reconciliar { documento_id? }
// Sem documento_id, roda a varredura dos pendentes.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { documento_id } = (req.body || {}) as { documento_id?: string }
  try {
    if (documento_id) return res.json(await reconciliarDocumento(documento_id))
    return res.json(await reconciliarPendentes(50))
  } catch (e) {
    return res.status(422).json({ error: (e as Error).message })
  }
}
