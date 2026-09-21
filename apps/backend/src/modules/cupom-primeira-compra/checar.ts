// Parte com I/O da regra "cupom de primeira compra só para CPF sem pedido" (regra.ts tem a parte pura).
// Usada na criação da cobrança (api/middlewares/cupom-primeira-compra.ts) — e SÓ lá, de propósito:
// no fechamento o pagamento já foi feito (Pix pago → webhook fecha o carrinho); recusar ali deixaria
// dinheiro na conta sem pedido. Na corrida rara de dois carrinhos do mesmo CPF com cobrança criada
// antes de qualquer um fechar, o segundo passa: perder 10% uma vez é melhor que travar um Pix pago.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { avaliarCupomPrimeiraCompra, cuponsDePrimeiraCompra, mensagemCupomSoPrimeiraCompra, normalizarCpf } from "./regra"

/** Devolve a mensagem de recusa, ou `null` quando o carrinho pode seguir. */
export async function recusaPorCupomDePrimeiraCompra(container: MedusaContainer, cartId: string): Promise<string | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: ["id", "metadata", "promotions.code"],
    filters: { id: cartId },
  })
  const carrinho = data?.[0] as { metadata?: Record<string, unknown> | null; promotions?: { code?: string | null }[] } | undefined
  if (!carrinho) return null
  const cupons = (carrinho.promotions ?? []).map((p) => p?.code)
  if (!cuponsDePrimeiraCompra(cupons).length) return null // caminho comum: sem cupom de primeira compra, nenhuma consulta a mais

  const cpf = normalizarCpf(carrinho.metadata?.cpf)
  if (!cpf) return null // sem CPF ainda não há cobrança possível (a vitrine exige no endereço; o provider recusa sem ele)

  // Pedidos desse CPF: o CPF mora no metadata do pedido (JSON) — filtro direto no Postgres, que o
  // query.graph não faz. Cancelado não conta (compra desfeita não é "já comprou").
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION) as any
  const linhas = (await pg("order")
    .select("id")
    .whereRaw("metadata->>'cpf' = ?", [cpf])
    .whereNull("canceled_at")
    .whereNull("deleted_at")
    .limit(1)) as { id: string }[]

  const r = avaliarCupomPrimeiraCompra(cupons, linhas.length)
  return r.permitido ? null : mensagemCupomSoPrimeiraCompra(r.codigo)
}
