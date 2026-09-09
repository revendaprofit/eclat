// Vitrine do Benefício Conjunto (Task 7, ruling 1 — estrutura + ids; quem hidrata título/imagem/
// preço é a vitrine via Store Products API). Reaproveita listarConjuntos (Task 6) sem repetir
// nenhuma leitura de catálogo aqui.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listarConjuntos } from "../../../modules/beneficio-conjunto/catalogo-conjuntos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { curados, colecoes } = await listarConjuntos(req.scope)

  res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  res.json({
    curados: curados.map((c) => ({
      id: c.id,
      nome: c.nome,
      handle: c.handle,
      capa_url: c.capa_url,
      product_ids: c.product_ids,
      regra: { tipo_desconto: c.regra.tipo_desconto, valor: c.regra.valor },
    })),
    colecoes,
  })
}
