import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import type { z } from "zod"
import { BENEFICIO_CONJUNTO_MODULE } from "../../../../modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../../../modules/beneficio-conjunto/sincronizar-promocao"
import type { Regra } from "../../../../modules/beneficio-conjunto/utils/tipos"
import { CriarCuradoSchema } from "../../../middlewares"

type CriarCuradoBody = z.infer<typeof CriarCuradoSchema>

// pt-BR, ascii, minúsculo, hífens — sem depender de nenhuma lib externa de slug.
const MARCAS_DIACRITICAS = /[̀-ͯ]/g
function slugificar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(MARCAS_DIACRITICAS, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const curados = await svc.listConjuntoCurados({}, { order: { ordem: "ASC" } })
  const regraIds = Array.from(new Set(curados.map((c: any) => c.regra_id)))
  const regras = (regraIds.length ? await svc.listConjuntoRegras({ id: regraIds }) : []) as Regra[]
  const regraPorId = new Map(regras.map((r) => [r.id, r]))
  res.json({ curados: curados.map((c: any) => ({ ...c, regra: regraPorId.get(c.regra_id) })) })
}

export const POST = async (req: AuthenticatedMedusaRequest<CriarCuradoBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const query: any = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const b = req.validatedBody

  const idsUnicos = Array.from(new Set(b.product_ids))
  if (idsUnicos.length < 2) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um conjunto curado precisa de pelo menos 2 produtos distintos.")

  const { data: produtos } = await query.graph({ entity: "product", fields: ["id", "status"], filters: { id: idsUnicos } })
  if (produtos.length !== idsUnicos.length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Um ou mais produtos não existem.")
  const naoPublicado = produtos.find((p: any) => p.status !== "published")
  if (naoPublicado) throw new MedusaError(MedusaError.Types.INVALID_DATA, `O produto ${naoPublicado.id} não está publicado.`)

  const handle = b.handle ?? slugificar(b.nome)
  if (!handle) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Não foi possível gerar um handle a partir do nome; informe um handle.")
  const jaExiste = await svc.listConjuntoCurados({ handle })
  if (jaExiste.length) throw new MedusaError(MedusaError.Types.DUPLICATE_ERROR, "Já existe um conjunto curado com este handle.")

  const regra = await svc.createConjuntoRegras({
    nome: b.nome,
    escopo: "curado",
    collection_id: null,
    tipo_desconto: b.tipo_desconto,
    valor: b.valor,
    ativa: b.ativo ?? true,
  })
  const curado = await svc.createConjuntoCurados({
    nome: b.nome,
    handle,
    capa_url: b.capa_url ?? null,
    product_ids: idsUnicos,
    regra_id: regra.id,
    ativo: b.ativo ?? true,
    ordem: b.ordem ?? 0,
  })
  await sincronizarPromocao(req.scope, regra.id)

  res.json({ curado: { ...(await svc.retrieveConjuntoCurado(curado.id)), regra: await svc.retrieveConjuntoRegra(regra.id) } })
}
