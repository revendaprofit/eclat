// Módulo puro do Benefício Conjunto na vitrine (F3, spec do card + regras). Sem I/O, sem React:
// monta os cards de "curado"/"colecao" a partir das respostas Store (F1) + produtos já hidratados
// pela Store Products API. Dinheiro sempre em centavos inteiros — espelha
// `apps/backend/src/modules/beneficio-conjunto/utils/montar-conjuntos.ts` (`descontoDoConjunto`).
import type { HttpTypes } from "@medusajs/types"
import { isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName } from "./colors"
import { colorValues } from "./pdp-variants"

// ---------- Respostas Store (F1) ----------
export type RegraStore = {
  tipo_desconto: "menor_peca_percentual" | "menor_peca_valor" | "total_percentual" | "total_valor"
  valor: number
}
export type ParStore = { handle: string; categoria_a: string; categoria_b: string; product_ids: string[] }
export type ColecaoStore = { collection_id: string; regra: RegraStore; pares: ParStore[] }
export type CuradoStore = {
  id: string
  nome: string
  handle: string
  capa_url: string | null
  product_ids: string[]
  regra: RegraStore
}
export type VitrineStore = { curados: CuradoStore[]; colecoes: ColecaoStore[] }

// ---------- Cards da vitrine ----------
export type PecaCard = { id: string; handle: string; title: string; thumbnail: string | null; precoMin: number | null }
export type CardConjunto = {
  tipo: "curado" | "colecao"
  handle: string
  nome: string
  capa: string | null
  pecas: PecaCard[]
  precoCheio: number
  precoComBeneficio: number
  economia: number
  regra: RegraStore
  collection_id: string | null
}

type VariantWithPrice = HttpTypes.StoreProductVariant & {
  calculated_price?: { calculated_amount?: number | null } | null
}

// Desconto por unidade de um conjunto, na ordem dos preços recebidos. Nunca passa do preço da
// unidade. Espelho de `descontoDoConjunto` no backend — mesma semântica, mesmos arredondamentos.
export function descontoConjunto(regra: RegraStore, precos: number[]): number[] {
  const n = precos.length
  const zeros = precos.map(() => 0)
  if (!n) return zeros
  const idxMin = precos.reduce((m, p, i) => (p < precos[m] ? i : m), 0)
  switch (regra.tipo_desconto) {
    case "menor_peca_percentual": {
      const d = zeros.slice()
      d[idxMin] = Math.min(precos[idxMin], Math.round((precos[idxMin] * regra.valor) / 100))
      return d
    }
    case "menor_peca_valor": {
      const d = zeros.slice()
      d[idxMin] = Math.min(precos[idxMin], regra.valor)
      return d
    }
    case "total_percentual":
      return precos.map((p) => Math.min(p, Math.round((p * regra.valor) / 100)))
    case "total_valor": {
      const porUnidade = Math.round(regra.valor / n)
      return precos.map((p) => Math.min(p, porUnidade))
    }
  }
}

// Menor `calculated_amount` (decimal BRL) entre as variantes disponíveis, em centavos. `null` se
// não há variante disponível ou nenhuma delas tem preço calculado.
export function precoMinDisponivel(p: HttpTypes.StoreProduct): number | null {
  const variantes = (p.variants ?? []) as VariantWithPrice[]
  const precos = variantes
    .filter((v) => isVariantAvailable(v as StockVariant))
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((x): x is number => typeof x === "number")
    .map((x) => Math.round(x * 100))
  return precos.length ? Math.min(...precos) : null
}

export function precosConjunto(
  regra: RegraStore,
  precos: number[]
): { cheio: number; comBeneficio: number; economia: number } {
  const cheio = precos.reduce((a, b) => a + b, 0)
  const economia = descontoConjunto(regra, precos).reduce((a, b) => a + b, 0)
  return { cheio, comBeneficio: cheio - economia, economia }
}

export function conjuntoDisponivel(pecas: PecaCard[]): boolean {
  return pecas.every((p) => p.precoMin !== null)
}

function pecaCard(p: HttpTypes.StoreProduct): PecaCard {
  return {
    id: p.id,
    handle: p.handle ?? "",
    title: p.title ?? "",
    thumbnail: p.thumbnail ?? null,
    precoMin: precoMinDisponivel(p),
  }
}

function montarCard(
  tipo: "curado" | "colecao",
  handle: string,
  nome: string,
  capa: string | null,
  productIds: string[],
  regra: RegraStore,
  collectionId: string | null,
  produtos: Map<string, HttpTypes.StoreProduct>
): CardConjunto | null {
  const encontrados = productIds.map((id) => produtos.get(id))
  if (encontrados.some((p) => !p)) return null
  const pecas = (encontrados as HttpTypes.StoreProduct[]).map(pecaCard)
  if (!conjuntoDisponivel(pecas)) return null
  const precos = pecas.map((p) => p.precoMin as number)
  const { cheio, comBeneficio, economia } = precosConjunto(regra, precos)
  return {
    tipo,
    handle,
    nome,
    capa,
    pecas,
    precoCheio: cheio,
    precoComBeneficio: comBeneficio,
    economia,
    regra,
    collection_id: collectionId,
  }
}

// Par de coleção: sem capa própria (ParStore não tem `capa_url`) — nome é a junção dos títulos
// das peças ("Top Aura + Legging Vértice"). Peça esgotada ou produto ausente do mapa → null.
export function montarCardPar(
  par: ParStore,
  colecaoId: string,
  regra: RegraStore,
  produtos: Map<string, HttpTypes.StoreProduct>
): CardConjunto | null {
  const titulos = par.product_ids.map((id) => produtos.get(id)?.title).filter((t): t is string => !!t)
  if (titulos.length !== par.product_ids.length) return null
  return montarCard("colecao", par.handle, titulos.join(" + "), null, par.product_ids, regra, colecaoId, produtos)
}

// Curado: nome e capa vêm do cadastro (`CuradoStore`), não das peças. Sem `capa_url` cadastrada →
// capa `null` (a vitrine usa as fotos das peças, já disponíveis em `pecas[].thumbnail`).
export function montarCardCurado(c: CuradoStore, produtos: Map<string, HttpTypes.StoreProduct>): CardConjunto | null {
  return montarCard("curado", c.handle, c.nome, c.capa_url, c.product_ids, c.regra, null, produtos)
}

// Texto pt-BR do benefício, para o card e a página do conjunto.
export function descricaoRegra(regra: RegraStore, n: number): string {
  switch (regra.tipo_desconto) {
    case "menor_peca_percentual":
      return `${regra.valor}% na peça de menor valor`
    case "menor_peca_valor":
      return `${formatarReais(regra.valor)} na peça de menor valor`
    case "total_percentual":
      return `${regra.valor}% sobre o conjunto`
    case "total_valor": {
      const porPeca = Math.round(regra.valor / n)
      return `${formatarReais(regra.valor)} no conjunto (${formatarReais(porPeca)} por peça)`
    }
  }
}

function corComVarianteDisponivel(produto: HttpTypes.StoreProduct, cor: string): boolean {
  const alvo = normalizeColorName(cor)
  return ((produto.variants ?? []) as VariantWithPrice[]).some((v) => {
    const valor = optionValue(produto.options, v as StockVariant, "Cor")
    return valor != null && normalizeColorName(valor) === alvo && isVariantAvailable(v as StockVariant)
  })
}

// Cor a pré-selecionar na parceira ao entrar pelo card do conjunto: a grafia CANÔNICA da parceira
// para a cor atual (mesmo nome, acento/caixa podem variar entre produtos), se ela tiver variante
// disponível nessa cor; senão a primeira cor da parceira com variante disponível; senão `null`.
export function corParceira(parceira: HttpTypes.StoreProduct, corAtual: string | null): string | null {
  const cores = colorValues(parceira)
  if (corAtual) {
    const canonica = cores.find((c) => normalizeColorName(c) === normalizeColorName(corAtual))
    if (canonica && corComVarianteDisponivel(parceira, canonica)) return canonica
  }
  return cores.find((c) => corComVarianteDisponivel(parceira, c)) ?? null
}

// Fecha sobre a vitrine (F1) para responder, por coleção + categorias do produto, se ele
// participa de algum conjunto vendável agora — usado pelo painel/CTA da PDP.
export function elegibilidade(
  vitrine: VitrineStore,
  raizes: Map<string, string>
): (collection_id: string | null, categoryIds: string[]) => boolean {
  const raizesPorColecao = new Map<string, Set<string>>()
  for (const col of vitrine.colecoes) {
    const raizesColecao = new Set<string>()
    for (const par of col.pares) {
      raizesColecao.add(par.categoria_a)
      raizesColecao.add(par.categoria_b)
    }
    raizesPorColecao.set(col.collection_id, raizesColecao)
  }
  return (collection_id: string | null, categoryIds: string[]) => {
    if (!collection_id) return false
    const raizesColecao = raizesPorColecao.get(collection_id)
    if (!raizesColecao) return false
    return categoryIds.some((id) => {
      const raiz = raizes.get(id)
      return raiz != null && raizesColecao.has(raiz)
    })
  }
}

// Metadado do item do carrinho que identifica de qual "slot" do conjunto ele veio (spec do
// carrinho, F4) — `i` é a posição da peça no conjunto, `agora` desempata compras repetidas do
// mesmo conjunto na mesma sessão.
export function slotMetadata(conjuntoHandle: string, i: number, agora: number = Date.now()): { conjunto_slot: string } {
  return { conjunto_slot: `${conjuntoHandle}#${i}#${agora}` }
}

// Formata centavos inteiros como reais pt-BR ("R$ 1.234,56"). Implementação manual (sem
// Intl.NumberFormat) para não depender dos dados de locale ICU do runtime.
export function formatarReais(centavos: number): string {
  const sinal = centavos < 0 ? "-" : ""
  const valor = Math.abs(centavos) / 100
  const [inteiro, decimal] = valor.toFixed(2).split(".")
  const comMilhar = inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  return `${sinal}R$ ${comMilhar},${decimal}`
}
