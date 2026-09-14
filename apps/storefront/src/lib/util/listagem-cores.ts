// Vitrine com "um card por cor" (decisão do dono, 14/09/2026): o produto continua ÚNICO no
// Medusa (estoque por SKU, conjuntos por produto, troca de cor na PDP), e só a LISTAGEM expande
// cada produto em uma entrada por cor. Puro: sem I/O e sem React.
import type { HttpTypes } from "@medusajs/types"
import { isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName } from "./colors"
import type { FilterState } from "./catalog-filters"
import { colorValues } from "./pdp-variants"

type Product = HttpTypes.StoreProduct

// Uma entrada da grade: o produto + a cor que o card abre pré-selecionada (grafia do catálogo).
// `cor: null` = produto sem opção Cor (ou com uma cor só): card igual ao de sempre.
export type ListingEntry = { product: Product; cor: string | null }

// Interruptores da listagem: `site_content.listagem = { cards_por_cor, conjuntos_na_listagem }`.
// Chave ausente ou valor inválido → ligado (mesmo padrão de `personasAtivasDe`).
export type ListagemConfig = { cardsPorCor: boolean; conjuntosNaListagem: boolean }
export function listagemConfigDe(valor: unknown): ListagemConfig {
  const v = valor && typeof valor === "object" ? (valor as Record<string, unknown>) : {}
  const bool = (x: unknown) => (typeof x === "boolean" ? x : true)
  return { cardsPorCor: bool(v.cards_por_cor), conjuntosNaListagem: bool(v.conjuntos_na_listagem) }
}

export function entryKey(e: ListingEntry): string {
  return `${e.product.id}|${e.cor === null ? "" : normalizeColorName(e.cor)}`
}

const mesmaCor = (a: string, b: string) => normalizeColorName(a) === normalizeColorName(b)

// A cor `cor` do produto atende aos filtros por variante (tamanho/cor/disponível)? Mesma regra
// de `matchesFilters`: tamanho e cor precisam casar NA MESMA variante disponível. Preço é do
// produto e já foi aplicado antes (`applyFilters`).
function corAtendeFiltros(product: Product, cor: string, f: FilterState): boolean {
  if (f.cor.length && !f.cor.some((c) => mesmaCor(c, cor))) return false
  if (!f.tamanho.length && !f.disponivel) return true
  return (product.variants ?? []).some((v) => {
    const sv = v as StockVariant
    const vc = optionValue(product.options, sv, "Cor")
    if (vc === null || !mesmaCor(vc, cor)) return false
    if (!isVariantAvailable(sv)) return false
    if (f.tamanho.length) {
      const t = optionValue(product.options, sv, "Tamanho")
      if (t === null || !f.tamanho.some((x) => x.toLowerCase() === t.toLowerCase())) return false
    }
    return true
  })
}

// Expande produtos JÁ filtrados e ordenados em entradas por cor, na ordem das cores do produto
// (as cores de um mesmo modelo ficam lado a lado). Cor esgotada continua na grade (o card mostra
// "Esgotado"), exceto com o filtro "disponível" ou de tamanho ativo. Com `porCor: false`, devolve
// uma entrada por produto (vitrine antiga).
export function entradasPorCor(products: Product[], f: FilterState, porCor = true): ListingEntry[] {
  const out: ListingEntry[] = []
  for (const product of products) {
    const cores = colorValues(product)
    if (!porCor || cores.length <= 1) {
      out.push({ product, cor: null })
      continue
    }
    const aceitas = cores.filter((c) => corAtendeFiltros(product, c, f))
    // `applyFilters` já garantiu que o produto passa; se nenhuma cor sobrar por diferença de
    // grafia, mantém o card do produto em vez de sumir com ele.
    if (!aceitas.length) out.push({ product, cor: null })
    else aceitas.forEach((cor) => out.push({ product, cor }))
  }
  return out
}
