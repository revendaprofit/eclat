import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { container } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import { carrinhoDoPresente, configDaLoja, presentesUsados } from "../../lib/brinde"
import { avaliarCarrinho, ehLinhaDePresente } from "../../modules/brinde/regra"

// Presente por faixa, segunda tranca: no fechamento do pedido. Carrinho sem presente passa direto (sem consulta).
completeCartWorkflow.hooks.validate(async ({ cart }) => {
  const itens = ((cart as any)?.items ?? []) as { metadata?: Record<string, unknown> | null }[]
  if (!itens.some(ehLinhaDePresente)) return
  const carrinho = await carrinhoDoPresente(container, (cart as any).id)
  if (!carrinho) return
  const config = await configDaLoja()
  const avaliacao = avaliarCarrinho(carrinho.itens, carrinho.base, config, await presentesUsados(container, config))
  if (avaliacao.ok) return
  throw new MedusaError(MedusaError.Types.NOT_ALLOWED, avaliacao.motivo)
})
