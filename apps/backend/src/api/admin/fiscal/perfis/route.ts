import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listPerfis, upsertPerfil } from "../../../../lib/fiscal/fiscal-db"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.json({ perfis: await listPerfis() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  const permitidos = [
    "escopo", "alvo_id", "csosn", "cfop_dentro_uf", "cfop_fora_uf",
    "cfop_devolucao_dentro_uf", "cfop_devolucao_fora_uf", "origem_padrao", "ativo",
  ]
  const patch: Record<string, unknown> = {}
  for (const k of permitidos) if (k in body) patch[k] = body[k]
  return res.json({ perfil: await upsertPerfil(patch) })
}
