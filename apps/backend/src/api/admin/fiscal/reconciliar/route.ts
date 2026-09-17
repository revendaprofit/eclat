import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ehUuidValido } from "../../../../lib/fiscal/fiscal-db"
import { reconciliarDocumento, reconciliarPendentes } from "../../../../lib/fiscal/fiscal-reconciliar"
import { ErroFiscal } from "../../../../lib/fiscal/tipos"

// POST /admin/fiscal/reconciliar { documento_id? }
// Sem documento_id, roda a varredura dos pendentes.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const { documento_id } = (req.body || {}) as { documento_id?: string }
  // Mesmo problema do resolver (achado da revisão de 2026-09-17): fiscal_documento.id é uuid, e
  // reconciliarDocumento repassa o valor direto a lerDocumento/listarItens no PostgREST. Um
  // documento_id malformado vazava "invalid input syntax for type uuid" como 500. Requisição
  // malformada é 400.
  if (documento_id && !ehUuidValido(documento_id)) {
    return res.status(400).json({ error: "documento_id precisa ser um uuid válido." })
  }
  try {
    if (documento_id) return res.json(await reconciliarDocumento(documento_id))
    return res.json(await reconciliarPendentes(50))
  } catch (e) {
    const erro = e as Error
    // Só ErroFiscal é recusa de negócio (422). Falha de rede/Supabase/XML é infra: 500,
    // para não mascarar um problema de infraestrutura como se fosse erro do operador.
    return res.status(erro instanceof ErroFiscal ? 422 : 500).json({ error: erro.message })
  }
}
