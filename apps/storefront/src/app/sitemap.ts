import { MetadataRoute } from "next"
import { getBaseURL } from "@lib/util/env"
import { listProducts } from "@lib/data/products"
import { listCollections } from "@lib/data/collections"
import { listCategories } from "@lib/data/categories"
import { listEditorialPosts } from "@lib/data/editorial"
import { INSTITUTIONAL_PAGES } from "@modules/content/institutional"
import { COMING_SOON, COMING_SOON_PATH } from "@lib/coming-soon"

// sitemap.xml dinâmico: home, loja, produtos, coleções e categorias (região br).
const CC = "br"

// Codifica o handle por segmento para garantir XML válido e URL segura
// mesmo quando o handle contém "&", acentos ou espaços.
const enc = (handle: string) =>
  handle.split("/").map(encodeURIComponent).join("/")

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = getBaseURL()
  const now = new Date()

  // Loja em construção: todas as rotas são reescritas para a lista de
  // espera (ver middleware) — listar só essa URL evita conteúdo duplicado
  // no Google enquanto o catálogo não está navegável de verdade.
  if (COMING_SOON) {
    return [
      {
        url: `${base}${COMING_SOON_PATH}`,
        lastModified: now,
        changeFrequency: "weekly",
        priority: 1,
      },
    ]
  }

  const urls: MetadataRoute.Sitemap = [
    { url: `${base}/${CC}`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/${CC}/store`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/${CC}/editorial`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
  ]

  for (const p of INSTITUTIONAL_PAGES) {
    urls.push({
      url: `${base}/${CC}/${p.slug}`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    })
  }

  try {
    const posts = await listEditorialPosts(500)
    for (const post of posts) {
      urls.push({
        url: `${base}/${CC}/editorial/${enc(post.slug)}`,
        lastModified: post.updated_at ? new Date(post.updated_at) : now,
        changeFrequency: "monthly",
        priority: 0.7,
      })
    }
  } catch {
    /* ignora */
  }

  try {
    // Pagina o catálogo inteiro (100 por página) — sem teto de produtos.
    const PAGE = 100
    let offset = 0
    for (;;) {
      const { response } = await listProducts({
        countryCode: CC,
        queryParams: { limit: PAGE, offset, fields: "handle,updated_at" },
      })
      for (const p of response.products) {
        if (p.handle)
          urls.push({
            url: `${base}/${CC}/products/${enc(p.handle)}`,
            lastModified: p.updated_at ? new Date(p.updated_at) : now,
            changeFrequency: "weekly",
            priority: 0.8,
          })
      }
      offset += PAGE
      if (response.products.length < PAGE || offset >= response.count) break
    }
  } catch {
    /* ignora se a API falhar */
  }

  try {
    const { collections } = await listCollections({ fields: "handle" })
    for (const c of collections ?? []) {
      if (c.handle)
        urls.push({
          url: `${base}/${CC}/collections/${enc(c.handle)}`,
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
          url: `${base}/${CC}/categories/${enc(c.handle)}`,
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
