import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { montar } from "../../../../lib/clube-carteiro"
import type { ClubeMensagem } from "../../../../lib/clube-db"

// POST /admin/clube/preview { texto, midia?, dados? } → { texto_final, midia_url }
// Prévia com os dados de AGORA (estoque, pedidos, dias para o envio), sem enviar nada.
export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const b = (req.body || {}) as Partial<ClubeMensagem>
  if (!b.texto) return res.status(400).json({ error: "texto obrigatório" })
  const fake = {
    id: "preview", origem: "manual", tipo: null, status: "rascunho", enviar_em: null, titulo: null,
    texto: b.texto, texto_final: null, midia: b.midia ?? null, midia_url_final: null,
    dados: (b.dados as Record<string, unknown>) ?? null, chave_dedup: null, evolution_msg_id: null, erro: null,
    criado_em: new Date().toISOString(), aprovado_em: null, enviado_em: null,
  } as ClubeMensagem
  try {
    const r = await montar(req.scope, fake)
    return res.json(r)
  } catch (e) {
    return res.status(500).json({ error: (e as Error).message })
  }
}
