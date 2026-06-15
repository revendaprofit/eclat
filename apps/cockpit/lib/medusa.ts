// Acesso à Medusa Admin API a partir do cockpit (server-side).
// Login programático (jeito mais simples) com token em cache curto.

const URL = process.env.MEDUSA_ADMIN_URL
const EMAIL = process.env.MEDUSA_ADMIN_EMAIL
const PASSWORD = process.env.MEDUSA_ADMIN_PASSWORD

let cachedToken: string | null = null
let tokenAt = 0

export async function medusaAdminToken(): Promise<string> {
  if (cachedToken && Date.now() - tokenAt < 10 * 60 * 1000) return cachedToken
  const r = await fetch(`${URL}/auth/user/emailpass`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  })
  if (!r.ok) throw new Error(`login Medusa falhou (HTTP ${r.status})`)
  const { token } = await r.json()
  cachedToken = token
  tokenAt = Date.now()
  return token
}

export async function medusaCreateCustomer(input: {
  email: string
  first_name?: string
  last_name?: string
  phone?: string
}): Promise<{ id: string }> {
  const token = await medusaAdminToken()
  const r = await fetch(`${URL}/admin/customers`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(`criar cliente falhou (HTTP ${r.status}): ${await r.text()}`)
  const { customer } = await r.json()
  return customer
}

// ---- Helper genérico para a Admin API (já autenticado) ----
export async function medusaAdmin(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const token = await medusaAdminToken()
  return fetch(`${URL}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  })
}

// ---- Produtos & Estoque (Fase 3) ----

// id da stock location padrão (CD Brasil), em cache (não muda em runtime)
let cachedLocationId: string | null = null
export async function medusaDefaultLocationId(): Promise<string> {
  if (cachedLocationId) return cachedLocationId
  const r = await medusaAdmin(`/admin/stock-locations?limit=1`)
  if (!r.ok) throw new Error(`stock-locations falhou (HTTP ${r.status})`)
  const { stock_locations } = await r.json()
  const id = stock_locations?.[0]?.id
  if (!id) throw new Error("Nenhuma stock location encontrada no Medusa.")
  cachedLocationId = id
  return id
}

export type CockpitVariant = {
  id: string
  title: string | null
  sku: string | null
  price: number | null // BRL (decimal)
  price_id: string | null
  inventory_item_id: string | null
  stock: number | null
}

export type CockpitRef = { id: string; name: string }
export type CockpitProduct = {
  id: string
  title: string
  description: string | null
  status: string
  thumbnail: string | null
  collection: string | null
  collection_id: string | null
  categories: CockpitRef[]
  tags: CockpitRef[]
  created_at: string | null
  variants: CockpitVariant[]
}

const PRODUCT_FIELDS = [
  "id",
  "title",
  "description",
  "status",
  "thumbnail",
  "created_at",
  "collection.id",
  "collection.title",
  "categories.id",
  "categories.name",
  "tags.id",
  "tags.value",
  "variants.id",
  "variants.title",
  "variants.sku",
  "variants.prices.id",
  "variants.prices.amount",
  "variants.prices.currency_code",
  "variants.inventory_items.inventory_item_id",
  "variants.inventory_items.inventory.location_levels.stocked_quantity",
  "variants.inventory_items.inventory.location_levels.location_id",
].join(",")

type RawPrice = { id: string; amount: number; currency_code: string }
type RawLevel = { stocked_quantity: number; location_id: string }
type RawVariant = {
  id: string
  title: string | null
  sku: string | null
  prices?: RawPrice[]
  inventory_items?: {
    inventory_item_id: string
    inventory?: { location_levels?: RawLevel[] }
  }[]
}
type RawProduct = {
  id: string
  title: string
  description?: string | null
  status: string
  thumbnail: string | null
  created_at?: string | null
  collection?: { id: string; title: string } | null
  categories?: { id: string; name: string }[]
  tags?: { id: string; value: string }[]
  variants?: RawVariant[]
}

function mapProduct(p: RawProduct, locationId: string): CockpitProduct {
  return {
    id: p.id,
    title: p.title,
    description: p.description ?? null,
    status: p.status,
    thumbnail: p.thumbnail,
    collection: p.collection?.title ?? null,
    collection_id: p.collection?.id ?? null,
    categories: (p.categories ?? []).map((c) => ({ id: c.id, name: c.name })),
    tags: (p.tags ?? []).map((t) => ({ id: t.id, name: t.value })),
    created_at: p.created_at ?? null,
    variants: (p.variants ?? []).map((v) => {
      const brl = (v.prices ?? []).find((pr) => pr.currency_code === "brl")
      const inv = v.inventory_items?.[0]
      const level = inv?.inventory?.location_levels?.find(
        (l) => l.location_id === locationId
      )
      return {
        id: v.id,
        title: v.title,
        sku: v.sku,
        price: brl?.amount ?? null,
        price_id: brl?.id ?? null,
        inventory_item_id: inv?.inventory_item_id ?? null,
        stock: level?.stocked_quantity ?? null,
      }
    }),
  }
}

export async function medusaListProducts(
  q?: string
): Promise<CockpitProduct[]> {
  const locationId = await medusaDefaultLocationId()
  const params = new URLSearchParams({ limit: "100", fields: PRODUCT_FIELDS })
  if (q) params.set("q", q)
  const r = await medusaAdmin(`/admin/products?${params.toString()}`)
  if (!r.ok) throw new Error(`listar produtos falhou (HTTP ${r.status})`)
  const { products } = (await r.json()) as { products: RawProduct[] }
  return products.map((p) => mapProduct(p, locationId))
}

export async function medusaUpdateVariantPrice(
  productId: string,
  variantId: string,
  amount: number
): Promise<void> {
  const r = await medusaAdmin(
    `/admin/products/${productId}/variants/${variantId}`,
    {
      method: "POST",
      body: JSON.stringify({ prices: [{ amount, currency_code: "brl" }] }),
    }
  )
  if (!r.ok)
    throw new Error(`atualizar preço falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaUpdateStock(
  inventoryItemId: string,
  stockedQuantity: number
): Promise<void> {
  const locationId = await medusaDefaultLocationId()
  const r = await medusaAdmin(
    `/admin/inventory-items/${inventoryItemId}/location-levels/${locationId}`,
    {
      method: "POST",
      body: JSON.stringify({ stocked_quantity: stockedQuantity }),
    }
  )
  if (!r.ok)
    throw new Error(`atualizar estoque falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaUpdateProductStatus(
  productId: string,
  status: "published" | "draft"
): Promise<void> {
  const r = await medusaAdmin(`/admin/products/${productId}`, {
    method: "POST",
    body: JSON.stringify({ status }),
  })
  if (!r.ok)
    throw new Error(`atualizar status falhou (HTTP ${r.status}): ${await r.text()}`)
}

// ---- Bloco A: criar/editar produto, taxonomias ----

// Contexto necessário para criar produto (sales channel + shipping profile), em cache.
let cachedCtx: { salesChannelId: string; shippingProfileId: string } | null = null
export async function medusaCreateContext() {
  if (cachedCtx) return cachedCtx
  const [sc, sp] = await Promise.all([
    medusaAdmin(`/admin/sales-channels?limit=1&fields=id`),
    medusaAdmin(`/admin/shipping-profiles?limit=1&fields=id`),
  ])
  const salesChannelId = (await sc.json()).sales_channels?.[0]?.id
  const shippingProfileId = (await sp.json()).shipping_profiles?.[0]?.id
  if (!salesChannelId || !shippingProfileId)
    throw new Error("Sales channel ou shipping profile não encontrados no Medusa.")
  cachedCtx = { salesChannelId, shippingProfileId }
  return cachedCtx
}

export async function medusaListCollections(): Promise<CockpitRef[]> {
  const r = await medusaAdmin(`/admin/collections?limit=100&fields=id,title`)
  if (!r.ok) throw new Error(`listar coleções falhou (HTTP ${r.status})`)
  const { collections } = (await r.json()) as { collections: { id: string; title: string }[] }
  return collections.map((c) => ({ id: c.id, name: c.title }))
}

export type CockpitCategory = {
  id: string
  name: string
  parent_id: string | null
  rank: number
}

export async function medusaListCategories(): Promise<CockpitCategory[]> {
  const r = await medusaAdmin(
    `/admin/product-categories?limit=200&fields=id,name,parent_category_id,rank`
  )
  if (!r.ok) throw new Error(`listar categorias falhou (HTTP ${r.status})`)
  const { product_categories } = (await r.json()) as {
    product_categories: { id: string; name: string; parent_category_id: string | null; rank: number }[]
  }
  return product_categories.map((c) => ({
    id: c.id,
    name: c.name,
    parent_id: c.parent_category_id ?? null,
    rank: c.rank ?? 0,
  }))
}

export async function medusaCreateCategory(input: {
  name: string
  parent_id?: string | null
}): Promise<{ id: string }> {
  const r = await medusaAdmin(`/admin/product-categories`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      is_active: true,
      parent_category_id: input.parent_id || null,
    }),
  })
  if (!r.ok) throw new Error(`criar categoria falhou (HTTP ${r.status}): ${await r.text()}`)
  return (await r.json()).product_category
}

export async function medusaUpdateCategory(
  id: string,
  fields: { name?: string; parent_id?: string | null }
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (fields.name !== undefined) body.name = fields.name
  if (fields.parent_id !== undefined) body.parent_category_id = fields.parent_id || null
  const r = await medusaAdmin(`/admin/product-categories/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`atualizar categoria falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaDeleteCategory(id: string): Promise<void> {
  const r = await medusaAdmin(`/admin/product-categories/${id}`, { method: "DELETE" })
  if (!r.ok) throw new Error(`excluir categoria falhou (HTTP ${r.status}): ${await r.text()}`)
}

// ---- Coleções (gestão) ----
export type CockpitCollection = { id: string; title: string; handle: string }

export async function medusaListCollectionsManage(): Promise<CockpitCollection[]> {
  const r = await medusaAdmin(`/admin/collections?limit=200&fields=id,title,handle`)
  if (!r.ok) throw new Error(`listar coleções falhou (HTTP ${r.status})`)
  const { collections } = (await r.json()) as {
    collections: { id: string; title: string; handle: string }[]
  }
  return collections
}

export async function medusaCreateCollection(input: {
  title: string
  handle: string
}): Promise<{ id: string }> {
  const r = await medusaAdmin(`/admin/collections`, {
    method: "POST",
    body: JSON.stringify({ title: input.title, handle: input.handle }),
  })
  if (!r.ok) throw new Error(`criar coleção falhou (HTTP ${r.status}): ${await r.text()}`)
  return (await r.json()).collection
}

export async function medusaUpdateCollection(
  id: string,
  fields: { title?: string; handle?: string }
): Promise<void> {
  const r = await medusaAdmin(`/admin/collections/${id}`, {
    method: "POST",
    body: JSON.stringify(fields),
  })
  if (!r.ok) throw new Error(`atualizar coleção falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaDeleteCollection(id: string): Promise<void> {
  const r = await medusaAdmin(`/admin/collections/${id}`, { method: "DELETE" })
  if (!r.ok) throw new Error(`excluir coleção falhou (HTTP ${r.status}): ${await r.text()}`)
}

// ---- Tags ----
export async function medusaListTags(): Promise<CockpitRef[]> {
  const r = await medusaAdmin(`/admin/product-tags?limit=200&fields=id,value`)
  if (!r.ok) throw new Error(`listar tags falhou (HTTP ${r.status})`)
  const { product_tags } = (await r.json()) as { product_tags: { id: string; value: string }[] }
  return product_tags.map((t) => ({ id: t.id, name: t.value }))
}

export async function medusaCreateTag(value: string): Promise<{ id: string }> {
  const r = await medusaAdmin(`/admin/product-tags`, {
    method: "POST",
    body: JSON.stringify({ value }),
  })
  if (!r.ok) throw new Error(`criar tag falhou (HTTP ${r.status}): ${await r.text()}`)
  return (await r.json()).product_tag
}

export async function medusaUpdateTag(id: string, value: string): Promise<void> {
  const r = await medusaAdmin(`/admin/product-tags/${id}`, {
    method: "POST",
    body: JSON.stringify({ value }),
  })
  if (!r.ok) throw new Error(`atualizar tag falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaDeleteTag(id: string): Promise<void> {
  const r = await medusaAdmin(`/admin/product-tags/${id}`, { method: "DELETE" })
  if (!r.ok) throw new Error(`excluir tag falhou (HTTP ${r.status}): ${await r.text()}`)
}

// ---- Fase 4: Clientes / Pedidos ----

export type CockpitCustomer = {
  id: string
  first_name: string | null
  last_name: string | null
  email: string
  phone: string | null
  created_at: string
}

export type CockpitOrder = {
  id: string
  display_id: number
  total: number
  currency_code: string
  status: string
  payment_status: string
  fulfillment_status: string
  created_at: string
  email: string | null
  customer_id: string | null
}

export async function medusaListCustomers(): Promise<CockpitCustomer[]> {
  const r = await medusaAdmin(
    `/admin/customers?limit=500&fields=id,first_name,last_name,email,phone,created_at`
  )
  if (!r.ok) throw new Error(`listar clientes falhou (HTTP ${r.status})`)
  return (await r.json()).customers
}

const ORDER_FIELDS =
  "id,display_id,total,currency_code,status,payment_status,fulfillment_status,created_at,email,customer_id"

export async function medusaListOrders(): Promise<CockpitOrder[]> {
  const r = await medusaAdmin(
    `/admin/orders?limit=500&order=-created_at&fields=${ORDER_FIELDS}`
  )
  if (!r.ok) throw new Error(`listar pedidos falhou (HTTP ${r.status})`)
  return (await r.json()).orders
}

// Pedidos do período com os campos necessários ao DRE (receita, frete, itens p/ COGS).
export type DreOrder = {
  display_id: number
  status: string
  payment_status: string
  item_subtotal: number
  shipping_total: number
  created_at: string
  items: { variant_id: string | null; quantity: number }[]
}
export async function medusaOrdersForDre(de: string, ate: string): Promise<DreOrder[]> {
  const params = new URLSearchParams({ limit: "1000", order: "-created_at" })
  params.set("created_at[$gte]", `${de}T00:00:00`)
  params.set("created_at[$lte]", `${ate}T23:59:59`)
  params.set(
    "fields",
    "display_id,status,payment_status,item_subtotal,shipping_total,created_at,items.variant_id,items.quantity"
  )
  const r = await medusaAdmin(`/admin/orders?${params.toString()}`)
  if (!r.ok) throw new Error(`pedidos do período falhou (HTTP ${r.status})`)
  return (await r.json()).orders
}

export async function medusaOrdersByCustomer(customerId: string): Promise<CockpitOrder[]> {
  const r = await medusaAdmin(
    `/admin/orders?customer_id=${customerId}&order=-created_at&fields=${ORDER_FIELDS}`
  )
  if (!r.ok) throw new Error(`pedidos do cliente falhou (HTTP ${r.status})`)
  return (await r.json()).orders
}

export type CustomerAddress = {
  city: string | null
  province: string | null
  address_1: string | null
  postal_code: string | null
  country_code: string | null
}

export type OrderItem = {
  id: string
  title: string
  variant_title: string | null
  quantity: number
  unit_price: number
  total: number
}
export type OrderFulfillment = {
  id: string
  shipped_at: string | null
  delivered_at: string | null
  canceled_at: string | null
  labels: { tracking_number: string | null; tracking_url: string | null; label_url: string | null }[]
}
export type OrderAddress = {
  first_name: string | null
  last_name: string | null
  address_1: string | null
  city: string | null
  province: string | null
  postal_code: string | null
  country_code: string | null
  phone: string | null
}
export type CockpitOrderDetail = CockpitOrder & {
  status: string
  subtotal: number
  shipping_total: number
  tax_total: number
  items: OrderItem[]
  shipping_address: OrderAddress | null
  shipping_methods: { name: string; total: number }[]
  fulfillments: OrderFulfillment[]
}

export async function medusaGetOrder(id: string): Promise<CockpitOrderDetail> {
  const fields =
    "id,display_id,status,payment_status,fulfillment_status,email,customer_id,currency_code,created_at,subtotal,shipping_total,tax_total,total," +
    "items.id,items.title,items.variant_title,items.quantity,items.unit_price,items.total," +
    "shipping_address.first_name,shipping_address.last_name,shipping_address.address_1,shipping_address.city,shipping_address.province,shipping_address.postal_code,shipping_address.country_code,shipping_address.phone," +
    "shipping_methods.name,shipping_methods.total," +
    "fulfillments.id,fulfillments.shipped_at,fulfillments.delivered_at,fulfillments.canceled_at,fulfillments.labels.tracking_number,fulfillments.labels.tracking_url,fulfillments.labels.label_url"
  const r = await medusaAdmin(`/admin/orders/${id}?fields=${fields}`)
  if (!r.ok) throw new Error(`buscar pedido falhou (HTTP ${r.status})`)
  return (await r.json()).order
}

// ---- Despacho (fulfillment + shipment) ----
// Cria o fulfillment de TODOS os itens do pedido e devolve o id do fulfillment criado.
export async function medusaFulfillOrder(
  orderId: string,
  items: { id: string; quantity: number }[]
): Promise<string> {
  const locationId = await medusaDefaultLocationId()
  const r = await medusaAdmin(`/admin/orders/${orderId}/fulfillments`, {
    method: "POST",
    body: JSON.stringify({ items, location_id: locationId }),
  })
  if (!r.ok) throw new Error(`criar fulfillment falhou (HTTP ${r.status}): ${await r.text()}`)
  // descobre o fulfillment recém-criado (não cancelado, ainda não enviado)
  const g = await medusaAdmin(
    `/admin/orders/${orderId}?fields=fulfillments.id,fulfillments.shipped_at,fulfillments.canceled_at,fulfillments.created_at`
  )
  const fs = ((await g.json()).order?.fulfillments ?? []) as {
    id: string
    shipped_at: string | null
    canceled_at: string | null
    created_at: string
  }[]
  const aberto = fs
    .filter((f) => !f.canceled_at && !f.shipped_at)
    .sort((a, b) => (b.created_at ?? "").localeCompare(a.created_at ?? ""))[0]
  if (!aberto) throw new Error("fulfillment criado mas não localizado")
  return aberto.id
}

// Marca o fulfillment como enviado, com rótulo de rastreio (opcional).
export async function medusaShipFulfillment(
  orderId: string,
  fulfillmentId: string,
  items: { id: string; quantity: number }[],
  label?: { tracking_number: string; tracking_url: string; label_url: string }
): Promise<void> {
  const body: Record<string, unknown> = { items }
  if (label?.tracking_number) body.labels = [label]
  const r = await medusaAdmin(
    `/admin/orders/${orderId}/fulfillments/${fulfillmentId}/shipments`,
    { method: "POST", body: JSON.stringify(body) }
  )
  if (!r.ok) throw new Error(`marcar envio falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaGetCustomer(id: string): Promise<{
  customer: CockpitCustomer
  addresses: CustomerAddress[]
}> {
  const r = await medusaAdmin(
    `/admin/customers/${id}?fields=id,first_name,last_name,email,phone,created_at,addresses.city,addresses.province,addresses.address_1,addresses.postal_code,addresses.country_code`
  )
  if (!r.ok) throw new Error(`buscar cliente falhou (HTTP ${r.status})`)
  const c = (await r.json()).customer
  return {
    customer: {
      id: c.id,
      first_name: c.first_name,
      last_name: c.last_name,
      email: c.email,
      phone: c.phone,
      created_at: c.created_at,
    },
    addresses: c.addresses ?? [],
  }
}

export type NewProductInput = {
  title: string
  handle: string
  description?: string
  status: "published" | "draft"
  collection_id?: string | null
  category_ids?: string[]
  weight?: number | null
  metadata?: Record<string, string>
  thumbnail?: string | null
  options: { title: string; values: string[] }[]
  variants: {
    title: string
    sku: string
    options: Record<string, string>
    price: number
    stock: number
  }[]
}

export async function medusaCreateProduct(
  input: NewProductInput
): Promise<{ id: string; variants: { id: string; sku: string | null }[] }> {
  const ctx = await medusaCreateContext()
  const body = {
    title: input.title,
    handle: input.handle,
    description: input.description || undefined,
    status: input.status,
    shipping_profile_id: ctx.shippingProfileId,
    collection_id: input.collection_id || undefined,
    categories: input.category_ids?.length
      ? input.category_ids.map((id) => ({ id }))
      : undefined,
    weight: input.weight || undefined,
    metadata: input.metadata && Object.keys(input.metadata).length ? input.metadata : undefined,
    thumbnail: input.thumbnail || undefined,
    images: input.thumbnail ? [{ url: input.thumbnail }] : undefined,
    options: input.options,
    variants: input.variants.map((v) => ({
      title: v.title,
      sku: v.sku || undefined,
      options: v.options,
      prices: [{ amount: v.price, currency_code: "brl" }],
    })),
    sales_channels: [{ id: ctx.salesChannelId }],
  }
  const r = await medusaAdmin(`/admin/products`, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`criar produto falhou (HTTP ${r.status}): ${await r.text()}`)
  const { product } = (await r.json()) as { product: { id: string } }

  // estoque inicial: localizar inventory_item por SKU e criar o nível
  const locationId = await medusaDefaultLocationId()
  const gr = await medusaAdmin(
    `/admin/products/${product.id}?fields=variants.id,variants.sku,variants.inventory_items.inventory_item_id`
  )
  const full = (await gr.json()) as {
    product: {
      variants: {
        id: string
        sku: string | null
        inventory_items?: { inventory_item_id: string }[]
      }[]
    }
  }
  for (const v of input.variants) {
    if (!(v.stock > 0)) continue
    const match = full.product.variants.find((mv) => mv.sku === v.sku)
    const iid = match?.inventory_items?.[0]?.inventory_item_id
    if (!iid) continue
    await medusaAdmin(`/admin/inventory-items/${iid}/location-levels`, {
      method: "POST",
      body: JSON.stringify({ location_id: locationId, stocked_quantity: Math.round(v.stock) }),
    })
  }
  return {
    id: product.id,
    variants: full.product.variants.map((v) => ({ id: v.id, sku: v.sku })),
  }
}

export type ProductDetail = {
  id: string
  title: string
  handle: string
  description: string | null
  status: string
  collection_id: string | null
  category_ids: string[]
  weight: number | null
  thumbnail: string | null
  metadata: Record<string, string>
}

export async function medusaGetProduct(id: string): Promise<ProductDetail> {
  const r = await medusaAdmin(
    `/admin/products/${id}?fields=id,title,handle,description,status,weight,thumbnail,collection.id,categories.id,metadata`
  )
  if (!r.ok) throw new Error(`buscar produto falhou (HTTP ${r.status})`)
  const { product: p } = (await r.json()) as {
    product: {
      id: string
      title: string
      handle: string
      description: string | null
      status: string
      weight: number | null
      thumbnail: string | null
      collection?: { id: string } | null
      categories?: { id: string }[]
      metadata: Record<string, string> | null
    }
  }
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    description: p.description,
    status: p.status,
    collection_id: p.collection?.id ?? null,
    category_ids: (p.categories ?? []).map((c) => c.id),
    weight: p.weight,
    thumbnail: p.thumbnail,
    metadata: p.metadata ?? {},
  }
}

export async function medusaUpdateProduct(
  id: string,
  fields: {
    title?: string
    handle?: string
    description?: string | null
    collection_id?: string | null
    category_ids?: string[]
    weight?: number | null
    metadata?: Record<string, string>
    thumbnail?: string | null
  }
): Promise<void> {
  const body: Record<string, unknown> = { ...fields }
  if ("category_ids" in fields && fields.category_ids)
    body.categories = fields.category_ids.map((cid) => ({ id: cid }))
  delete body.category_ids
  if (fields.thumbnail) body.images = [{ url: fields.thumbnail }]
  const r = await medusaAdmin(`/admin/products/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`atualizar produto falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaDeleteProduct(id: string): Promise<void> {
  const r = await medusaAdmin(`/admin/products/${id}`, { method: "DELETE" })
  if (!r.ok) throw new Error(`excluir produto falhou (HTTP ${r.status}): ${await r.text()}`)
}
