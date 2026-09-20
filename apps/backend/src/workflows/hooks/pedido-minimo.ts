import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { MedusaError } from "@medusajs/framework/utils"
import { avaliarMinimo, mensagemDoMinimo } from "../../modules/pedido-minimo/regra"

// Pedido mínimo (decisão do dono, 2026-09-20: R$ 150 em peças). A vitrine já trava o botão, mas
// quem fecha o pedido de verdade é o servidor: sem esta guarda bastaria chamar a Store API direto
// para furar o mínimo. Roda ANTES de qualquer efeito do fechamento (hook `validate`), então
// carrinho recusado não vira pedido, não reserva estoque e não cobra pagamento.
completeCartWorkflow.hooks.validate(async ({ cart }) => {
  const avaliacao = avaliarMinimo(((cart as any)?.items ?? []) as any[])
  if (avaliacao.atingiu) return
  throw new MedusaError(
    MedusaError.Types.NOT_ALLOWED,
    mensagemDoMinimo(avaliacao.falta, avaliacao.minimo)
  )
})
