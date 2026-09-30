import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { container } from "@medusajs/framework"
import { MedusaError } from "@medusajs/framework/utils"
import { avaliarMinimo, mensagemDoMinimo } from "../../modules/pedido-minimo/regra"
import { carrinhoDoPresente, configDaLoja, presentesUsados } from "../../lib/brinde"
import { avaliarCarrinho, ehLinhaDePresente } from "../../modules/brinde/regra"

// Validação do FECHAMENTO do pedido. ATENÇÃO: o Medusa aceita UM só handler por hook — um segundo
// `completeCartWorkflow.hooks.validate` em outro arquivo derruba o servidor na subida ("Cannot define multiple
// hook handlers for the validate hook", deploy de 2026-09-30). Toda regra nova de fechamento entra AQUI.
// Roda ANTES de qualquer efeito do fechamento, então carrinho recusado não vira pedido, não reserva estoque e
// não cobra pagamento.
completeCartWorkflow.hooks.validate(async ({ cart }) => {
  // 1) Pedido mínimo (decisão do dono: R$ 100 em peças desde 2026-09-21; valor em modules/pedido-minimo/regra.ts).
  // A vitrine já trava o botão, mas sem esta guarda bastaria chamar a Store API direto para furar o mínimo.
  const avaliacao = avaliarMinimo(((cart as any)?.items ?? []) as any[])
  if (!avaliacao.atingiu) {
    throw new MedusaError(MedusaError.Types.NOT_ALLOWED, mensagemDoMinimo(avaliacao.falta, avaliacao.minimo))
  }

  // 2) Presente por faixa (2026-09-30), segunda tranca depois do middleware da cobrança.
  // Carrinho sem presente passa direto, sem consulta.
  const itens = ((cart as any)?.items ?? []) as { metadata?: Record<string, unknown> | null }[]
  if (!itens.some(ehLinhaDePresente)) return
  const carrinho = await carrinhoDoPresente(container, (cart as any).id)
  if (!carrinho) return
  const config = await configDaLoja()
  const presente = avaliarCarrinho(carrinho.itens, carrinho.base, config, await presentesUsados(container, config))
  if (!presente.ok) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, presente.motivo)
})
