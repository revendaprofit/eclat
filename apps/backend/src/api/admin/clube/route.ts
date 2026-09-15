import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { lerEstoque, contarPedidos } from "../../../lib/clube-estoque"
import { getConfig, listRegras, listMensagens } from "../../../lib/clube-db"
import { connectionState } from "../../../lib/evolution"
import { rodarDetector, rodarEntrega } from "../../../lib/clube-carteiro"

// GET  /admin/clube  → painel: config, conexão, regras, fila resumida, estoque lido agora (validação da leitura)
// POST /admin/clube  → { acao: "rodar" } roda detector+entrega agora (sem esperar os 5 min)
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const out: Record<string, unknown> = {}
  try {
    out.config = await getConfig()
    out.regras = await listRegras()
    out.whatsapp = await connectionState()
    const [aguardando, agendadas, enviadas, falhas] = await Promise.all([
      listMensagens("status=eq.rascunho&order=criado_em.desc&limit=50"),
      listMensagens("status=eq.aprovada&order=enviar_em.asc&limit=50"),
      listMensagens("status=eq.enviada&order=enviado_em.desc&limit=20"),
      listMensagens("status=eq.falhou&order=criado_em.desc&limit=10"),
    ])
    out.fila = { aguardando, agendadas, enviadas, falhas }
  } catch (e) {
    logger.warn(`[clube] painel: ${(e as Error).message}`)
    out.erro = (e as Error).message
  }
  try {
    const estoque = await lerEstoque(req.scope)
    out.estoque = estoque.map(({ imagem_url, ...r }) => ({ ...r, imagem_url }))
    out.pedidos = await contarPedidos(req.scope)
  } catch (e) {
    out.estoque_erro = (e as Error).message
  }
  return res.json(out)
}

export async function POST(req: MedusaRequest, res: MedusaResponse) {
  const logger = req.scope.resolve(ContainerRegistrationKeys.LOGGER)
  const body = (req.body || {}) as { acao?: string }
  const linhas: string[] = []
  const log = (m: string) => { linhas.push(m); logger.info(m) }
  if (body.acao === "rodar") {
    try { await rodarDetector(req.scope, log) } catch (e) { linhas.push(`detector: ${(e as Error).message}`) }
    try { await rodarEntrega(req.scope, log) } catch (e) { linhas.push(`entrega: ${(e as Error).message}`) }
    return res.json({ ok: true, log: linhas })
  }
  return res.status(400).json({ error: "acao inválida" })
}
