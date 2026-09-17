import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { getConfig, upsertConfig } from "../../../../lib/fiscal/fiscal-db"
import { brasilNfeConfigured } from "../../../../lib/fiscal/fiscal-client"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const config = await getConfig()
  // credenciais_ok é booleano de propósito: a rota nunca devolve token.
  return res.json({ config, credenciais_ok: brasilNfeConfigured() })
}

export async function PATCH(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  const permitidos = [
    "razao_social", "nome_fantasia", "ie", "im", "crt", "logradouro", "numero",
    "complemento", "bairro", "municipio", "municipio_ibge", "uf", "cep",
    "serie_nfe", "ambiente", "emissao_ativa",
  ]
  const patch: Record<string, unknown> = {}
  for (const k of permitidos) if (k in body) patch[k] = body[k]
  return res.json({ config: await upsertConfig(patch) })
}
