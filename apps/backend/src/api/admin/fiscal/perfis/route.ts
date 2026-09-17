import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listPerfis, upsertPerfil } from "../../../../lib/fiscal/fiscal-db"

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  return res.json({ perfis: await listPerfis() })
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const body = (req.body || {}) as Record<string, unknown>
  // "id" precisa estar na allowlist (achado crítico C4): sem ele, o Prefer: resolution=merge-
  // duplicates do PostgREST não tem como resolver pela chave primária na EDIÇÃO — vira INSERT
  // puro, que bate nos índices parciais (fiscal_perfil_padrao_unico etc.) e trava a tabela do
  // contador depois do primeiro cadastro.
  const permitidos = [
    "id", "escopo", "alvo_id", "csosn", "cfop_dentro_uf", "cfop_fora_uf",
    "cfop_devolucao_dentro_uf", "cfop_devolucao_fora_uf", "origem_padrao", "ativo",
    "cst_pis_cofins", "cest",
  ]
  const patch: Record<string, unknown> = {}
  for (const k of permitidos) if (k in body) patch[k] = body[k]
  // A tela manda "" quando o campo está em branco, e "" viola o check da migration 0012.
  for (const k of ["cst_pis_cofins", "cest"]) {
    if (k in patch && String(patch[k] ?? "").trim() === "") patch[k] = null
  }
  return res.json({ perfil: await upsertPerfil(patch) })
}
