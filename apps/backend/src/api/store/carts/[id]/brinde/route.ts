// Presente por faixa na sacola (desenho: docs/superpowers/specs/2026-09-30-brindes-por-faixa-design.md).
//   GET    → estado: base, faixas liberadas, quanto falta para a próxima, presente atual e se ele ainda vale.
//   POST   { variant_id } → põe (ou troca) o presente, a R$ 0. Só esta rota fixa preço 0: a Store API padrão não
//          aceita preço vindo do navegador.
//   DELETE → tira o presente.
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { addToCartWorkflow, deleteLineItemsWorkflow } from "@medusajs/medusa/core-flows"
import { carrinhoDoPresente, configDoCarrinho, presentesUsados } from "../../../../../lib/brinde"
import { avaliarCarrinho, ehLinhaDePresente, faixasLiberadas, proximaFaixa } from "../../../../../modules/brinde/regra"

async function estado(req: MedusaRequest) {
  const cartId = req.params.id
  const carrinho = await carrinhoDoPresente(req.scope, cartId)
  if (!carrinho) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Carrinho não encontrado.")
  const config = await configDoCarrinho(carrinho)
  const usados = await presentesUsados(req.scope, config)
  return { cartId, carrinho, config, usados }
}

export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { carrinho, config, usados } = await estado(req)
  const presente = carrinho.itens.find(ehLinhaDePresente) ?? null
  const avaliacao = avaliarCarrinho(carrinho.itens, carrinho.base, config, usados)
  const proxima = proximaFaixa(carrinho.base, config, usados)
  res.json({
    ativo: !!config,
    base_centavos: carrinho.base,
    liberadas: faixasLiberadas(carrinho.base, config, usados).map((f) => ({
      id: f.id,
      minimo_centavos: f.minimo_centavos,
      product_handle: f.product_handle,
    })),
    proxima: proxima
      ? { id: proxima.faixa.id, minimo_centavos: proxima.faixa.minimo_centavos, falta_centavos: proxima.falta_centavos }
      : null,
    faixas: (config?.faixas ?? []).map((f) => ({ id: f.id, minimo_centavos: f.minimo_centavos, product_handle: f.product_handle })),
    presente: presente ? { line_item_id: presente.id, variant_id: presente.variant_id, faixa: presente.metadata?.brinde } : null,
    valido: avaliacao.ok,
    motivo: avaliacao.ok ? null : avaliacao.motivo,
  })
}

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const variantId = (req.body as { variant_id?: string } | undefined)?.variant_id
  if (!variantId || typeof variantId !== "string") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "Escolha o presente.")
  }
  const { cartId, carrinho, config, usados } = await estado(req)

  // Qual produto é esta variante? O presente só pode ser do produto de uma faixa liberada.
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data: variantes } = await query.graph({
    entity: "product_variant",
    fields: ["id", "product.handle"],
    filters: { id: variantId },
  })
  const handle = (variantes?.[0] as { product?: { handle?: string } } | undefined)?.product?.handle
  const faixa = faixasLiberadas(carrinho.base, config, usados).find((f) => f.product_handle === handle)
  if (!faixa) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Este presente não está liberado para esta sacola.")
  }

  const anteriores = carrinho.itens.filter(ehLinhaDePresente).map((i) => i.id!).filter(Boolean)
  if (anteriores.length) {
    await deleteLineItemsWorkflow(req.scope).run({ input: { cart_id: cartId, ids: anteriores } })
  }
  try {
    await addToCartWorkflow(req.scope).run({
      input: {
        cart_id: cartId,
        // unit_price definido = preço fixo (is_custom_price): o Medusa não reprecifica a linha depois.
        items: [{ variant_id: variantId, quantity: 1, unit_price: 0, metadata: { brinde: faixa.id } }],
      },
    })
  } catch (e) {
    // Sem estoque (allow_backorder = false) ou produto fora do ar.
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Esta opção de presente esgotou. Escolha outra.")
  }
  res.json({ ok: true, faixa: faixa.id })
}

export const DELETE = async (req: MedusaRequest, res: MedusaResponse) => {
  const { cartId, carrinho } = await estado(req)
  const ids = carrinho.itens.filter(ehLinhaDePresente).map((i) => i.id!).filter(Boolean)
  if (ids.length) await deleteLineItemsWorkflow(req.scope).run({ input: { cart_id: cartId, ids } })
  res.json({ ok: true, removidos: ids.length })
}
