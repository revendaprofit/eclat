"use server"

import { sdk } from "@lib/config"
import { applyFilters, computeFacets, paginate, sortByKey, type Facets } from "@lib/util/catalog-facets"
import { DEFAULT_FILTERS, type FilterState } from "@lib/util/catalog-filters"
import { entradasPorCor, type ListingEntry } from "@lib/util/listagem-cores"
import { semOcultos } from "@lib/util/produto-oculto"
import { getListagemConfig } from "./listagem"
import { HttpTypes } from "@medusajs/types"
import { getAuthHeaders, getCacheOptions } from "./cookies"
import { getRegion, retrieveRegion } from "./regions"

export const listProducts = async ({
  pageParam = 1,
  queryParams,
  countryCode,
  regionId,
}: {
  pageParam?: number
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
  countryCode?: string
  regionId?: string
}): Promise<{
  response: { products: HttpTypes.StoreProduct[]; count: number }
  nextPage: number | null
  queryParams?: HttpTypes.FindParams & HttpTypes.StoreProductListParams
}> => {
  if (!countryCode && !regionId) {
    throw new Error("Country code or region ID is required")
  }

  const limit = queryParams?.limit || 12
  const _pageParam = Math.max(pageParam, 1)
  const offset = _pageParam === 1 ? 0 : (_pageParam - 1) * limit

  let region: HttpTypes.StoreRegion | undefined | null

  if (countryCode) {
    region = await getRegion(countryCode)
  } else {
    region = await retrieveRegion(regionId!)
  }

  if (!region) {
    return {
      response: { products: [], count: 0 },
      nextPage: null,
    }
  }

  const headers = {
    ...(await getAuthHeaders()),
  }

  // revalida a cada 5 min — a invalidação por tag usa um cacheId por visitante e não cobre
  // publicações no Cockpit (I3)
  const next = {
    ...(await getCacheOptions("products")),
    revalidate: 300,
  }

  // Campos padrão que todo chamador precisa (card, disponibilidade, badges).
  // Se o chamador pedir `fields` próprio, ANEXA em vez de substituir — um
  // `queryParams.fields` não pode fazer o produto perder inventory/images/tags.
  const defaultFields = "*variants.calculated_price,+variants.inventory_quantity,*variants.images,+metadata,+tags,*categories"
  const { fields: extraFields, ...restQueryParams } = queryParams ?? {}
  const fields = extraFields ? `${defaultFields},${extraFields}` : defaultFields

  return sdk.client
    .fetch<{ products: HttpTypes.StoreProduct[]; count: number }>(
      `/store/products`,
      {
        method: "GET",
        query: {
          limit,
          offset,
          region_id: region?.id,
          fields,
          ...restQueryParams,
        },
        headers,
        next,
        cache: "force-cache",
      }
    )
    .then((resposta) => {
      // produto com metadata.oculto some de toda listagem (vitrine, sitemap, feeds);
      // consulta por handle/id continua enxergando — ver lib/util/produto-oculto.ts
      const { products, count } = semOcultos(resposta, queryParams)
      const nextPage = resposta.count > offset + limit ? pageParam + 1 : null

      return {
        response: {
          products,
          count,
        },
        nextPage: nextPage,
        queryParams,
      }
    })
}

// Hidratação por ids (Benefício Conjunto, F3): busca produtos específicos em lotes de 100
// (limite prático da Store API), dedupe antes de montar os lotes, sem paginação nem `region`
// obrigatório além do já exigido por `listProducts`. Falha em um lote → loga e devolve `[]`
// para aquele lote (nunca derruba a página inteira).
export const listProductsByIds = async (
  ids: string[],
  countryCode: string
): Promise<HttpTypes.StoreProduct[]> => {
  const uniqueIds = Array.from(new Set(ids))
  if (!uniqueIds.length) return []

  const lotes: string[][] = []
  for (let i = 0; i < uniqueIds.length; i += 100) {
    lotes.push(uniqueIds.slice(i, i + 100))
  }

  const resultados = await Promise.all(
    lotes.map((lote) =>
      listProducts({
        queryParams: { id: lote, limit: lote.length },
        countryCode,
      }).catch((err) => {
        console.error("[conjuntos] listProductsByIds: falha ao buscar lote", err)
        return { response: { products: [], count: 0 }, nextPage: null }
      })
    )
  )

  return resultados.flatMap((r) => r.response.products)
}

export type ListingScope = { categoryIds?: string[]; collectionId?: string; productIds?: string[]; q?: string }
export type ListingResult = {
  // Entradas da página atual: um card por cor (ou por produto, se `site_content.listagem` desligar).
  entries: ListingEntry[]
  count: number
  total: number
  totalPages: number
  pagina: number
  facets: Facets
  // Ids de TODOS os produtos do escopo (antes dos filtros) — os conjuntos da listagem usam.
  scopeProductIds: string[]
  cardsPorCor: boolean
  conjuntosNaListagem: boolean
}

// Listagem com filtros (spec §6.1): busca até 100 produtos do escopo, filtra,
// ordena e pagina em memória; facetas calculadas sobre o conjunto do escopo.
export const listProductsFiltered = async ({
  filters,
  scope,
  countryCode,
}: {
  filters: FilterState
  scope: ListingScope
  countryCode: string
}): Promise<ListingResult> => {
  const queryParams: HttpTypes.FindParams & HttpTypes.StoreProductListParams = { limit: 100 }
  if (scope.categoryIds?.length) queryParams.category_id = scope.categoryIds
  if (scope.collectionId) queryParams.collection_id = [scope.collectionId]
  if (scope.productIds?.length) queryParams.id = scope.productIds
  if (scope.q) queryParams.q = scope.q // busca textual da Store API (título/descrição), spec §9

  const [
    {
      response: { products: all },
    },
    config,
  ] = await Promise.all([listProducts({ pageParam: 1, queryParams, countryCode }), getListagemConfig()])

  // Filtra e ordena PRODUTOS (mesmas regras de sempre) e só então expande em cards por cor:
  // contagem, paginação e facetas passam a falar em cards.
  const entries = entradasPorCor(sortByKey(applyFilters(all, filters), filters.ordenar), filters, config.cardsPorCor)
  const page = paginate(entries, filters.pagina)
  return {
    entries: page.items,
    count: entries.length,
    total: entradasPorCor(all, DEFAULT_FILTERS, config.cardsPorCor).length,
    totalPages: page.totalPages,
    pagina: page.pagina,
    facets: computeFacets(all, filters, config.cardsPorCor),
    scopeProductIds: all.map((p) => p.id),
    cardsPorCor: config.cardsPorCor,
    conjuntosNaListagem: config.conjuntosNaListagem,
  }
}
