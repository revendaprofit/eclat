import { sdk } from "@lib/config"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"

export const listCategories = async (query?: Record<string, unknown>) => {
  // revalida a cada 5 min — a invalidação por tag usa um cacheId por visitante e não cobre
  // publicações no Cockpit (I3)
  const next = {
    ...(await getCacheOptions("categories")),
    revalidate: 300,
  }

  const limit = query?.limit || 100

  return sdk.client
    .fetch<{ product_categories: HttpTypes.StoreProductCategory[] }>(
      "/store/product-categories",
      {
        query: {
          fields:
            "*category_children, *products, *parent_category, *parent_category.parent_category, +metadata, +rank",
          limit,
          ...query,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories)
}

export const getCategoryByHandle = async (categoryHandle: string[]) => {
  const handle = `${categoryHandle.join("/")}`

  // revalida a cada 5 min — a invalidação por tag usa um cacheId por visitante e não cobre
  // publicações no Cockpit (I3)
  const next = {
    ...(await getCacheOptions("categories")),
    revalidate: 300,
  }

  return sdk.client
    .fetch<HttpTypes.StoreProductCategoryListResponse>(
      `/store/product-categories`,
      {
        query: {
          fields: "*category_children, *products, *parent_category, +metadata, +rank",
          handle,
        },
        next,
        cache: "force-cache",
      }
    )
    .then(({ product_categories }) => product_categories[0])
}
