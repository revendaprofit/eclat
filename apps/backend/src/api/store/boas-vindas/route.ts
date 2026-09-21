// POST /store/boas-vindas — grava o contato do aviso de boas-vindas como lead (lib/boas-vindas.ts).
// Idempotente pelo WhatsApp: quem já é lead não é duplicado; só ganha o e-mail (se faltava) e a
// nota do aceite. Nunca devolve dado de lead — a resposta é só `{ ok }`.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { validarBoasVindas, type EntradaBoasVindas } from "../../../lib/boas-vindas"
import { createLead, sbSelect, supabaseConfigured, updateLead } from "../../../lib/supabase"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const r = validarBoasVindas((req.body ?? {}) as EntradaBoasVindas, new Date())
  if ("erro" in r) return res.status(400).json({ message: r.erro })
  if (!supabaseConfigured()) return res.status(503).json({ message: "Cadastro indisponível no momento." })

  const { whatsapp, email, nota } = r.lead
  try {
    const [existente] = await sbSelect<{ id: string; email: string | null; notas: string | null }>(
      "lead",
      `whatsapp=eq.${encodeURIComponent(whatsapp)}&select=id,email,notas&limit=1`
    )
    if (existente) {
      await updateLead(existente.id, {
        ...(email && !existente.email ? { email } : {}),
        notas: [existente.notas, nota].filter(Boolean).join("\n").slice(-4000),
      })
    } else {
      await createLead({ nome: "Visitante do site", whatsapp, email, origem: "site", interesse: "boas-vindas", notas: nota })
    }
    res.json({ ok: true })
  } catch (e) {
    req.scope.resolve(ContainerRegistrationKeys.LOGGER).error(`[boas-vindas] ${(e as Error).message}`)
    res.status(502).json({ message: "Não foi possível cadastrar agora." })
  }
}
