// Parceiras de um produto + curados que o incluem (Task 7). `parceirasDoProduto` (Task 6) devolve
// os curados "crus" (sem `regra` anexada, só `regra_id`) porque é usado também pela rota admin;
// aqui resolvemos a regra de cada curado e só listamos os com regra efetivamente ativa — mesma
// política de "vendável agora" que `listarConjuntos` aplica aos curados da vitrine principal.
// `regras` já vem no retorno de `parceirasDoProduto` (que internamente já chama `svc.carregarAtivos()`)
// — não chamamos `svc.carregarAtivos()` de novo aqui (fix round 1, achado "carga redundante em por-produto").
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { parceirasDoProduto } from "../../../../../modules/beneficio-conjunto/catalogo-conjuntos"
import type { Regra } from "../../../../../modules/beneficio-conjunto/utils/tipos"

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { product_id } = req.params
  const { parceiras, curados, regras } = await parceirasDoProduto(req.scope, product_id)

  const curadosVendaveis = curados
    .map((c) => ({ ...c, regra: regras.find((r) => r.id === c.regra_id) }))
    .filter((c): c is typeof c & { regra: Regra } => !!c.regra?.ativa)

  res.set("Cache-Control", "public, s-maxage=300, stale-while-revalidate=600")
  res.json({
    parceiras: parceiras.map((p) => ({ product_id: p.product_id, categoria_raiz: p.categoria_raiz })),
    curados: curadosVendaveis.map((c) => ({
      id: c.id,
      nome: c.nome,
      handle: c.handle,
      capa_url: c.capa_url,
      product_ids: c.product_ids,
      regra: { tipo_desconto: c.regra.tipo_desconto, valor: c.regra.valor },
    })),
  })
}
