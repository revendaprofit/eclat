// POST /admin/creators/ler-perfis — roda agora a rotina diária do ciclo dos creators (lib/creator-ciclo.ts):
// lê os perfis, cadastra os posts que citam a marca, liga vendas sem número e marca vencedores.
// Rota de admin (autenticada pelo Medusa). Serve para o Cockpit ("Ler perfis agora") e para conferir depois de um deploy.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { instagramConfigured, rodarCicloDosCreators } from "../../../../lib/creator-ciclo"

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const linhas: string[] = []
  await rodarCicloDosCreators(req.scope, new Date(), { info: (m) => linhas.push(m), warn: (m) => linhas.push("AVISO " + m) })
  res.json({ instagram_configurado: instagramConfigured(), registro: linhas })
}
