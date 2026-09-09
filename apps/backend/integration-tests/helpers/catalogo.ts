// Catálogo para os testes de conjunto: região BRL, canal de vendas + chave publicável, duas
// coleções (Blackout/Lumière), categorias raiz (tops/leggings/shorts/macaquinhos + acessorios>oculos)
// e cinco produtos publicados, sem controle de estoque.
import type { AxiosInstance } from "axios"

export type Peca = { productId: string; variantId: string; preco: number }
export type CatalogoBase = {
  regionId: string
  salesChannelId: string
  publishableKey: string
  storeHeaders: Record<string, string>
  top: Peca
  legging: Peca
  short: Peca
  topLum: Peca
  macaquinho: Peca
  collections: { black: string; lum: string }
  categorias: { tops: string; leggings: string; shorts: string; macaquinhos: string }
}

async function criarProduto(
  api: AxiosInstance,
  headers: Record<string, string>,
  salesChannelId: string,
  titulo: string,
  handle: string,
  preco: number,
  collectionId: string,
  categoriaId: string
): Promise<Peca> {
  const res = await api.post(
    "/admin/products",
    {
      title: titulo,
      handle,
      status: "published",
      options: [{ title: "Tamanho", values: ["M"] }],
      variants: [{ title: "M", sku: `${handle}-m`, manage_inventory: false, options: { Tamanho: "M" }, prices: [{ amount: preco, currency_code: "brl" }] }],
      sales_channels: [{ id: salesChannelId }],
      collection_id: collectionId,
      categories: [{ id: categoriaId }],
    },
    { headers }
  )
  const p = res.data.product
  return { productId: p.id, variantId: p.variants[0].id, preco }
}

async function criarCategoria(api: AxiosInstance, headers: Record<string, string>, name: string, handle: string, parent_category_id?: string): Promise<string> {
  const res = await api.post("/admin/product-categories", { name, handle, is_active: true, ...(parent_category_id ? { parent_category_id } : {}) }, { headers })
  return res.data.product_category.id
}

async function criarColecao(api: AxiosInstance, headers: Record<string, string>, title: string, handle: string): Promise<string> {
  const res = await api.post("/admin/collections", { title, handle }, { headers })
  return res.data.collection.id
}

export async function criarCatalogoBase(api: AxiosInstance, headers: Record<string, string>): Promise<CatalogoBase> {
  const region = (await api.post("/admin/regions", { name: "Brasil", currency_code: "brl", countries: ["br"] }, { headers })).data.region
  const sc = (await api.post("/admin/sales-channels", { name: "Loja teste" }, { headers })).data.sales_channel
  const key = (await api.post("/admin/api-keys", { title: "pk teste", type: "publishable" }, { headers })).data.api_key
  await api.post(`/admin/api-keys/${key.id}/sales-channels`, { add: [sc.id] }, { headers })

  const black = await criarColecao(api, headers, "Blackout", "blackout")
  const lum = await criarColecao(api, headers, "Lumière", "lumiere")

  const tops = await criarCategoria(api, headers, "Tops", "tops")
  const leggings = await criarCategoria(api, headers, "Leggings", "leggings")
  const shorts = await criarCategoria(api, headers, "Shorts", "shorts")
  const macaquinhos = await criarCategoria(api, headers, "Macaquinhos", "macaquinhos")
  const acessorios = await criarCategoria(api, headers, "Acessórios", "acessorios")
  await criarCategoria(api, headers, "Óculos", "oculos", acessorios)

  const top = await criarProduto(api, headers, sc.id, "Top Aura", "top-aura", 189, black, tops)
  const legging = await criarProduto(api, headers, sc.id, "Legging Vértice", "legging-vertice", 259, black, leggings)
  const short = await criarProduto(api, headers, sc.id, "Short Nimble", "short-nimble", 159, black, shorts)
  const topLum = await criarProduto(api, headers, sc.id, "Top Lumière", "top-lumiere", 199, lum, tops)
  const macaquinho = await criarProduto(api, headers, sc.id, "Macaquinho Vero", "macaquinho-vero", 299, black, macaquinhos)

  return {
    regionId: region.id,
    salesChannelId: sc.id,
    publishableKey: key.token,
    storeHeaders: { "x-publishable-api-key": key.token },
    top,
    legging,
    short,
    topLum,
    macaquinho,
    collections: { black, lum },
    categorias: { tops, leggings, shorts, macaquinhos },
  }
}
