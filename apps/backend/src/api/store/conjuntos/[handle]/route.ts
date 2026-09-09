// Página de um conjunto vendável (curado ou par de coleção) pelo handle canônico (Task 7).
// `conjuntoPorHandle` (Task 6) já resolve a ordem canônica só — handle invertido/curado
// inativo/produto despublicado devolvem `null` aqui, viram 404.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { conjuntoPorHandle } from "../../../../modules/beneficio-conjunto/catalogo-conjuntos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { handle } = req.params
  const conjunto = await conjuntoPorHandle(req.scope, handle)
  if (!conjunto) throw new MedusaError(MedusaError.Types.NOT_FOUND, `Conjunto ${handle} não encontrado.`)

  res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  res.json({
    conjunto: {
      tipo: conjunto.tipo,
      nome: conjunto.nome,
      handle,
      product_ids: conjunto.product_ids,
      regra: { tipo_desconto: conjunto.regra.tipo_desconto, valor: conjunto.regra.valor },
    },
  })
}
