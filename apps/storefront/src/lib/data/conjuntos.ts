// Leitores de dados do Benefício Conjunto na vitrine (F3, Task 2): consomem as rotas Store do
// backend (F1, `/store/conjuntos*`) e hidratam produtos via Store Products API — o backend nunca
// devolve título/imagem/preço, só ids e regras (ver `apps/backend/src/api/store/conjuntos/**`).
// `import "server-only"` (não `"use server"`): `getElegibilidade` devolve uma função, que não é
// serializável como retorno de Server Action.
import "server-only"

import { sdk } from "@lib/config"
import {
  type CardConjunto,
  type ColecaoStore,
  type CuradoStore,
  type ParStore,
  type RegraStore,
  type VitrineStore,
  elegibilidade,
  montarCardCurado,
  montarCardPar,
  precoMinDisponivel,
} from "@lib/util/conjuntos"
import { buildChain } from "@lib/util/category-chain"
import { HttpTypes } from "@medusajs/types"
import { getCacheOptions } from "./cookies"
import { listCategories } from "./categories"
import { listCollections } from "./collections"
import { listProductsByIds } from "./products"

type ConjuntoRaw = {
  tipo: "curado" | "colecao"
  nome: string
  handle: string
  capa_url: string | null
  product_ids: string[]
  regra: RegraStore
}

// Vitrine crua (F1): ids + regras, sem hidratação. Usada tanto por `getVitrineConjuntos` (que
// hidrata os produtos) quanto por `getElegibilidade` (que só precisa das raízes de categoria por
// coleção). Falha → estruturas vazias, nunca lança.
async function fetchVitrineRaw(): Promise<VitrineStore> {
  const next = {
    ...(await getCacheOptions("conjuntos")),
    revalidate: 300,
  }
  try {
    return await sdk.client.fetch<VitrineStore>("/store/conjuntos", {
      method: "GET",
      next,
      cache: "force-cache",
    })
  } catch (err) {
    console.error("[conjuntos] falha ao buscar vitrine", err)
    return { curados: [], colecoes: [] }
  }
}

// Mapa categoria id -> handle da raiz, subindo a árvore com `buildChain` (mesma lógica de
// breadcrumb/relacionados). Categoria sem cadeia resolvível fica de fora do mapa.
async function buildRaizesMap(): Promise<Map<string, string>> {
  const categorias = await listCategories().catch((err) => {
    console.error("[conjuntos] falha ao listar categorias", err)
    return []
  })
  const raizes = new Map<string, string>()
  for (const categoria of categorias) {
    const cadeia = buildChain(categorias, categoria.id)
    if (cadeia.length) raizes.set(categoria.id, cadeia[0].handle)
  }
  return raizes
}

// Vitrine principal do Benefício Conjunto (spec §7.1): curados + uma seção por coleção com os
// pares gerados (F1 já resolve quais pares existem; aqui só hidrata e monta os cards). Coleção
// sem nenhum par vendável (produto esgotado/despublicado) não aparece no resultado.
export async function getVitrineConjuntos(countryCode: string): Promise<{
  curados: CardConjunto[]
  colecoes: { collection_id: string; titulo: string; handle: string; cards: CardConjunto[] }[]
}> {
  const vitrine = await fetchVitrineRaw()

  const idsCurados = vitrine.curados.flatMap((c) => c.product_ids)
  const idsColecoes = vitrine.colecoes.flatMap((col) => col.pares.flatMap((p) => p.product_ids))
  const todosIds = Array.from(new Set([...idsCurados, ...idsColecoes]))
  const produtos = todosIds.length ? await listProductsByIds(todosIds, countryCode) : []
  const produtosMap = new Map(produtos.map((p) => [p.id, p]))

  const curados = vitrine.curados
    .map((c) => montarCardCurado(c, produtosMap))
    .filter((c): c is CardConjunto => c !== null)

  let colecoesInfo: HttpTypes.StoreCollection[] = []
  if (vitrine.colecoes.length) {
    try {
      const { collections } = await listCollections({ fields: "id,title,handle" })
      colecoesInfo = collections
    } catch (err) {
      console.error("[conjuntos] falha ao listar coleções", err)
    }
  }
  const colecoesInfoMap = new Map(colecoesInfo.map((c) => [c.id, c]))

  const colecoes = vitrine.colecoes
    .map((col) => {
      const cards = col.pares
        .map((par) => montarCardPar(par, col.collection_id, col.regra, produtosMap))
        .filter((c): c is CardConjunto => c !== null)
      if (!cards.length) return null
      const info = colecoesInfoMap.get(col.collection_id)
      return {
        collection_id: col.collection_id,
        titulo: info?.title ?? "",
        handle: info?.handle ?? "",
        cards,
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null)

  return { curados, colecoes }
}

// Página de um conjunto (curado ou par) pelo handle canônico. 404/erro no backend -> `null`
// (mesma semântica de `getCollectionByHandle`). Curado sem `capa_url` cadastrada ou par: a rota
// `[handle]` não devolve `collection_id` — para o par, ele é lido do próprio produto hidratado
// (campo base de `StoreProduct`), já que as duas peças pertencem à mesma coleção.
export async function getConjunto(
  handle: string,
  countryCode: string
): Promise<{ card: CardConjunto; produtos: HttpTypes.StoreProduct[] } | null> {
  const next = {
    ...(await getCacheOptions("conjuntos")),
    revalidate: 300,
  }
  let conjunto: ConjuntoRaw
  try {
    const raw = await sdk.client.fetch<{ conjunto: ConjuntoRaw }>(`/store/conjuntos/${handle}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
    conjunto = raw.conjunto
  } catch (err) {
    console.error("[conjuntos] falha ao buscar conjunto", handle, err)
    return null
  }

  const produtos = await listProductsByIds(conjunto.product_ids, countryCode)
  const produtosMap = new Map(produtos.map((p) => [p.id, p]))

  const card =
    conjunto.tipo === "curado"
      ? montarCardCurado(
          {
            id: conjunto.handle,
            nome: conjunto.nome,
            handle: conjunto.handle,
            capa_url: conjunto.capa_url,
            product_ids: conjunto.product_ids,
            regra: conjunto.regra,
          },
          produtosMap
        )
      : montarCardPar(
          { handle: conjunto.handle, categoria_a: "", categoria_b: "", product_ids: conjunto.product_ids },
          produtosMap.get(conjunto.product_ids[0])?.collection_id ?? "",
          conjunto.regra,
          produtosMap
        )

  if (!card) return null
  // mesma ordem de card.pecas
  const produtosOrdenados = conjunto.product_ids
    .map((id) => produtosMap.get(id))
    .filter((p): p is HttpTypes.StoreProduct => !!p)
  return { card, produtos: produtosOrdenados }
}

// Parceiras + curados de um produto (spec §7.3, bloco "Complete o conjunto" na PDP). `regra` é a
// da coleção do produto (mesma regra que rege as parceiras) — a rota `por-produto` não a devolve
// diretamente, então é lida da vitrine crua (cache compartilhado com `getVitrineConjuntos`) pela
// coleção do produto âncora.
export async function getConjuntosDoProduto(
  productId: string,
  countryCode: string
): Promise<{ parceiras: HttpTypes.StoreProduct[]; regra: RegraStore | null; curados: CardConjunto[] }> {
  const next = {
    ...(await getCacheOptions("conjuntos")),
    revalidate: 300,
  }
  let raw: { parceiras: { product_id: string; categoria_raiz: string }[]; curados: CuradoStore[] }
  try {
    raw = await sdk.client.fetch<{
      parceiras: { product_id: string; categoria_raiz: string }[]
      curados: CuradoStore[]
    }>(`/store/conjuntos/por-produto/${productId}`, {
      method: "GET",
      next,
      cache: "force-cache",
    })
  } catch (err) {
    console.error("[conjuntos] falha ao buscar conjuntos do produto", productId, err)
    return { parceiras: [], regra: null, curados: [] }
  }

  if (!raw.parceiras.length && !raw.curados.length) {
    return { parceiras: [], regra: null, curados: [] }
  }

  const idsParceiras = raw.parceiras.map((p) => p.product_id)
  const idsCurados = raw.curados.flatMap((c) => c.product_ids)
  const todosIds = Array.from(new Set([productId, ...idsParceiras, ...idsCurados]))
  const produtos = await listProductsByIds(todosIds, countryCode)
  const produtosMap = new Map(produtos.map((p) => [p.id, p]))

  const parceiras = idsParceiras
    .map((id) => produtosMap.get(id))
    .filter((p): p is HttpTypes.StoreProduct => !!p)
    .filter((p) => precoMinDisponivel(p) !== null) // só parceiras com variante disponível — spec §7.3

  const curados = raw.curados
    .map((c) => montarCardCurado(c, produtosMap))
    .filter((c): c is CardConjunto => c !== null)

  let regra: RegraStore | null = null
  if (parceiras.length) {
    const collectionId = produtosMap.get(productId)?.collection_id ?? null
    if (collectionId) {
      const vitrine = await fetchVitrineRaw()
      regra = vitrine.colecoes.find((col) => col.collection_id === collectionId)?.regra ?? null
    }
  }

  return { parceiras, regra, curados }
}

// Predicado de elegibilidade para o selo "Forma conjunto" (spec §7.3): fecha sobre a vitrine crua
// + o mapa de raízes de categoria, uma vez por listagem (o chamador reusa o predicado por card).
export async function getElegibilidade(): Promise<
  (collection_id: string | null, categoryIds: string[]) => boolean
> {
  const [vitrine, raizes] = await Promise.all([fetchVitrineRaw(), buildRaizesMap()])
  return elegibilidade(vitrine, raizes)
}

export type { CardConjunto, ColecaoStore, CuradoStore, ParStore, RegraStore, VitrineStore }
