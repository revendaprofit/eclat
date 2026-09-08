// Catálogo mínimo para os testes de conjunto: região BRL, canal de vendas + chave publicável,
// dois produtos publicados (Top R$ 189, Legging R$ 259), sem controle de estoque.
import type { AxiosInstance } from "axios"

export type Peca = { productId: string; variantId: string; preco: number }
export type CatalogoBase = {
  regionId: string
  salesChannelId: string
  publishableKey: string
  storeHeaders: Record<string, string>
  top: Peca
  legging: Peca
}

async function criarProduto(api: AxiosInstance, headers: Record<string, string>, salesChannelId: string, titulo: string, handle: string, preco: number): Promise<Peca> {
  const res = await api.post(
    "/admin/products",
    {
      title: titulo,
      handle,
      status: "published",
      options: [{ title: "Tamanho", values: ["M"] }],
      variants: [{ title: "M", sku: `${handle}-m`, manage_inventory: false, options: { Tamanho: "M" }, prices: [{ amount: preco, currency_code: "brl" }] }],
      sales_channels: [{ id: salesChannelId }],
    },
    { headers }
  )
  const p = res.data.product
  return { productId: p.id, variantId: p.variants[0].id, preco }
}

export async function criarCatalogoBase(api: AxiosInstance, headers: Record<string, string>): Promise<CatalogoBase> {
  const region = (await api.post("/admin/regions", { name: "Brasil", currency_code: "brl", countries: ["br"] }, { headers })).data.region
  const sc = (await api.post("/admin/sales-channels", { name: "Loja teste" }, { headers })).data.sales_channel
  const key = (await api.post("/admin/api-keys", { title: "pk teste", type: "publishable" }, { headers })).data.api_key
  await api.post(`/admin/api-keys/${key.id}/sales-channels`, { add: [sc.id] }, { headers })
  const top = await criarProduto(api, headers, sc.id, "Top Aura", "top-aura", 189)
  const legging = await criarProduto(api, headers, sc.id, "Legging Vértice", "legging-vertice", 259)
  return {
    regionId: region.id,
    salesChannelId: sc.id,
    publishableKey: key.token,
    storeHeaders: { "x-publishable-api-key": key.token },
    top,
    legging,
  }
}
