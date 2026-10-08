// Presente por faixa — a parte que toca o mundo (configuração no Supabase, carrinho e pedidos no Medusa).
// A regra pura está em modules/brinde/regra.ts. Desenho: docs/superpowers/specs/2026-09-30-brindes-por-faixa-design.md.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { sbSelect, supabaseConfigured } from "./supabase"
import { calcularBase, type ItemDaBase } from "../modules/superfrete/base-carrinho"
import { codigosDeEmbaixador } from "./embaixador"
import { lerConfig, type ConfigBrindes, type FaixaId, type LinhaDoCarrinho, type Usados } from "../modules/brinde/regra"

// A configuração muda raramente (Cockpit/script); 60 s de memória poupam uma ida ao Supabase por requisição.
let cache: { em: number; config: ConfigBrindes | null } | null = null

export async function configDaLoja(): Promise<ConfigBrindes | null> {
  if (cache && Date.now() - cache.em < 60_000) return cache.config
  let config: ConfigBrindes | null = null
  if (supabaseConfigured()) {
    try {
      const linhas = await sbSelect<{ value: unknown }>("site_content", "key=eq.brindes&select=value&limit=1")
      config = lerConfig(linhas[0]?.value)
    } catch (e) {
      console.error("[brinde] leitura da configuração", e)
      return cache?.config ?? null // sem Supabase, vale a última leitura boa (ou nada)
    }
  }
  cache = { em: Date.now(), config }
  return config
}

/** Presentes já dados desde `inicio` (pedidos não cancelados, marcados pelo subscriber brinde-pedido). */
export async function presentesUsados(scope: any, config: ConfigBrindes | null): Promise<Usados> {
  if (!config) return {}
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "order",
    fields: ["id", "status", "metadata"],
    filters: { created_at: { $gte: config.inicio } },
  })
  const usados: Usados = {}
  for (const o of data as { status?: string; metadata?: Record<string, unknown> | null }[]) {
    if (o.status === "canceled") continue
    const b = o.metadata?.brinde as FaixaId | undefined
    if (b === "meia" || b === "oculos") usados[b] = (usados[b] ?? 0) + 1
  }
  return usados
}

// `comEmbaixador`: carrinho com cupom de embaixador não ganha presente (dono, 2026-10-08, modules/embaixador/regra.ts).
export type CarrinhoDoPresente = { itens: LinhaDoCarrinho[]; base: number; comEmbaixador: boolean }

/** Configuração que vale PARA ESTE carrinho: a da loja, ou nenhuma (sem presente) se há cupom de embaixador. */
export async function configDoCarrinho(carrinho: CarrinhoDoPresente | null): Promise<ConfigBrindes | null> {
  if (carrinho?.comEmbaixador) return null
  return configDaLoja()
}

export async function carrinhoDoPresente(scope: any, cartId: string): Promise<CarrinhoDoPresente | null> {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "completed_at",
      "items.id",
      "items.variant_id",
      "items.product_handle",
      "items.unit_price",
      "items.quantity",
      "items.metadata",
      "items.adjustments.amount",
      "items.adjustments.code",
    ],
    filters: { id: cartId },
  })
  const cart = data?.[0]
  if (!cart) return null
  const itens = (cart.items ?? []) as (LinhaDoCarrinho & ItemDaBase)[]
  const codigos = itens.flatMap((i: any) => ((i.adjustments ?? []) as { code?: string | null }[]).map((a) => a?.code))
  const comEmbaixador = (await codigosDeEmbaixador(scope, codigos)).size > 0
  return { itens, base: calcularBase(itens), comEmbaixador }
}
