import { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"
import { listProducts } from "@lib/data/products"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"

// sitemap.xml dinâmico: home, loja, produtos, coleções e categorias (região br).
const CC = "br"

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseURL()
  const now = new Date()
  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/${CC}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/${CC}/store`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ]

  try {
    const { response } = await listProducts({
      countryCode: CC,
      queryParams: { limit: 100, fields: "handle,updated_at" },
    })
    for (const p of response.products) {
      if (p.handle)
        urls.push({
          url: `${base}/${CC}/products/${p.handle}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : now,
          changeFrequency: "weekly",
          priority: 0.8,
        })
    }
  } catch {
    /* ignora se a API falhar */
  }

  try {
    const { collections } = await listCollections({ fields: "handle" })
    for (const c of collections ?? []) {
      if (c.handle)
        urls.push({
          url: `${base}/${CC}/collections/${c.handle}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.7,
        })
    }
  } catch {
    /* ignora */
  }

  try {
    const cats = await listCategories()
    for (const c of (cats ?? []) as { handle?: string }[]) {
      if (c.handle)
        urls.push({
          url: `${base}/${CC}/categories/${c.handle}`,
          lastModified: now,
          changeFrequency: "weekly",
          priority: 0.6,
        })
    }
  } catch {
    /* ignora */
  }

  return urls
}
