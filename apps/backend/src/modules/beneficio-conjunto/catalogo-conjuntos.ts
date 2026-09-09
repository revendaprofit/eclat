// Leituras de catálogo do Benefício Conjunto (spec §5), compartilhadas por admin (Task 6) e
// vitrine (Task 7). Puro em relação a HTTP: recebe o container, devolve objetos simples — nenhuma
// rota deve fazer query.graph/regraEfetiva por conta própria, só chamar as funções daqui.
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { mapaRaizes } from "./avaliar-carrinho"
import { regraEfetiva } from "./utils/montar-conjuntos"
import type { Curado, Par, Regra } from "./utils/tipos"

type ProdutoBruto = {
  id: string
  handle: string
  title: string
  thumbnail: string | null
  status: string
  collection_id: string | null
  categories?: { id: string }[] | null
}
type Produto = Omit<ProdutoBruto, "categories"> & { categoria_raiz: string | null }

async function buscarProdutos(container: MedusaContainer, filtros: Record<string, unknown>): Promise<ProdutoBruto[]> {
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "product",
    fields: ["id", "handle", "title", "thumbnail", "status", "collection_id", "categories.id"],
    filters: filtros,
  })
  return data as ProdutoBruto[]
}

const produtosPublicados = (container: MedusaContainer) => buscarProdutos(container, { status: "published" })

function comRaiz(produtos: ProdutoBruto[], raizes: Map<string, string>): Produto[] {
  return produtos.map(({ categories, ...p }) => ({
    ...p,
    categoria_raiz: (categories ?? []).map((c) => raizes.get(c.id)).find((h): h is string => !!h) ?? null,
  }))
}

// Chave canônica de um CONJUNTO de ids de produto (ordem indiferente) — usada pelos rulings V2 e
// V6 para decidir se um par gerado e um curado cobrem exatamente os mesmos produtos.
function chaveIdSet(productIds: string[]): string {
  return productIds.slice().sort().join("|")
}

// Chaves dos conjuntos cobertos por um curado ATIVO com regra ATIVA (rulings V2/V6): quando o
// id-set de um par gerado bate com uma destas, o carrinho aplica a regra do curado (curados
// resolvem antes dos pares em `utils/montar-conjuntos.ts`), então o par não pode ser oferecido
// com a regra da coleção.
function conjuntosDeCuradosAtivos(curados: Curado[], regras: Regra[]): Set<string> {
  const chaves = new Set<string>()
  for (const c of curados) {
    if (!c.ativo) continue
    if (!regras.find((r) => r.id === c.regra_id)?.ativa) continue
    chaves.add(chaveIdSet(c.product_ids))
  }
  return chaves
}

// Catálogo completo de conjuntos vendáveis (spec §5): curados ativos com todos os produtos ainda
// publicados, e — por coleção com regra efetiva ativa — todo par de produtos publicados que
// realiza um `Par` ativo (produto de categoria_a × produto de categoria_b da mesma coleção).
export async function listarConjuntos(container: MedusaContainer): Promise<{
  curados: (Curado & { regra: Regra })[]
  colecoes: { collection_id: string; regra: { tipo_desconto: Regra["tipo_desconto"]; valor: number }; pares: { handle: string; categoria_a: string; categoria_b: string; product_ids: string[] }[] }[]
}> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const [{ regras, pares, curados }, raizes, produtosBrutos] = await Promise.all([
    svc.carregarAtivos() as Promise<{ regras: Regra[]; pares: Par[]; curados: Curado[] }>,
    mapaRaizes(container),
    produtosPublicados(container),
  ])
  const produtos = comRaiz(produtosBrutos, raizes)
  const porId = new Map(produtos.map((p) => [p.id, p]))

  const curadosAtivos = curados
    .filter((c) => c.ativo && c.product_ids.every((id) => porId.has(id)))
    .map((c) => ({ ...c, regra: regras.find((r) => r.id === c.regra_id) }))
    .filter((c): c is Curado & { regra: Regra } => !!c.regra?.ativa)

  // Ruling V2 (fix round 1, achado "par gerado pode duplicar curado ativo com o mesmo conjunto de
  // produtos"): o carrinho aplica a regra do curado antes da regra de coleção (gancho, F1) quando
  // os dois cobrem o mesmo par de produtos — então listar o par também mostraria, na vitrine, um
  // preço que o carrinho nunca cobra. Um par cujo conjunto de ids bate com o de um curado ATIVO
  // some da lista.
  const conjuntosCurados = new Set(curadosAtivos.map((c) => chaveIdSet(c.product_ids)))

  const colecoesIds = Array.from(new Set(produtos.map((p) => p.collection_id).filter((c): c is string => !!c)))
  const colecoes = colecoesIds
    .map((collection_id) => {
      const regra = regraEfetiva(regras, collection_id)
      if (!regra) return null
      const doColecao = produtos.filter((p) => p.collection_id === collection_id)
      const paresDaColecao: { handle: string; categoria_a: string; categoria_b: string; product_ids: string[] }[] = []
      for (const par of pares) {
        const ladoA = doColecao.filter((p) => p.categoria_raiz === par.categoria_a)
        const ladoB = doColecao.filter((p) => p.categoria_raiz === par.categoria_b)
        for (const a of ladoA) {
          for (const b of ladoB) {
            if (conjuntosCurados.has(chaveIdSet([a.id, b.id]))) continue
            paresDaColecao.push({ handle: `${a.handle}--${b.handle}`, categoria_a: par.categoria_a, categoria_b: par.categoria_b, product_ids: [a.id, b.id] })
          }
        }
      }
      if (!paresDaColecao.length) return null
      return { collection_id, regra: { tipo_desconto: regra.tipo_desconto, valor: regra.valor }, pares: paresDaColecao }
    })
    .filter((c): c is NonNullable<typeof c> => !!c)

  return { curados: curadosAtivos, colecoes }
}

// Parceiras de um produto (usado pela rota admin `por-produto` e pela vitrine): produtos
// publicados da mesma coleção cuja raiz forma par ativo com a raiz do produto (só se a coleção
// tem regra efetiva ativa) + curados ativos que incluem o produto.
export async function parceirasDoProduto(
  container: MedusaContainer,
  productId: string
): Promise<{ parceiras: { product_id: string; categoria_raiz: string; collection_id: string }[]; curados: Curado[]; regras: Regra[] }> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const [{ regras, pares, curados }, raizes, [ancoraBruta], produtosPublicadosBrutos] = await Promise.all([
    svc.carregarAtivos() as Promise<{ regras: Regra[]; pares: Par[]; curados: Curado[] }>,
    mapaRaizes(container),
    buscarProdutos(container, { id: [productId] }),
    produtosPublicados(container),
  ])
  const curadosDoProduto = curados.filter((c) => c.ativo && c.product_ids.includes(productId))
  const ancora = ancoraBruta ? comRaiz([ancoraBruta], raizes)[0] : null
  if (!ancora || !ancora.collection_id || !ancora.categoria_raiz) return { parceiras: [], curados: curadosDoProduto, regras }

  const regra = regraEfetiva(regras, ancora.collection_id)
  if (!regra) return { parceiras: [], curados: curadosDoProduto, regras }

  const raizesParceiras = new Set<string>()
  for (const par of pares) {
    if (par.categoria_a === ancora.categoria_raiz) raizesParceiras.add(par.categoria_b)
    if (par.categoria_b === ancora.categoria_raiz) raizesParceiras.add(par.categoria_a)
  }
  if (!raizesParceiras.size) return { parceiras: [], curados: curadosDoProduto, regras }

  // Ruling V6 (fix round 3, achado "PDP promete o benefício da coleção onde o carrinho aplica o do
  // curado"): mesma lógica do V2 em `listarConjuntos`/`conjuntoPorHandle`, aplicada aqui. Se um
  // curado ATIVO cobre exatamente `{âncora, parceira}`, o carrinho aplica a regra do curado — o
  // bloco "Complete o conjunto" mostraria um benefício que nunca é cobrado. A parceira sai de
  // `parceiras` e continua saindo em `curados` ("Looks com essa peça").
  const conjuntosCurados = conjuntosDeCuradosAtivos(curados, regras)

  const parceiras = comRaiz(produtosPublicadosBrutos, raizes)
    .filter((p) => p.id !== productId && p.collection_id === ancora.collection_id && p.categoria_raiz && raizesParceiras.has(p.categoria_raiz))
    .filter((p) => !conjuntosCurados.has(chaveIdSet([productId, p.id])))
    .map((p) => ({ product_id: p.id, categoria_raiz: p.categoria_raiz as string, collection_id: p.collection_id as string }))

  return { parceiras, curados: curadosDoProduto, regras }
}

// Resolve um handle de vitrine para um conjunto vendável (curado, ou par `handleA--handleB`
// validado): mesma coleção, par ativo entre as raízes, regra efetiva ativa. `null` se o handle
// não corresponder a nada vendável agora (curado inativo/apagado, produto despublicado, etc.).
//
// Ordem CANÔNICA apenas (fix round 1, achado "conjuntoPorHandle aceita handleA--handleB em
// qualquer ordem"): `handleA--handleB` só resolve se a raiz de A for exatamente `par.categoria_a`
// e a raiz de B for exatamente `par.categoria_b` — sem reordenar as raízes antes de comparar. Como
// `ConjuntoPar` é sempre gravado com `categoria_a < categoria_b` (CHECK `conjunto_par_ordem`,
// service.criarPar), isso implica que só a ordem alfabética das RAÍZES resolve; a ordem invertida
// devolve `null`. `listarConjuntos` usa a mesma ordem (`ladoA`/`categoria_a` primeiro) para montar
// o handle do par, então os dois lados ficam sempre de acordo — sem risco de canonicalização
// divergente para as URLs/SEO da vitrine (Task 7).
export async function conjuntoPorHandle(
  container: MedusaContainer,
  handle: string
): Promise<{ tipo: "curado" | "colecao"; nome: string; capa_url: string | null; product_ids: string[]; regra: Regra } | null> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const { regras, pares, curados } = (await svc.carregarAtivos()) as { regras: Regra[]; pares: Par[]; curados: Curado[] }

  const curado = curados.find((c) => c.handle === handle && c.ativo)
  if (curado) {
    const regra = regras.find((r) => r.id === curado.regra_id)
    if (!regra?.ativa) return null
    const produtos = await buscarProdutos(container, { id: curado.product_ids, status: "published" })
    if (produtos.length !== curado.product_ids.length) return null
    return { tipo: "curado", nome: curado.nome, capa_url: curado.capa_url, product_ids: curado.product_ids, regra }
  }

  const partes = handle.split("--")
  if (partes.length !== 2) return null
  const [handleA, handleB] = partes
  const raizes = await mapaRaizes(container)
  const produtos = comRaiz(await buscarProdutos(container, { handle: [handleA, handleB], status: "published" }), raizes)
  const a = produtos.find((p) => p.handle === handleA)
  const b = produtos.find((p) => p.handle === handleB)
  if (!a || !b || a.id === b.id || !a.collection_id || a.collection_id !== b.collection_id) return null
  if (!a.categoria_raiz || !b.categoria_raiz) return null
  // Ordem canônica só: a raiz de A precisa bater com `categoria_a` e a de B com `categoria_b`
  // exatamente como gravado — não normaliza/ordena as raízes antes de comparar (ver nota acima).
  const par = pares.find((p) => p.ativo && p.categoria_a === a.categoria_raiz && p.categoria_b === b.categoria_raiz)
  if (!par) return null
  const regra = regraEfetiva(regras, a.collection_id)
  if (!regra) return null
  // Ruling V2 (fix round 1, mesmo achado de `listarConjuntos` acima): se este par de produtos é
  // exatamente o conjunto de um curado ATIVO, o carrinho aplica a regra do curado, não a da
  // coleção — resolver o par aqui devolveria um preço que o carrinho nunca cobra. `a`/`b` já vieram
  // filtrados por `status: "published"`, então um curado cujo id-set bate com o deles já tem os
  // dois produtos publicados; não precisa reconferir.
  if (conjuntosDeCuradosAtivos(curados, regras).has(chaveIdSet([a.id, b.id]))) return null
  return { tipo: "colecao", nome: `${a.title} + ${b.title}`, capa_url: null, product_ids: [a.id, b.id], regra }
}
