// GET /store/parcerias/:apelido — o cupom da parceria ATIVA dona do apelido do link /p/<apelido> (C6).
// Só devolve o código do cupom (que a creator já divulga). Nada de nome, telefone ou comissão.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parceriaDbConfigured, parceriaPorApelido } from "../../../../lib/parceria-db"
import { limparApelido } from "../../../../lib/parceria-regras"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const apelido = limparApelido(req.params.apelido)
  if (!apelido || !parceriaDbConfigured()) return res.status(404).json({ message: "Link não encontrado." })
  try {
    const p = await parceriaPorApelido(apelido)
    if (!p) return res.status(404).json({ message: "Link não encontrado." })
    res.set("Cache-Control", "public, s-maxage=60")
    res.json({ codigo: p.codigo })
  } catch {
    res.status(404).json({ message: "Link não encontrado." })
  }
}
