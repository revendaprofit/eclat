import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listPerfis, upsertPerfil } from "../../../../lib/fiscal/fiscal-db"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.json({ perfis: await listPerfis() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  return res.json({ perfil: await upsertPerfil(req.body as Record<string, unknown>) })
}
