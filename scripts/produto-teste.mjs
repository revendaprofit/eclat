// Produto de teste para compra real em produção (architecture: metadata.oculto — ver
// apps/storefront/src/lib/util/produto-oculto.ts). O produto fica publicado e comprável
// só pelo link direto; não aparece em vitrine, sitemap nem feeds.
//
// Uso (da raiz do repo; lê apps/cockpit/.env.local):
//   node scripts/produto-teste.mjs               simula: mostra o que faria, não grava
//   node scripts/produto-teste.mjs --aplicar     cria o produto e põe estoque
//   node scripts/produto-teste.mjs --despublicar vira rascunho (some até do link direto)
//   node scripts/produto-teste.mjs --publicar    volta a publicado
//   node scripts/produto-teste.mjs --remover     apaga o produto
// O backend vem de MEDUSA_ADMIN_URL do ambiente (sobrescreva para apontar à produção);
// sem isso vale o do .env.local, que é o Medusa local.
import fs from "node:fs"

const env = Object.fromEntries(
  fs.readFileSync("apps/cockpit/.env.local", "utf8").split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")] })
)
const BASE = (process.env.MEDUSA_ADMIN_URL || env.MEDUSA_ADMIN_URL).replace(/\/$/, "")
const modo = process.argv.slice(2).find((a) => a.startsWith("--")) ?? "--simular"

const HANDLE = "teste-interno"
const PRECO = Number(process.env.PRECO_TESTE || 1) // em reais (Medusa 2 guarda o valor cheio)
const ESTOQUE = 5
const FOTO_DE = "top-aurora" // reaproveita fotos de um produto real, só da cor abaixo
const COR = "Telha"
const TAMANHOS = ["P", "M", "G"]

let token
async function api(path, init = {}) {
  const r = await fetch(BASE + path, {
    ...init,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: init.body ? JSON.stringify(init.body) : undefined,
  })
  const t = await r.text()
  if (!r.ok) throw new Error(`${init.method || "GET"} ${path}: ${r.status} ${t.slice(0, 400)}`)
  return t ? JSON.parse(t) : null
}

token = (await api("/auth/user/emailpass", { method: "POST", body: { email: env.MEDUSA_ADMIN_EMAIL, password: env.MEDUSA_ADMIN_PASSWORD } })).token
console.log(`backend: ${BASE}\nmodo: ${modo}`)

const existente = (await api(`/admin/products?handle=${HANDLE}&fields=id,status,handle`)).products[0]

if (modo === "--despublicar" || modo === "--publicar" || modo === "--remover") {
  if (!existente) { console.log("produto de teste não existe; nada a fazer"); process.exit(0) }
  if (modo === "--remover") {
    await api(`/admin/products/${existente.id}`, { method: "DELETE" })
    console.log(`removido: ${existente.id}`)
  } else {
    const status = modo === "--publicar" ? "published" : "draft"
    await api(`/admin/products/${existente.id}`, { method: "POST", body: { status } })
    console.log(`status agora: ${status}`)
  }
  process.exit(0)
}

// Estoque idempotente: cria o nível no local; se já existe, só acerta a quantidade.
async function garantirEstoque(variants, localId) {
  for (const v of variants) {
    const item = v.inventory_items?.[0]?.inventory_item_id
    if (!item) throw new Error(`variante ${v.sku} sem item de estoque`)
    const corpo = { stocked_quantity: ESTOQUE }
    await api(`/admin/inventory-items/${item}/location-levels`, { method: "POST", body: { location_id: localId, ...corpo } })
      .catch(() => api(`/admin/inventory-items/${item}/location-levels/${localId}`, { method: "POST", body: corpo }))
  }
}

if (existente) {
  console.log(`já existe (${existente.id}, ${existente.status}); não crio outro`)
  if (modo === "--aplicar") {
    const { product } = await api(`/admin/products/${existente.id}?fields=id,*variants,*variants.inventory_items`)
    const { stock_locations } = await api("/admin/stock-locations")
    await garantirEstoque(product.variants, stock_locations[0].id)
    console.log(`estoque conferido: ${ESTOQUE} por tamanho`)
  }
  process.exit(0)
}

const [{ sales_channels }, { shipping_profiles }, { stock_locations }, { products: [modelo] }] = await Promise.all([
  api("/admin/sales-channels"), api("/admin/shipping-profiles"), api("/admin/stock-locations"),
  api(`/admin/products?handle=${FOTO_DE}&fields=id,*images`),
])
const canal = sales_channels[0], perfil = shipping_profiles.find((p) => p.type === "default") ?? shipping_profiles[0], local = stock_locations[0]
const fotos = (modelo?.images ?? []).map((i) => i.url).filter((u) => u.toLowerCase().includes(`/${COR.toLowerCase()}-`)).slice(0, 3)
if (!canal || !perfil || !local) throw new Error("faltou canal de venda, perfil de frete ou local de estoque")

const produto = {
  title: "Peça de teste ÉCLAT",
  handle: HANDLE,
  subtitle: "Uso interno",
  description: "Item interno para conferir a compra de ponta a ponta. Não é um produto à venda.",
  status: "published",
  discountable: true,
  weight: 200,
  thumbnail: fotos[0],
  images: fotos.map((url) => ({ url })),
  metadata: { oculto: true, teste_interno: true },
  sales_channels: [{ id: canal.id }],
  shipping_profile_id: perfil.id,
  options: [{ title: "Cor", values: [COR] }, { title: "Tamanho", values: TAMANHOS }],
  variants: TAMANHOS.map((t) => ({
    title: `${t} / ${COR}`,
    sku: `ECL-TESTE-${t}`,
    manage_inventory: true,
    allow_backorder: false,
    weight: 200, // gramas, na VARIANTE: é dela que o cálculo de frete (SuperFrete) lê o peso
    options: { Cor: COR, Tamanho: t },
    prices: [{ currency_code: "brl", amount: PRECO }],
  })),
}

console.log(`\ncanal: ${canal.name} | perfil de frete: ${perfil.name} | estoque: ${ESTOQUE} por tamanho em "${local.name}"`)
console.log(`produto: "${produto.title}" /${HANDLE} | R$ ${PRECO.toFixed(2)} | ${TAMANHOS.join("/")} ${COR} | ${fotos.length} fotos | metadata.oculto = true`)

if (modo !== "--aplicar") { console.log("\nSIMULAÇÃO: nada foi gravado. Rode com --aplicar para criar."); process.exit(0) }

const { product } = await api("/admin/products?fields=id,handle,*variants,*variants.inventory_items", { method: "POST", body: produto })
await garantirEstoque(product.variants, local.id)
console.log(`\ncriado: ${product.id}\nlink direto: /br/products/${HANDLE}`)
