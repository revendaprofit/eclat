import { MedusaError, ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { avaliarLimite, limiteDoAmbiente, mensagemDoLimite, unidadesDaVariante } from "../../modules/limite-por-item/regra"

// Teto de unidades por variante na sacola (sócia, 2026-11-01; ver modules/limite-por-item/regra.ts).
//
// Duas portas: adicionar linha (POST /store/carts/:id/line-items, body {variant_id, quantity}) soma com o que
// já existe daquela variante; trocar quantidade (POST /store/carts/:id/line-items/:line_id, body {quantity})
// avalia o valor novo. Passou do teto → 400 com mensagem em pt-BR, antes de o Medusa tocar no carrinho.
// Falha ao consultar o carrinho não barra ninguém: segue o fluxo (o teto é proteção, não regra de venda).

export async function limitarUnidadesAoAdicionar(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const body = (req.body ?? {}) as { variant_id?: string; quantity?: number }
    const variantId = body.variant_id
    const nova = Number(body.quantity ?? 1)
    if (!variantId || !Number.isFinite(nova)) return next()
    const limite = limiteDoAmbiente()
    const cartId = req.params.id
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "cart",
      fields: ["id", "items.variant_id", "items.quantity", "items.unit_price"],
      filters: { id: cartId },
    })
    const carrinho = data?.[0]
    const existente = carrinho ? unidadesDaVariante(carrinho.items as Parameters<typeof unidadesDaVariante>[0], variantId) : 0
    const avaliacao = avaliarLimite(existente, nova, limite)
    if (avaliacao.permitido) return next()
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, mensagemDoLimite(limite)))
  } catch (e) {
    console.error("[limite-por-item] adicionar", e)
    return next()
  }
}

export async function limitarUnidadesAoTrocar(req: MedusaRequest, _res: MedusaResponse, next: MedusaNextFunction) {
  try {
    const body = (req.body ?? {}) as { quantity?: number }
    const nova = Number(body.quantity)
    if (!Number.isFinite(nova)) return next()
    const limite = limiteDoAmbiente()
    const avaliacao = avaliarLimite(0, nova, limite)
    if (avaliacao.permitido) return next()
    return next(new MedusaError(MedusaError.Types.NOT_ALLOWED, mensagemDoLimite(limite)))
  } catch (e) {
    console.error("[limite-por-item] trocar", e)
    return next()
  }
}
