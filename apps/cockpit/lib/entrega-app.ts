// Entrega por aplicativo no Cockpit: reconhecer o pedido e mostrar o aceite da cliente.
// O que o backend grava no método de entrega está em
// `apps/backend/src/modules/entrega-app/service.ts` (`validateFulfillmentData`).

export type MetodoDeEnvio = {
  shipping_option?: { provider_id?: string | null } | null
  data?: Record<string, unknown> | null
}

export type PedidoComEnvio = { shipping_methods?: MetodoDeEnvio[] | null }

function metodos(pedido: PedidoComEnvio | null | undefined): MetodoDeEnvio[] {
  return pedido?.shipping_methods ?? []
}

/** Reconhece pelo que o servidor gravou (`data.tipo`) ou pelo provider — nunca pelo nome, que é editável. */
export function ehEntregaPorApp(pedido: PedidoComEnvio | null | undefined): boolean {
  return metodos(pedido).some(
    (m) => m?.data?.tipo === "entrega_app" || (m?.shipping_option?.provider_id ?? "").includes("entrega-app")
  )
}

/** Data/hora do aceite em pt-BR, ou null quando o pedido não tem (pedido antigo, por exemplo). */
export function aceiteDaEntregaApp(pedido: PedidoComEnvio | null | undefined): string | null {
  for (const m of metodos(pedido)) {
    const quando = m?.data?.aceite_em
    if (typeof quando !== "string") continue
    const d = new Date(quando)
    if (Number.isNaN(d.getTime())) continue
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })
  }
  return null
}
