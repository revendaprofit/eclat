# Fase 2 — Listagem com filtros + card de produto — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cliente entra em uma categoria e encontra a peça por tamanho, cor, preço e disponibilidade, num card que mostra cores, segunda foto, selos e adição rápida — com URL compartilhável, contagem, estado vazio útil, cabeçalho de categoria e eventos de lista no dataLayer.

**Architecture:** Toda a lógica de filtro, facetas, ordenação e paginação é **pura e em memória** (`src/lib/util/catalog-filters.ts`, `catalog-facets.ts`), sobre os até 100 produtos que `listProducts` já busca por listagem. A camada de dados (`listProductsFiltered`) aplica essa lógica e devolve produtos + facetas. Um único server component (`ProductListing`) monta cabeçalho, barra de ferramentas, painel de filtros, grade, paginação e estado vazio; as três páginas (loja, categoria, coleção) viram invólucros finos. O card é um client component alimentado por um "card data" pré-calculado no servidor (`buildProductCardData`, puro, testado) que resolve cores pelo mapa da fase 1.

**Tech Stack:** Next 15.5 App Router · Medusa 2.15.5 Store API · Headless UI (Dialog para a gaveta mobile) · Tailwind (breakpoints do projeto: `small` = 1024px é desktop) · Vitest 3 (funções puras) · dataLayer/GTM já existente.

**Spec:** `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` — seções 6 (listagem), 7 (card), 11 (tracking) e 4.6. Fase 1 entregou 4.1–4.6 e 12 (ver `architecture/catalog.md`).

## Global Constraints

- Nunca adivinhar business logic; em ambiguidade, perguntar (CLAUDE.md). Dinheiro próprio em centavos; **preços da Store API do Medusa chegam em reais decimais** (`calculated_amount` = 169 → R$ 169) e o filtro de preço compara nessa unidade.
- Modalidade não existe. Nenhum filtro, categoria ou texto de "treino/casual/ideal para".
- Parâmetros de URL, em português, exatamente: `tamanho` (lista com vírgula), `cor` (lista com vírgula, nomes como no catálogo), `preco` (`min-max` em reais inteiros; `min-` e `-max` válidos), `disponivel` (`1`), `ordenar` (`novidades` padrão · `menor-preco` · `maior-preco` · `destaques`), `pagina` (inteiro ≥ 1, omitido quando 1). Parâmetros antigos `sortBy`/`page` recebem redirect **308** para os novos.
- 24 produtos por página, paginação numérica (componente existente adaptado). Sem infinite scroll.
- Um produto passa em tamanho/cor se **alguma variante disponível** (regra de `lib/util/availability.ts`) tem o valor; tamanho **e** cor exigem a **mesma** variante. Preço usa a variante mais barata com preço. "Só disponíveis" = `isProductAvailable`.
- Facetas: contagem de cada valor calculada com os **outros** filtros aplicados (o próprio ignorado). Tamanhos ordenados `PP, P, M, G, GG, XG` e depois os demais em ordem alfabética. Cores resolvidas por `resolveColor` (fase 1); comparação de nomes sempre via `normalizeColorName`.
- Canonical da listagem sem query. Qualquer filtro ativo ou `pagina > 1` ⇒ `robots: noindex, follow`. Ordenação sozinha não tira da indexação.
- Card: swatches (máx. 5 + "+n"), cor esgotada riscada, segunda foto no hover (desktop), selos com prioridade **Esgotado › Últimas peças › −X% › Novo** (um por vez, para a cor ativa), tamanhos com adição rápida no hover (desktop) e via botão "+" no mobile, imagem `quality={80}`. Links do card levam à PDP com `?v_id=<variante disponível da cor ativa>`.
- Eventos dataLayer (schema GA4, via `modules/analytics`): `view_item_list` (com `item_list_name`), `select_item`, `add_to_cart` na adição rápida, evento custom `filter_apply` (`filter_type`, `filter_value`).
- Texto em pt-BR. Commits `feat(vitrine)`/`fix(vitrine)`/`docs(...)`, mensagem terminando com `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. npm da raiz com `--workspace=apps/storefront`.
- Validação no navegador: dev server da vitrine contra o backend de produção, com gate desligado só no processo: `COMING_SOON_BYPASS=1 NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://endearing-enthusiasm-production-775b.up.railway.app npm run dev --workspace=apps/storefront` (porta 8000). Nunca alterar `.env.local` nem a flag em produção. Nenhuma task grava em produção; a adição rápida cria carrinho anônimo (normal).
- Fora desta fase: wizard pré-aplicando tamanho (F5), busca (F5), mega-menu/home/breadcrumb (F4), PDP (F3), "Avise-me" por categoria (a tabela `avise_me` é por produto — decisão: estado vazio não reusa `notify-me`).

---

## Mapa de arquivos (`apps/storefront/`)

**Create**
- `src/lib/util/catalog-filters.ts` (+ `.test.ts`) — estado de filtros ↔ URL, constantes.
- `src/lib/util/catalog-facets.ts` (+ `.test.ts`) — aplicar filtros, facetas, ordenação, paginação.
- `src/lib/util/product-card-data.ts` (+ `.test.ts`) — dados do card a partir do produto + mapa de cores.
- `src/modules/store/templates/product-listing.tsx` — server component único da listagem.
- `src/modules/store/components/filters/use-filter-navigation.ts`, `filter-panel.tsx`, `filter-drawer.tsx`, `active-chips.tsx`, `sort-select.tsx`, `listing-toolbar.tsx`, `empty-results.tsx`.
- `src/modules/categories/components/category-header/index.tsx`.
- `src/modules/products/components/product-card/index.tsx`, `swatches.tsx`, `quick-add.tsx`, `badge.tsx`.
- `src/modules/common/components/toast/index.tsx`.

**Modify**
- `src/lib/coming-soon.ts` (bypass por env em dev), `src/lib/data/products.ts` (`listProductsFiltered`), `src/lib/util/sort-products.ts` (delegar), `src/modules/store/components/pagination/index.tsx` (`pagina`), `src/modules/store/templates/index.tsx`, `src/modules/categories/templates/index.tsx`, `src/modules/collections/templates/index.tsx`, as três `page.tsx` (loja, categoria, coleção), `src/modules/products/components/product-preview/index.tsx` (vira invólucro do card), `src/modules/analytics/track.tsx` (`item_list_name`), `src/modules/analytics/items.ts` (`productsToItemList`), `architecture/catalog.md`, `progress.md`.

**Delete**
- `src/modules/store/components/refinement-list/` (substituído; `SortOptions` migra para `catalog-filters.ts`).

---

### Task 1: Bypass do gate em dev + estado de filtros ↔ URL

**Files:**
- Modify: `apps/storefront/src/lib/coming-soon.ts`
- Create: `apps/storefront/src/lib/util/catalog-filters.ts`, `apps/storefront/src/lib/util/catalog-filters.test.ts`

**Interfaces (Produces):**
```ts
export const PRODUCT_LIMIT = 24
export const SORT_KEYS = ["novidades", "menor-preco", "maior-preco", "destaques"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export type PriceRange = { min: number | null; max: number | null }
export type FilterState = { tamanho: string[]; cor: string[]; preco: PriceRange | null; disponivel: boolean; ordenar: SortKey; pagina: number }
export type SearchParamsLike = Record<string, string | string[] | undefined>
export const DEFAULT_FILTERS: FilterState
export function parseFilters(sp: SearchParamsLike): FilterState
export function serializeFilters(f: FilterState): string          // "" quando tudo padrão; sem "?"
export function hasActiveFilters(f: FilterState): boolean          // tamanho/cor/preco/disponivel
export function isIndexable(f: FilterState): boolean               // !hasActiveFilters && pagina === 1
export function legacyRedirectQuery(sp: SearchParamsLike): string | null // "ordenar=...&pagina=..." se vier sortBy/page; senão null
export const SORT_LABELS: Record<SortKey, string>
```

- [ ] **Step 1: Gate com bypass só por variável de processo**

`apps/storefront/src/lib/coming-soon.ts`:

```ts
// Loja "em construção": única fonte da flag, usada pelo middleware (gate de
// rota) e pelo sitemap. Para reabrir a loja, mude COMING_SOON para false e
// faça o deploy. Em desenvolvimento, `COMING_SOON_BYPASS=1` no processo do
// dev server desliga o gate SÓ naquele processo (a Vercel não tem a variável).
const BYPASS = process.env.NODE_ENV !== "production" && process.env.COMING_SOON_BYPASS === "1"
export const COMING_SOON = !BYPASS
export const COMING_SOON_PATH = "/em-breve"
```

- [ ] **Step 2: Teste que falha**

`apps/storefront/src/lib/util/catalog-filters.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  DEFAULT_FILTERS,
  hasActiveFilters,
  isIndexable,
  legacyRedirectQuery,
  parseFilters,
  serializeFilters,
} from "./catalog-filters"

describe("parseFilters", () => {
  it("sem params devolve o padrão", () => {
    expect(parseFilters({})).toEqual(DEFAULT_FILTERS)
  })
  it("lê listas, faixa, disponível, ordenação e página", () => {
    expect(
      parseFilters({ tamanho: "P, M ,,G", cor: "Licor,Verde Exército", preco: "150-220", disponivel: "1", ordenar: "menor-preco", pagina: "3" })
    ).toEqual({
      tamanho: ["P", "M", "G"],
      cor: ["Licor", "Verde Exército"],
      preco: { min: 150, max: 220 },
      disponivel: true,
      ordenar: "menor-preco",
      pagina: 3,
    })
  })
  it("faixa aberta e faixa inválida", () => {
    expect(parseFilters({ preco: "150-" }).preco).toEqual({ min: 150, max: null })
    expect(parseFilters({ preco: "-220" }).preco).toEqual({ min: null, max: 220 })
    expect(parseFilters({ preco: "abc" }).preco).toBeNull()
    expect(parseFilters({ preco: "300-100" }).preco).toEqual({ min: 100, max: 300 })
  })
  it("ordenação desconhecida e página inválida caem no padrão", () => {
    expect(parseFilters({ ordenar: "x" }).ordenar).toBe("novidades")
    expect(parseFilters({ pagina: "0" }).pagina).toBe(1)
    expect(parseFilters({ pagina: "abc" }).pagina).toBe(1)
  })
  it("aceita array (param repetido) usando o primeiro", () => {
    expect(parseFilters({ tamanho: ["P", "M"] }).tamanho).toEqual(["P"])
  })
  it("remove duplicatas de tamanho ignorando caixa", () => {
    expect(parseFilters({ tamanho: "p,P,m" }).tamanho).toEqual(["p", "m"])
  })
})

describe("serializeFilters", () => {
  it("padrão vira string vazia", () => {
    expect(serializeFilters(DEFAULT_FILTERS)).toBe("")
  })
  it("omite página 1 e ordenação padrão; codifica acento", () => {
    const q = serializeFilters({ ...DEFAULT_FILTERS, tamanho: ["G"], cor: ["Verde Exército"], preco: { min: 150, max: null }, disponivel: true, pagina: 2, ordenar: "destaques" })
    expect(q).toBe("tamanho=G&cor=Verde+Ex%C3%A9rcito&preco=150-&disponivel=1&ordenar=destaques&pagina=2")
  })
  it("ida e volta", () => {
    const f = { ...DEFAULT_FILTERS, tamanho: ["P", "M"], cor: ["Licor"], preco: { min: null, max: 220 }, pagina: 4 }
    expect(parseFilters(Object.fromEntries(new URLSearchParams(serializeFilters(f))))).toEqual(f)
  })
})

describe("hasActiveFilters / isIndexable", () => {
  it("ordenação e página não são filtros; página > 1 tira da indexação", () => {
    expect(hasActiveFilters({ ...DEFAULT_FILTERS, ordenar: "destaques" })).toBe(false)
    expect(isIndexable({ ...DEFAULT_FILTERS, ordenar: "destaques" })).toBe(true)
    expect(isIndexable({ ...DEFAULT_FILTERS, pagina: 2 })).toBe(false)
    expect(isIndexable({ ...DEFAULT_FILTERS, cor: ["Licor"] })).toBe(false)
  })
})

describe("legacyRedirectQuery", () => {
  it("mapeia sortBy/page antigos", () => {
    expect(legacyRedirectQuery({ sortBy: "price_asc", page: "2" })).toBe("ordenar=menor-preco&pagina=2")
    expect(legacyRedirectQuery({ sortBy: "created_at" })).toBe("")
    expect(legacyRedirectQuery({ page: "1" })).toBe("")
  })
  it("sem params antigos devolve null", () => {
    expect(legacyRedirectQuery({ tamanho: "P" })).toBeNull()
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

`npm test --workspace=apps/storefront` → FAIL `Cannot find module './catalog-filters'`.

- [ ] **Step 4: Implementar**

`apps/storefront/src/lib/util/catalog-filters.ts`:

```ts
// Estado dos filtros da listagem ↔ query string (spec §6.2). Puro, sem I/O.

export const PRODUCT_LIMIT = 24
export const SORT_KEYS = ["novidades", "menor-preco", "maior-preco", "destaques"] as const
export type SortKey = (typeof SORT_KEYS)[number]
export const SORT_LABELS: Record<SortKey, string> = {
  novidades: "Novidades",
  "menor-preco": "Menor preço",
  "maior-preco": "Maior preço",
  destaques: "Destaques",
}

export type PriceRange = { min: number | null; max: number | null }
export type FilterState = {
  tamanho: string[]
  cor: string[]
  preco: PriceRange | null
  disponivel: boolean
  ordenar: SortKey
  pagina: number
}
export type SearchParamsLike = Record<string, string | string[] | undefined>

export const DEFAULT_FILTERS: FilterState = {
  tamanho: [],
  cor: [],
  preco: null,
  disponivel: false,
  ordenar: "novidades",
  pagina: 1,
}

const first = (v: string | string[] | undefined): string | undefined => (Array.isArray(v) ? v[0] : v)

function parseList(raw: string | undefined): string[] {
  if (!raw) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const v = part.trim()
    if (!v) continue
    const k = v.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}

function parsePrice(raw: string | undefined): PriceRange | null {
  if (!raw) return null
  const m = raw.trim().match(/^(\d*)-(\d*)$/)
  if (!m) return null
  const min = m[1] ? Number(m[1]) : null
  const max = m[2] ? Number(m[2]) : null
  if (min === null && max === null) return null
  if (min !== null && max !== null && min > max) return { min: max, max: min }
  return { min, max }
}

export function parseFilters(sp: SearchParamsLike): FilterState {
  const ordenarRaw = first(sp.ordenar)
  const ordenar = (SORT_KEYS as readonly string[]).includes(ordenarRaw ?? "") ? (ordenarRaw as SortKey) : "novidades"
  const paginaNum = Number(first(sp.pagina))
  const pagina = Number.isInteger(paginaNum) && paginaNum >= 1 ? paginaNum : 1
  return {
    tamanho: parseList(first(sp.tamanho)),
    cor: parseList(first(sp.cor)),
    preco: parsePrice(first(sp.preco)),
    disponivel: first(sp.disponivel) === "1",
    ordenar,
    pagina,
  }
}

export function hasActiveFilters(f: FilterState): boolean {
  return f.tamanho.length > 0 || f.cor.length > 0 || f.preco !== null || f.disponivel
}

export function isIndexable(f: FilterState): boolean {
  return !hasActiveFilters(f) && f.pagina === 1
}

export function serializeFilters(f: FilterState): string {
  const p = new URLSearchParams()
  if (f.tamanho.length) p.set("tamanho", f.tamanho.join(","))
  if (f.cor.length) p.set("cor", f.cor.join(","))
  if (f.preco && (f.preco.min !== null || f.preco.max !== null))
    p.set("preco", `${f.preco.min ?? ""}-${f.preco.max ?? ""}`)
  if (f.disponivel) p.set("disponivel", "1")
  if (f.ordenar !== "novidades") p.set("ordenar", f.ordenar)
  if (f.pagina > 1) p.set("pagina", String(f.pagina))
  return p.toString()
}

// Parâmetros do starter (sortBy/page) → novos. Devolve null quando não há legado.
const LEGACY_SORT: Record<string, SortKey> = {
  created_at: "novidades",
  price_asc: "menor-preco",
  price_desc: "maior-preco",
}
export function legacyRedirectQuery(sp: SearchParamsLike): string | null {
  const sortBy = first(sp.sortBy)
  const page = first(sp.page)
  if (sortBy === undefined && page === undefined) return null
  const rest: SearchParamsLike = { ...sp }
  delete rest.sortBy
  delete rest.page
  const f = parseFilters(rest)
  if (sortBy && LEGACY_SORT[sortBy]) f.ordenar = LEGACY_SORT[sortBy]
  const n = Number(page)
  if (Number.isInteger(n) && n >= 1) f.pagina = n
  return serializeFilters(f)
}
```

- [ ] **Step 5: Rodar e ver passar**

`npm test --workspace=apps/storefront` → PASS (26 anteriores + 13 novos = 39).

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/coming-soon.ts apps/storefront/src/lib/util/catalog-filters.ts apps/storefront/src/lib/util/catalog-filters.test.ts
git commit -m "feat(vitrine): estado de filtros ↔ URL (tamanho, cor, preco, disponivel, ordenar, pagina) + bypass do gate só em dev"
```

---

### Task 2: Aplicar filtros, facetas, ordenação e paginação (puro)

**Files:**
- Create: `apps/storefront/src/lib/util/catalog-facets.ts`, `apps/storefront/src/lib/util/catalog-facets.test.ts`
- Modify: `apps/storefront/src/lib/util/sort-products.ts` (delega para `sortByKey`; mantém a assinatura antiga só até a Task 4 remover os usos)

**Interfaces (Produces):**
```ts
export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG"]
export function sortSizes(values: string[]): string[]
export function variantSize(product, v): string | null
export function variantColor(product, v): string | null
export function productMinPrice(product): number | null           // calculated_amount da variante mais barata (reais)
export function matchesFilters(product, f: FilterState, ignore?: "tamanho" | "cor" | "preco" | "disponivel"): boolean
export function applyFilters(products, f): products
export type Facets = { tamanhos: { value: string; count: number }[]; cores: { name: string; count: number }[]; preco: { min: number; max: number } | null }
export function computeFacets(products, f): Facets               // contagens com os OUTROS filtros aplicados
export function sortByKey(products, key: SortKey): products      // não muta a entrada
export function paginate<T>(items: T[], pagina: number, limit?: number): { items: T[]; totalPages: number; pagina: number }
```
Consome: `isVariantAvailable`, `isProductAvailable`, `optionValue` (fase 1) e `normalizeColorName`.

- [ ] **Step 1: Teste que falha**

`apps/storefront/src/lib/util/catalog-facets.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { DEFAULT_FILTERS } from "./catalog-filters"
import { applyFilters, computeFacets, paginate, productMinPrice, sortByKey, sortSizes } from "./catalog-facets"

type P = HttpTypes.StoreProduct
const OPTS = [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }]
const v = (id: string, tam: string, cor: string, qty: number, price: number) =>
  ({
    id,
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: qty,
    options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
    calculated_price: { calculated_amount: price, original_amount: price, currency_code: "brl", calculated_price: { price_list_type: "default" } },
  }) as unknown as HttpTypes.StoreProductVariant
const prod = (id: string, created: string, variants: HttpTypes.StoreProductVariant[], metadata: Record<string, unknown> = {}) =>
  ({ id, title: id, handle: id, created_at: created, options: OPTS, variants, metadata }) as unknown as P

const LEG = prod("legging", "2026-09-01", [v("l1", "P", "Verde Exercito", 2, 219), v("l2", "G", "Verde Exercito", 0, 219), v("l3", "G", "Licor", 4, 219)])
const TOP = prod("top", "2026-08-01", [v("t1", "P", "Licor", 1, 169), v("t2", "M", "Licor", 3, 169)], { destaque_rank: "1" })
const SHORT = prod("short", "2026-07-01", [v("s1", "M", "Blackout", 0, 149)], { destaque_rank: "0" })
const ALL = [LEG, TOP, SHORT]

describe("productMinPrice / sortSizes", () => {
  it("menor preço entre as variantes com preço", () => {
    expect(productMinPrice(LEG)).toBe(219)
    expect(productMinPrice({ ...LEG, variants: [] } as P)).toBeNull()
  })
  it("ordena P/M/G/GG antes e o resto alfabético", () => {
    expect(sortSizes(["GG", "34-38", "P", "G", "39-43", "M"])).toEqual(["P", "M", "G", "GG", "34-38", "39-43"])
  })
})

describe("applyFilters", () => {
  it("tamanho exige variante disponível", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["G"] }).map((p) => p.id)).toEqual(["legging"]) // l3 G Licor disponível
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["M"] }).map((p) => p.id)).toEqual(["top"]) // short M esgotado
  })
  it("tamanho E cor na mesma variante", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["G"], cor: ["Verde Exército"] })).toEqual([]) // l2 G verde esgotado
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, tamanho: ["P"], cor: ["Verde Exército"] }).map((p) => p.id)).toEqual(["legging"])
  })
  it("cor compara ignorando acento e caixa", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, cor: ["verde exército"] }).map((p) => p.id)).toEqual(["legging"])
  })
  it("preço usa a variante mais barata; faixa aberta", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, preco: { min: 160, max: 200 } }).map((p) => p.id)).toEqual(["top"])
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, preco: { min: null, max: 150 } }).map((p) => p.id)).toEqual(["short"])
  })
  it("só disponíveis remove produto esgotado", () => {
    expect(applyFilters(ALL, { ...DEFAULT_FILTERS, disponivel: true }).map((p) => p.id)).toEqual(["legging", "top"])
  })
})

describe("computeFacets", () => {
  it("conta valores com os outros filtros aplicados e ignora o próprio", () => {
    const f = computeFacets(ALL, { ...DEFAULT_FILTERS, cor: ["Licor"] })
    expect(f.tamanhos).toEqual([{ value: "P", count: 1 }, { value: "M", count: 1 }, { value: "G", count: 1 }])
    // faceta de cor ignora o filtro de cor: todas as cores disponíveis
    expect(f.cores.map((c) => c.name)).toEqual(["Verde Exercito", "Licor"]) // Blackout só em variante esgotada → não conta
    expect(f.preco).toEqual({ min: 169, max: 219 })
  })
  it("sem produtos devolve facetas vazias", () => {
    expect(computeFacets([], DEFAULT_FILTERS)).toEqual({ tamanhos: [], cores: [], preco: null })
  })
})

describe("sortByKey", () => {
  it("novidades por created_at desc; preços; destaques por destaque_rank e depois novidades", () => {
    expect(sortByKey(ALL, "novidades").map((p) => p.id)).toEqual(["legging", "top", "short"])
    expect(sortByKey(ALL, "menor-preco").map((p) => p.id)).toEqual(["short", "top", "legging"])
    expect(sortByKey(ALL, "maior-preco").map((p) => p.id)).toEqual(["legging", "top", "short"])
    expect(sortByKey(ALL, "destaques").map((p) => p.id)).toEqual(["short", "top", "legging"])
  })
  it("não muta a entrada", () => {
    const copy = [...ALL]
    sortByKey(ALL, "menor-preco")
    expect(ALL).toEqual(copy)
  })
})

describe("paginate", () => {
  it("24 por página e página fora do intervalo cai na última", () => {
    const items = Array.from({ length: 50 }, (_, i) => i)
    expect(paginate(items, 1).items.length).toBe(24)
    expect(paginate(items, 3).items).toEqual([48, 49])
    expect(paginate(items, 9)).toEqual({ items: [48, 49], totalPages: 3, pagina: 3 })
    expect(paginate([], 1)).toEqual({ items: [], totalPages: 1, pagina: 1 })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `Cannot find module './catalog-facets'`.

- [ ] **Step 3: Implementar**

`apps/storefront/src/lib/util/catalog-facets.ts`:

```ts
// Filtro em memória, facetas, ordenação e paginação da listagem (spec §6.1).
// Puro: opera sobre os produtos já buscados (até 100 por listagem — limite
// conhecido; acima disso migrar tamanho/cor para `variants.options.value` na Store API).
import type { HttpTypes } from "@medusajs/types"
import { isProductAvailable, isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName } from "./colors"
import { PRODUCT_LIMIT, type FilterState, type SortKey } from "./catalog-filters"

type Product = HttpTypes.StoreProduct
type Variant = HttpTypes.StoreProductVariant & { calculated_price?: { calculated_amount?: number | null } | null }

export const SIZE_ORDER = ["PP", "P", "M", "G", "GG", "XG"]

export function sortSizes(values: string[]): string[] {
  const rank = (s: string) => {
    const i = SIZE_ORDER.indexOf(s.toUpperCase())
    return i === -1 ? SIZE_ORDER.length : i
  }
  return [...values].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "pt-BR"))
}

export function variantSize(product: Product, v: Variant): string | null {
  return optionValue(product.options, v as StockVariant, "Tamanho")
}
export function variantColor(product: Product, v: Variant): string | null {
  return optionValue(product.options, v as StockVariant, "Cor")
}

export function productMinPrice(product: Product): number | null {
  const prices = ((product.variants ?? []) as Variant[])
    .map((v) => v.calculated_price?.calculated_amount)
    .filter((n): n is number => typeof n === "number")
  return prices.length ? Math.min(...prices) : null
}

const sameColor = (a: string | null, b: string) => a !== null && normalizeColorName(a) === normalizeColorName(b)
const inList = (value: string | null, list: string[]) => value !== null && list.some((x) => x.toLowerCase() === value.toLowerCase())

export function matchesFilters(
  product: Product,
  f: FilterState,
  ignore?: "tamanho" | "cor" | "preco" | "disponivel"
): boolean {
  const tamanho = ignore === "tamanho" ? [] : f.tamanho
  const cor = ignore === "cor" ? [] : f.cor
  const preco = ignore === "preco" ? null : f.preco
  const disponivel = ignore === "disponivel" ? false : f.disponivel
  const variants = (product.variants ?? []) as Variant[]

  if (tamanho.length || cor.length) {
    const ok = variants.some((v) => {
      if (!isVariantAvailable(v as StockVariant)) return false
      if (tamanho.length && !inList(variantSize(product, v), tamanho)) return false
      if (cor.length && !cor.some((c) => sameColor(variantColor(product, v), c))) return false
      return true
    })
    if (!ok) return false
  }
  if (preco) {
    const min = productMinPrice(product)
    if (min === null) return false
    if (preco.min !== null && min < preco.min) return false
    if (preco.max !== null && min > preco.max) return false
  }
  if (disponivel && !isProductAvailable(variants as StockVariant[])) return false
  return true
}

export function applyFilters(products: Product[], f: FilterState): Product[] {
  return products.filter((p) => matchesFilters(p, f))
}

export type Facets = {
  tamanhos: { value: string; count: number }[]
  cores: { name: string; count: number }[]
  preco: { min: number; max: number } | null
}

export function computeFacets(products: Product[], f: FilterState): Facets {
  const sizeCount = new Map<string, number>()
  const colorCount = new Map<string, { name: string; count: number }>()
  const prices: number[] = []

  for (const p of products) {
    const variants = (p.variants ?? []) as Variant[]
    if (matchesFilters(p, f, "tamanho")) {
      const sizes = new Set<string>()
      for (const v of variants) {
        if (!isVariantAvailable(v as StockVariant)) continue
        if (f.cor.length && !f.cor.some((c) => sameColor(variantColor(p, v), c))) continue
        const s = variantSize(p, v)
        if (s) sizes.add(s)
      }
      sizes.forEach((s) => sizeCount.set(s, (sizeCount.get(s) ?? 0) + 1))
    }
    if (matchesFilters(p, f, "cor")) {
      const colors = new Map<string, string>()
      for (const v of variants) {
        if (!isVariantAvailable(v as StockVariant)) continue
        if (f.tamanho.length && !inList(variantSize(p, v), f.tamanho)) continue
        const c = variantColor(p, v)
        if (c) colors.set(normalizeColorName(c), c)
      }
      colors.forEach((name, key) => {
        const cur = colorCount.get(key)
        colorCount.set(key, { name: cur?.name ?? name, count: (cur?.count ?? 0) + 1 })
      })
    }
    if (matchesFilters(p, f, "preco")) {
      const min = productMinPrice(p)
      if (min !== null) prices.push(min)
    }
  }

  return {
    tamanhos: sortSizes([...sizeCount.keys()]).map((value) => ({ value, count: sizeCount.get(value)! })),
    cores: [...colorCount.values()],
    preco: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
  }
}

const createdAt = (p: Product) => (p.created_at ? Date.parse(String(p.created_at)) : 0)
const destaqueRank = (p: Product): number | null => {
  const raw = (p.metadata as Record<string, unknown> | null | undefined)?.destaque_rank
  const n = Number(raw)
  return raw === undefined || raw === null || raw === "" || !Number.isFinite(n) ? null : n
}

export function sortByKey(products: Product[], key: SortKey): Product[] {
  const out = [...products]
  const byNew = (a: Product, b: Product) => createdAt(b) - createdAt(a)
  if (key === "novidades") return out.sort(byNew)
  if (key === "menor-preco" || key === "maior-preco") {
    const sign = key === "menor-preco" ? 1 : -1
    return out.sort((a, b) => {
      const pa = productMinPrice(a) ?? Infinity
      const pb = productMinPrice(b) ?? Infinity
      return pa === pb ? byNew(a, b) : sign * (pa - pb)
    })
  }
  return out.sort((a, b) => {
    const ra = destaqueRank(a)
    const rb = destaqueRank(b)
    if (ra === null && rb === null) return byNew(a, b)
    if (ra === null) return 1
    if (rb === null) return -1
    return ra === rb ? byNew(a, b) : ra - rb
  })
}

export function paginate<T>(items: T[], pagina: number, limit = PRODUCT_LIMIT): { items: T[]; totalPages: number; pagina: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / limit))
  const p = Math.min(Math.max(1, pagina), totalPages)
  return { items: items.slice((p - 1) * limit, p * limit), totalPages, pagina: p }
}
```

- [ ] **Step 4: Rodar e ver passar** → 39 + 14 = 53 testes.

- [ ] **Step 5: `sort-products.ts` delega (compatibilidade até a Task 4)**

Substituir o corpo de `apps/storefront/src/lib/util/sort-products.ts` por:

```ts
import { HttpTypes } from "@medusajs/types"
import { sortByKey } from "./catalog-facets"

// Compatibilidade com o starter: chaves antigas → sortByKey. Removido na Task 4.
export type SortOptions = "price_asc" | "price_desc" | "created_at"
const MAP = { created_at: "novidades", price_asc: "menor-preco", price_desc: "maior-preco" } as const
export function sortProducts(products: HttpTypes.StoreProduct[], sortBy: SortOptions): HttpTypes.StoreProduct[] {
  return sortByKey(products, MAP[sortBy] ?? "novidades")
}
```

Atualizar os imports de `SortOptions` que apontavam para `@modules/store/components/refinement-list/sort-products` (em `lib/data/products.ts`) para `@lib/util/sort-products`. `npx tsc -p apps/storefront --noEmit` limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/util/catalog-facets.ts apps/storefront/src/lib/util/catalog-facets.test.ts apps/storefront/src/lib/util/sort-products.ts apps/storefront/src/lib/data/products.ts
git commit -m "feat(vitrine): filtros em memória, facetas com contagem, ordenação (novidades/preço/destaques) e paginação de 24"
```

---

### Task 3: Camada de dados — `listProductsFiltered`

**Files:**
- Modify: `apps/storefront/src/lib/data/products.ts`

**Interfaces (Produces):**
```ts
export type ListingScope = { categoryIds?: string[]; collectionId?: string; productIds?: string[] }
export type ListingResult = { products: HttpTypes.StoreProduct[]; count: number; total: number; totalPages: number; pagina: number; facets: Facets }
export async function listProductsFiltered(args: { filters: FilterState; scope: ListingScope; countryCode: string }): Promise<ListingResult>
```
`count` = após filtros; `total` = antes. `categoryIds` recebe a categoria **e as filhas** (página da mãe lista tudo das filhas).

- [ ] **Step 1: Implementar**

Adicionar ao fim de `apps/storefront/src/lib/data/products.ts`:

```ts
import { applyFilters, computeFacets, paginate, sortByKey, type Facets } from "@lib/util/catalog-facets"
import type { FilterState } from "@lib/util/catalog-filters"

export type ListingScope = { categoryIds?: string[]; collectionId?: string; productIds?: string[] }
export type ListingResult = {
  products: HttpTypes.StoreProduct[]
  count: number
  total: number
  totalPages: number
  pagina: number
  facets: Facets
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

  const {
    response: { products: all },
  } = await listProducts({ pageParam: 1, queryParams, countryCode })

  const filtered = sortByKey(applyFilters(all, filters), filters.ordenar)
  const page = paginate(filtered, filters.pagina)
  return {
    products: page.items,
    count: filtered.length,
    total: all.length,
    totalPages: page.totalPages,
    pagina: page.pagina,
    facets: computeFacets(all, filters),
  }
}
```

(Mover os `import` para o topo do arquivo, com os demais.) `listProductsWithSort` continua existindo até a Task 4 remover seus usos; depois, apagar.

- [ ] **Step 2: Verificar** — `npx tsc -p apps/storefront --noEmit` limpo; `npm test` verde.

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/lib/data/products.ts
git commit -m "feat(vitrine): listProductsFiltered — escopo + filtros + facetas + paginação sobre a Store API"
```

---

### Task 4: `ProductListing`, páginas com novos params, redirect 308, noindex, contagem, estado vazio, `view_item_list`

**Files:**
- Create: `apps/storefront/src/modules/store/templates/product-listing.tsx`, `apps/storefront/src/modules/store/components/filters/empty-results.tsx`
- Modify: `apps/storefront/src/modules/store/templates/index.tsx`, `apps/storefront/src/modules/categories/templates/index.tsx`, `apps/storefront/src/modules/collections/templates/index.tsx`, `apps/storefront/src/app/[countryCode]/(main)/store/page.tsx`, `.../categories/[...category]/page.tsx`, `.../collections/[handle]/page.tsx`, `apps/storefront/src/modules/store/components/pagination/index.tsx`, `apps/storefront/src/modules/analytics/track.tsx`, `apps/storefront/src/modules/analytics/items.ts`
- Delete: `apps/storefront/src/modules/store/templates/paginated-products.tsx`, `apps/storefront/src/modules/store/components/refinement-list/` (inteiro), `listProductsWithSort` + `sortProducts` (`lib/util/sort-products.ts`)

**Interfaces:**
- `ProductListing` props: `{ filters: FilterState; scope: ListingScope; countryCode: string; listName: string; header?: React.ReactNode }`. Renderiza: `header`, `<ListingToolbar>` (Task 5 — nesta task, um placeholder server com a contagem e o `<SortSelect>` chegará na Task 5; aqui use só a contagem), sidebar `<FilterPanel>` (Task 5; aqui deixe o `<aside>` vazio com `id="filtros"`), grade com `<ProductPreview>` (card atual, trocado na Task 8), `<Pagination>`, `<EmptyResults>` e `<Track event="view_item_list">`.
- `EmptyResults` props: `{ filters: FilterState; countryCode: string }` — client; "Nenhuma peça com esses filtros." + botões "Ver em outras cores" (remove só `cor`), "Ver todos os tamanhos" (remove só `tamanho`), "Limpar filtros". Usa `serializeFilters` + `LocalizedClientLink`.
- `items.ts`: `productsToItemList(products, listName): EcommercePayload` (items com `index`), `EcommercePayload.item_list_name?: string`, `GA4Item.index?: number`.

- [ ] **Step 1: Analytics — `item_list_name`**

`track.tsx`: adicionar `index?: number` a `GA4Item` e `item_list_name?: string` a `EcommercePayload`. `items.ts`: adicionar

```ts
export function productsToItemList(products: HttpTypes.StoreProduct[], listName: string): EcommercePayload {
  return {
    item_list_name: listName,
    items: products.map((p, i): GA4Item => {
      const v: any = p.variants?.[0]
      return {
        item_id: v?.sku || p.id,
        item_name: p.title || undefined,
        price: n(v?.calculated_price?.calculated_amount),
        index: i,
        item_category: (p.categories?.[0] as any)?.name,
      }
    }),
  }
}
```

- [ ] **Step 2: Paginação usa `pagina`**

Em `pagination/index.tsx`, `handlePageChange`: `params.set("pagina", newPage.toString())` e, quando `newPage === 1`, `params.delete("pagina")`. Rótulos e classes inalterados.

- [ ] **Step 3: `EmptyResults`**

`apps/storefront/src/modules/store/components/filters/empty-results.tsx`:

```tsx
"use client"

import { usePathname } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { DEFAULT_FILTERS, serializeFilters, type FilterState } from "@lib/util/catalog-filters"

// Estado vazio útil (spec §6.3): sempre oferece um caminho de volta.
export default function EmptyResults({ filters }: { filters: FilterState }) {
  const pathname = usePathname()
  const link = (f: FilterState) => {
    const q = serializeFilters({ ...f, pagina: 1 })
    return q ? `${pathname}?${q}` : pathname
  }
  const partes: string[] = []
  if (filters.tamanho.length) partes.push(`tamanho ${filters.tamanho.join("/")}`)
  if (filters.cor.length) partes.push(`cor ${filters.cor.join("/")}`)
  return (
    <div className="py-16 text-center flex flex-col items-center gap-4" data-testid="empty-results">
      <p className="font-serif text-2xl text-eclat-grafite">
        Nenhuma peça {partes.length ? `em ${partes.join(" e ")}` : "com esses filtros"}.
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        {filters.cor.length > 0 && (
          <a href={link({ ...filters, cor: [] })} className="underline text-eclat-terracota">Ver em outras cores</a>
        )}
        {filters.tamanho.length > 0 && (
          <a href={link({ ...filters, tamanho: [] })} className="underline text-eclat-terracota">Ver todos os tamanhos</a>
        )}
        <a href={link({ ...DEFAULT_FILTERS, ordenar: filters.ordenar })} className="underline text-eclat-grafite/70">Limpar filtros</a>
        <LocalizedClientLink href="/store?ordenar=novidades" className="underline text-eclat-grafite/70">Ver novidades</LocalizedClientLink>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `ProductListing`**

`apps/storefront/src/modules/store/templates/product-listing.tsx`:

```tsx
import type { ReactNode } from "react"
import { listProductsFiltered, type ListingScope } from "@lib/data/products"
import { getRegion } from "@lib/data/regions"
import { getBaseURL } from "@lib/util/env"
import type { FilterState } from "@lib/util/catalog-filters"
import ProductPreview from "@modules/products/components/product-preview"
import { ItemListJsonLd } from "@modules/seo/jsonld"
import { Pagination } from "@modules/store/components/pagination"
import EmptyResults from "@modules/store/components/filters/empty-results"
import Track from "@modules/analytics/track"
import { productsToItemList } from "@modules/analytics/items"

// Listagem única (loja, categoria, coleção): cabeçalho + ferramentas + filtros + grade.
export default async function ProductListing({
  filters,
  scope,
  countryCode,
  listName,
  header,
}: {
  filters: FilterState
  scope: ListingScope
  countryCode: string
  listName: string
  header?: ReactNode
}) {
  const region = await getRegion(countryCode)
  if (!region) return null
  const result = await listProductsFiltered({ filters, scope, countryCode })
  const base = getBaseURL()

  return (
    <div className="content-container py-6" data-testid="category-container">
      {header}
      <div className="flex items-center justify-between mb-6 text-sm text-eclat-grafite/70" data-testid="listing-toolbar">
        <span data-testid="result-count">
          {result.count === result.total ? `${result.total} peças` : `${result.count} de ${result.total} peças`}
        </span>
        {/* Task 5: ordenação + botão de filtros (mobile) entram aqui */}
      </div>
      <div className="flex flex-col small:flex-row small:items-start gap-8">
        <aside id="filtros" className="hidden small:block small:w-[250px] shrink-0">
          {/* Task 5: <FilterPanel facets={result.facets} filters={filters} /> */}
        </aside>
        <div className="w-full">
          {result.count === 0 ? (
            <EmptyResults filters={filters} />
          ) : (
            <>
              <ItemListJsonLd
                name={listName}
                items={result.products.filter((p) => p.handle).map((p) => ({ name: p.title ?? "", url: `${base}/${countryCode}/products/${p.handle}` }))}
              />
              <Track event="view_item_list" ecommerce={productsToItemList(result.products, listName)} />
              <ul className="grid grid-cols-2 w-full small:grid-cols-3 medium:grid-cols-4 gap-x-6 gap-y-8" data-testid="products-list">
                {result.products.map((p) => (
                  <li key={p.id}>
                    <ProductPreview product={p} region={region} />
                  </li>
                ))}
              </ul>
              {result.totalPages > 1 && <Pagination page={result.pagina} totalPages={result.totalPages} data-testid="product-pagination" />}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Templates viram invólucros finos**

`modules/store/templates/index.tsx`:

```tsx
import type { FilterState } from "@lib/util/catalog-filters"
import ProductListing from "./product-listing"

export default function StoreTemplate({ filters, countryCode }: { filters: FilterState; countryCode: string }) {
  return (
    <ProductListing
      filters={filters}
      scope={{}}
      countryCode={countryCode}
      listName="Todos os produtos"
      header={<h1 className="font-serif text-3xl text-eclat-grafite mb-6" data-testid="store-page-title">Todos os produtos</h1>}
    />
  )
}
```

`modules/collections/templates/index.tsx`: mesmo formato com `scope={{ collectionId: collection.id }}`, `listName={collection.title}`, `header={<h1 …>{collection.title}</h1>}`.

`modules/categories/templates/index.tsx`: recebe `{ category, filters, countryCode }`; `scope={{ categoryIds: [category.id, ...(category.category_children ?? []).map((c) => c.id)] }}`; `listName={category.name}`; `header` = por ora o `<h1>` com o nome (a Task 6 troca por `<CategoryHeader>`). Remover `parents`/`InteractiveLink`/descrição antiga.

- [ ] **Step 6: Páginas — params novos, redirect 308, noindex**

Nas três `page.tsx`, o tipo de `searchParams` vira `Promise<Record<string, string | string[] | undefined>>`. No componente da página:

```ts
import { permanentRedirect } from "next/navigation"
import { isIndexable, legacyRedirectQuery, parseFilters } from "@lib/util/catalog-filters"
// ...
const sp = await props.searchParams
const legacy = legacyRedirectQuery(sp)
if (legacy !== null) permanentRedirect(legacy ? `${path}?${legacy}` : path) // path = "/{cc}/store" etc.
const filters = parseFilters(sp)
```

Em `generateMetadata` de cada uma, além do canonical já existente (sem query), adicionar:

```ts
robots: isIndexable(parseFilters(await props.searchParams)) ? undefined : { index: false, follow: true },
```

(`props.searchParams` já está disponível em `generateMetadata` no App Router.) Passar `filters` para os templates. Apagar `paginated-products.tsx`, a pasta `refinement-list/`, `listProductsWithSort` e `lib/util/sort-products.ts`; corrigir imports órfãos (`grep -rn "refinement-list\|listProductsWithSort\|sort-products" apps/storefront/src` deve devolver vazio).

- [ ] **Step 7: Validar no navegador**

Subir a vitrine (comando das Global Constraints). Abrir `http://localhost:8000/br/categories/leggings?tamanho=G&cor=Verde%20Exercito`: contagem "n de m peças", grade só com leggings que têm G Verde disponível; `?sortBy=price_asc&page=2` redireciona (308 no console de rede) para `?ordenar=menor-preco&pagina=2`; `?cor=Roxo` mostra o estado vazio com "Ver em outras cores"; `view-source` da página filtrada contém `noindex`; dataLayer tem `view_item_list` (console: `dataLayer.filter(e=>e.event==='view_item_list')`). `tsc` limpo, testes verdes.

- [ ] **Step 8: Commit**

```bash
git add -A apps/storefront/src
git commit -m "feat(vitrine): listagem única com filtros por URL, redirect 308 dos params antigos, noindex quando filtrado, contagem, estado vazio e view_item_list"
```

---

### Task 5: Interface dos filtros — painel desktop, gaveta mobile, chips, ordenação, `filter_apply`

**Files:**
- Create: `apps/storefront/src/modules/store/components/filters/use-filter-navigation.ts`, `filter-panel.tsx`, `filter-drawer.tsx`, `active-chips.tsx`, `sort-select.tsx`, `listing-toolbar.tsx`
- Modify: `apps/storefront/src/modules/store/templates/product-listing.tsx`

**Interfaces:**
- Hook `useFilterNavigation(filters)` → `{ filters, replace(next: FilterState), toggleList(field: "tamanho" | "cor", value: string), setPrice(range: PriceRange | null), setDisponivel(on: boolean), setSort(key: SortKey), clear() }`. Toda mudança zera `pagina`, faz `router.push(pathname + "?" + serializeFilters(...))` e empurra `{ event: "filter_apply", filter_type, filter_value }` no dataLayer (`filter_type` ∈ `tamanho|cor|preco|disponivel|ordenar|limpar`).
- `FilterPanel` props `{ facets: Facets; filters: FilterState; colorMap: ColorMap }` — client. Grupos: Tamanho (chips com contagem), Cor (círculo `hex`/`swatch_url` via `resolveColor` + nome + contagem), Preço (dois inputs numéricos "de/até" com botão "Aplicar" + atalhos "até R$ 169", "R$ 170–219", "acima de R$ 220" gerados a partir de `facets.preco`), "Só disponíveis" (toggle). "Limpar tudo" quando `hasActiveFilters`.
- `FilterDrawer` props idem — client; botão "Filtrar (n)" abre `Dialog` (Headless UI) inferior no mobile (`small:hidden`), com `FilterPanel` dentro e botão "Ver n peças" que fecha.
- `ActiveChips` props `{ filters }` — chips removíveis por valor + "Limpar tudo".
- `SortSelect` props `{ value: SortKey }` — `<select>` nativo com `SORT_LABELS`.
- `ListingToolbar` props `{ count, total, filters, facets, colorMap }` — contagem + `SortSelect` + `FilterDrawer` (mobile) + `ActiveChips` na linha de baixo.

- [ ] **Step 1: Hook**

```ts
"use client"

import { usePathname, useRouter } from "next/navigation"
import { useCallback } from "react"
import { DEFAULT_FILTERS, serializeFilters, type FilterState, type PriceRange, type SortKey } from "@lib/util/catalog-filters"

type FilterType = "tamanho" | "cor" | "preco" | "disponivel" | "ordenar" | "limpar"

function track(filter_type: FilterType, filter_value: string) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: "filter_apply", filter_type, filter_value })
  } catch {}
}

// Navegação dos filtros: toda mudança vira URL (compartilhável, botão voltar funciona).
export function useFilterNavigation(filters: FilterState) {
  const router = useRouter()
  const pathname = usePathname()

  const replace = useCallback(
    (next: FilterState, type: FilterType, value: string) => {
      const q = serializeFilters({ ...next, pagina: 1 })
      track(type, value)
      router.push(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [router, pathname]
  )

  return {
    filters,
    toggleList: (field: "tamanho" | "cor", value: string) => {
      const has = filters[field].some((x) => x.toLowerCase() === value.toLowerCase())
      const list = has ? filters[field].filter((x) => x.toLowerCase() !== value.toLowerCase()) : [...filters[field], value]
      replace({ ...filters, [field]: list }, field, `${has ? "-" : "+"}${value}`)
    },
    setPrice: (preco: PriceRange | null) => replace({ ...filters, preco }, "preco", preco ? `${preco.min ?? ""}-${preco.max ?? ""}` : ""),
    setDisponivel: (on: boolean) => replace({ ...filters, disponivel: on }, "disponivel", on ? "1" : "0"),
    setSort: (ordenar: SortKey) => replace({ ...filters, ordenar }, "ordenar", ordenar),
    clear: () => replace({ ...DEFAULT_FILTERS, ordenar: filters.ordenar }, "limpar", ""),
  }
}
```

- [ ] **Step 2: `FilterPanel`**

```tsx
"use client"

import { useState } from "react"
import { clx } from "@modules/common/components/ui"
import { hasActiveFilters, type FilterState } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import { resolveColor, type ColorMap } from "@lib/util/colors"
import { useFilterNavigation } from "./use-filter-navigation"

const selected = (list: string[], v: string) => list.some((x) => x.toLowerCase() === v.toLowerCase())
const grupo = "text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 mb-3"

export default function FilterPanel({ facets, filters, colorMap, onApplied }: { facets: Facets; filters: FilterState; colorMap: ColorMap; onApplied?: () => void }) {
  const nav = useFilterNavigation(filters)
  const [min, setMin] = useState(filters.preco?.min?.toString() ?? "")
  const [max, setMax] = useState(filters.preco?.max?.toString() ?? "")
  const apply = (fn: () => void) => { fn(); onApplied?.() }

  const faixas = facets.preco
    ? (() => {
        const lo = Math.floor(facets.preco.min), hi = Math.ceil(facets.preco.max)
        if (hi - lo < 20) return []
        const t = Math.round(lo + (hi - lo) / 3), u = Math.round(lo + (2 * (hi - lo)) / 3)
        return [
          { label: `até R$ ${t}`, preco: { min: null, max: t } },
          { label: `R$ ${t + 1}–${u}`, preco: { min: t + 1, max: u } },
          { label: `acima de R$ ${u}`, preco: { min: u + 1, max: null } },
        ]
      })()
    : []

  return (
    <div className="flex flex-col gap-8 text-sm" data-testid="filter-panel">
      {facets.tamanhos.length > 0 && (
        <section>
          <p className={grupo}>Tamanho</p>
          <div className="flex flex-wrap gap-2">
            {facets.tamanhos.map((t) => (
              <button
                key={t.value}
                onClick={() => apply(() => nav.toggleList("tamanho", t.value))}
                className={clx("h-9 min-w-[44px] px-3 rounded-full border text-xs", selected(filters.tamanho, t.value) ? "bg-eclat-grafite text-eclat-luz border-eclat-grafite" : "border-eclat-pedra/60 hover:border-eclat-grafite")}
                data-testid={`filter-tamanho-${t.value}`}
              >
                {t.value} <span className="opacity-60">({t.count})</span>
              </button>
            ))}
          </div>
        </section>
      )}
      {facets.cores.length > 0 && (
        <section>
          <p className={grupo}>Cor</p>
          <ul className="flex flex-col gap-2">
            {facets.cores.map((c) => {
              const r = resolveColor(colorMap, c.name)
              const on = selected(filters.cor, c.name)
              return (
                <li key={c.name}>
                  <button onClick={() => apply(() => nav.toggleList("cor", r.name))} className={clx("flex items-center gap-3 w-full text-left", on && "font-semibold")} data-testid={`filter-cor-${c.name}`}>
                    <span
                      className={clx("w-5 h-5 rounded-full border border-black/10 shrink-0", on && "ring-2 ring-eclat-terracota ring-offset-1")}
                      style={r.swatch_url ? { backgroundImage: `url(${r.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: r.hex }}
                      aria-hidden
                    />
                    <span className="flex-1">{r.name}</span>
                    <span className="text-eclat-grafite/50">{c.count}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      {facets.preco && (
        <section>
          <p className={grupo}>Preço</p>
          <div className="flex flex-wrap gap-2 mb-3">
            {faixas.map((fx) => (
              <button key={fx.label} onClick={() => apply(() => nav.setPrice(fx.preco))} className="text-xs px-3 h-8 rounded-full border border-eclat-pedra/60 hover:border-eclat-grafite">{fx.label}</button>
            ))}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const mi = min.trim() === "" ? null : Math.max(0, Math.round(Number(min)))
              const ma = max.trim() === "" ? null : Math.max(0, Math.round(Number(max)))
              apply(() => nav.setPrice(mi === null && ma === null ? null : { min: mi, max: ma }))
            }}
            className="flex items-center gap-2"
          >
            <input value={min} onChange={(e) => setMin(e.target.value)} inputMode="numeric" placeholder="de" aria-label="Preço mínimo" className="w-20 h-9 border border-eclat-pedra/60 rounded px-2" />
            <span>–</span>
            <input value={max} onChange={(e) => setMax(e.target.value)} inputMode="numeric" placeholder="até" aria-label="Preço máximo" className="w-20 h-9 border border-eclat-pedra/60 rounded px-2" />
            <button type="submit" className="h-9 px-3 text-xs uppercase tracking-wider bg-eclat-grafite text-eclat-luz rounded">Aplicar</button>
          </form>
        </section>
      )}
      <section>
        <label className="flex items-center gap-3 cursor-pointer">
          <input type="checkbox" checked={filters.disponivel} onChange={(e) => apply(() => nav.setDisponivel(e.target.checked))} className="accent-eclat-terracota w-4 h-4" data-testid="filter-disponivel" />
          <span>Só disponíveis</span>
        </label>
      </section>
      {hasActiveFilters(filters) && (
        <button onClick={() => apply(nav.clear)} className="self-start text-xs underline text-eclat-grafite/70" data-testid="filter-clear">Limpar tudo</button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `FilterDrawer`, `ActiveChips`, `SortSelect`, `ListingToolbar`**

`filter-drawer.tsx`:

```tsx
"use client"

import { Dialog, DialogPanel, Transition, TransitionChild } from "@headlessui/react"
import { Fragment, useState } from "react"
import type { FilterState } from "@lib/util/catalog-filters"
import { hasActiveFilters } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import type { ColorMap } from "@lib/util/colors"
import FilterPanel from "./filter-panel"

export default function FilterDrawer({ facets, filters, colorMap, count }: { facets: Facets; filters: FilterState; colorMap: ColorMap; count: number }) {
  const [open, setOpen] = useState(false)
  const ativos = filters.tamanho.length + filters.cor.length + (filters.preco ? 1 : 0) + (filters.disponivel ? 1 : 0)
  return (
    <div className="small:hidden">
      <button onClick={() => setOpen(true)} className="h-9 px-4 border border-eclat-grafite rounded-full text-xs uppercase tracking-wider" data-testid="filter-open">
        Filtrar{ativos ? ` (${ativos})` : ""}
      </button>
      <Transition show={open} as={Fragment}>
        <Dialog onClose={() => setOpen(false)} className="relative z-[70]">
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="opacity-0" enterTo="opacity-100" leave="ease-in duration-150" leaveFrom="opacity-100" leaveTo="opacity-0">
            <div className="fixed inset-0 bg-black/40" />
          </TransitionChild>
          <TransitionChild as={Fragment} enter="ease-out duration-200" enterFrom="translate-y-full" enterTo="translate-y-0" leave="ease-in duration-150" leaveFrom="translate-y-0" leaveTo="translate-y-full">
            <DialogPanel className="fixed inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto bg-eclat-luz rounded-t-2xl p-6 flex flex-col gap-6">
              <div className="flex items-center justify-between">
                <p className="font-serif text-xl text-eclat-grafite">Filtrar</p>
                <button onClick={() => setOpen(false)} aria-label="Fechar" className="text-2xl leading-none">×</button>
              </div>
              <FilterPanel facets={facets} filters={filters} colorMap={colorMap} />
              <button onClick={() => setOpen(false)} className="sticky bottom-0 h-12 bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs rounded">
                Ver {count} {count === 1 ? "peça" : "peças"}{hasActiveFilters(filters) ? " com os filtros" : ""}
              </button>
            </DialogPanel>
          </TransitionChild>
        </Dialog>
      </Transition>
    </div>
  )
}
```

`active-chips.tsx`:

```tsx
"use client"

import { hasActiveFilters, type FilterState } from "@lib/util/catalog-filters"
import { useFilterNavigation } from "./use-filter-navigation"

export default function ActiveChips({ filters }: { filters: FilterState }) {
  const nav = useFilterNavigation(filters)
  if (!hasActiveFilters(filters)) return null
  const chip = (label: string, onRemove: () => void, key: string) => (
    <button key={key} onClick={onRemove} className="h-8 px-3 rounded-full bg-eclat-areia/60 text-xs flex items-center gap-2" data-testid="active-chip">
      {label} <span aria-hidden>×</span>
    </button>
  )
  return (
    <div className="flex flex-wrap gap-2 items-center mb-6" data-testid="active-chips">
      {filters.tamanho.map((t) => chip(`Tamanho ${t}`, () => nav.toggleList("tamanho", t), `t-${t}`))}
      {filters.cor.map((c) => chip(c, () => nav.toggleList("cor", c), `c-${c}`))}
      {filters.preco && chip(`R$ ${filters.preco.min ?? "0"} – ${filters.preco.max ?? "∞"}`, () => nav.setPrice(null), "preco")}
      {filters.disponivel && chip("Só disponíveis", () => nav.setDisponivel(false), "disp")}
      <button onClick={nav.clear} className="text-xs underline text-eclat-grafite/70 ml-2">Limpar tudo</button>
    </div>
  )
}
```

`sort-select.tsx`:

```tsx
"use client"

import { SORT_KEYS, SORT_LABELS, type FilterState, type SortKey } from "@lib/util/catalog-filters"
import { useFilterNavigation } from "./use-filter-navigation"

export default function SortSelect({ filters }: { filters: FilterState }) {
  const nav = useFilterNavigation(filters)
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-eclat-grafite/60">Ordenar</span>
      <select value={filters.ordenar} onChange={(e) => nav.setSort(e.target.value as SortKey)} className="h-9 border border-eclat-pedra/60 rounded px-2 bg-white" data-testid="sort-select">
        {SORT_KEYS.map((k) => <option key={k} value={k}>{SORT_LABELS[k]}</option>)}
      </select>
    </label>
  )
}
```

`listing-toolbar.tsx` (server-safe: só compõe client components):

```tsx
import type { FilterState } from "@lib/util/catalog-filters"
import type { Facets } from "@lib/util/catalog-facets"
import type { ColorMap } from "@lib/util/colors"
import ActiveChips from "./active-chips"
import FilterDrawer from "./filter-drawer"
import SortSelect from "./sort-select"

export default function ListingToolbar({ count, total, filters, facets, colorMap }: { count: number; total: number; filters: FilterState; facets: Facets; colorMap: ColorMap }) {
  return (
    <>
      <div className="flex items-center justify-between gap-4 mb-4 text-sm text-eclat-grafite/70" data-testid="listing-toolbar">
        <span data-testid="result-count">{count === total ? `${total} ${total === 1 ? "peça" : "peças"}` : `${count} de ${total} peças`}</span>
        <div className="flex items-center gap-3">
          <FilterDrawer facets={facets} filters={filters} colorMap={colorMap} count={count} />
          <SortSelect filters={filters} />
        </div>
      </div>
      <ActiveChips filters={filters} />
    </>
  )
}
```

- [ ] **Step 4: Ligar em `ProductListing`**

Em `product-listing.tsx`: `const colorMap = await getColorMap()` (de `@lib/data/colors`); trocar o bloco de contagem por `<ListingToolbar count={result.count} total={result.total} filters={filters} facets={result.facets} colorMap={colorMap} />`; dentro do `<aside id="filtros">`, `<FilterPanel facets={result.facets} filters={filters} colorMap={colorMap} />`.

- [ ] **Step 5: Validar no navegador**

Desktop (≥1024px): painel à esquerda com tamanhos e cores com contagem; clicar "G" atualiza URL e grade sem recarregar; chips ativos aparecem; "Limpar tudo" limpa. Mobile (`resize_window` 375): botão "Filtrar", gaveta sobe, aplicar fecha e atualiza. Preço: atalho e formulário. `dataLayer` recebe `filter_apply` com `filter_type`/`filter_value`. `tsc` limpo.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/modules/store
git commit -m "feat(vitrine): painel de filtros (desktop), gaveta (mobile), chips ativos, ordenação e evento filter_apply"
```

---

### Task 6: Cabeçalho da categoria — capa, descrição curta e chips de categorias irmãs/filhas

**Files:**
- Create: `apps/storefront/src/modules/categories/components/category-header/index.tsx`
- Modify: `apps/storefront/src/modules/categories/templates/index.tsx`

**Interfaces:**
- `CategoryHeader` (server) props `{ category: HttpTypes.StoreProductCategory }`. Lê `listCategories()` (já traz `metadata`, `rank`, `parent_category`) e monta: capa em faixa curta (`metadata.image_url`, `next/image`, `aspect-[3/1]` desktop / `aspect-[2/1]` mobile, `quality={80}`), `h1` com o nome, `metadata.descricao_curta`, e chips: se a categoria tem filhas → as filhas + "Ver tudo de {nome}"; senão → as irmãs (mesmo `parent_category_id`, ativas, com produto publicado, por `rank`), com a atual marcada. Handles das filhas são planos: link `/categories/${handle}`.

- [ ] **Step 1: Implementar**

```tsx
import Image from "next/image"
import { HttpTypes } from "@medusajs/types"
import { listCategories } from "@lib/data/categories"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"

type Meta = { image_url?: string | null; descricao_curta?: string | null }
type Cat = HttpTypes.StoreProductCategory & { rank?: number | null; products?: unknown[] | null }

// Cabeçalho da listagem por categoria (spec §6.3): capa, descrição curta, chips para trocar rápido.
export default async function CategoryHeader({ category }: { category: HttpTypes.StoreProductCategory }) {
  const meta = (category.metadata ?? {}) as Meta
  const all = ((await listCategories().catch(() => [])) as Cat[]).filter((c) => (c.products?.length ?? 0) > 0)
  const byRank = (a: Cat, b: Cat) => (a.rank ?? 0) - (b.rank ?? 0) || a.name.localeCompare(b.name, "pt-BR")
  const filhas = all.filter((c) => c.parent_category_id === category.id).sort(byRank)
  const irmas = category.parent_category_id
    ? all.filter((c) => c.parent_category_id === category.parent_category_id).sort(byRank)
    : []
  const chips: { handle: string; name: string; atual: boolean }[] = filhas.length
    ? filhas.map((c) => ({ handle: c.handle, name: c.name, atual: false }))
    : irmas.map((c) => ({ handle: c.handle, name: c.name, atual: c.id === category.id }))

  return (
    <header className="mb-8" data-testid="category-header">
      {meta.image_url && (
        <div className="relative w-full aspect-[2/1] small:aspect-[3/1] overflow-hidden rounded-lg mb-6 bg-eclat-areia/40">
          <Image src={meta.image_url} alt={`${category.name} — use.ÉCLAT`} fill priority quality={80} sizes="100vw" className="object-cover" />
        </div>
      )}
      <h1 className="font-serif text-3xl text-eclat-grafite" data-testid="category-page-title">{category.name}</h1>
      {meta.descricao_curta && <p className="mt-2 text-eclat-grafite/70 max-w-2xl">{meta.descricao_curta}</p>}
      {chips.length > 0 && (
        <nav className="mt-5 flex flex-wrap gap-2" aria-label={filhas.length ? "Subcategorias" : "Categorias"}>
          {filhas.length > 0 && (
            <span className="h-9 px-4 rounded-full border border-eclat-grafite bg-eclat-grafite text-eclat-luz text-xs uppercase tracking-wider flex items-center">Tudo de {category.name}</span>
          )}
          {chips.map((c) => (
            <LocalizedClientLink
              key={c.handle}
              href={`/categories/${c.handle}`}
              className={clx("h-9 px-4 rounded-full border text-xs uppercase tracking-wider flex items-center", c.atual ? "border-eclat-grafite bg-eclat-grafite text-eclat-luz" : "border-eclat-pedra/60 hover:border-eclat-grafite")}
              aria-current={c.atual ? "page" : undefined}
            >
              {c.name}
            </LocalizedClientLink>
          ))}
        </nav>
      )}
    </header>
  )
}
```

Em `modules/categories/templates/index.tsx`, `header={<CategoryHeader category={category} />}`.

- [ ] **Step 2: Validar** — `/br/categories/tops`: chips Top (atual) · Short · Legging · Macaquinho / Macacão (Conjuntos some por não ter produto); `/br/categories/masculino` (sem produto hoje → 404 é aceitável? Não: a página existe; a listagem mostra estado vazio "Nenhuma peça" e chips das filhas). Capa e descrição aparecem se cadastradas no Cockpit (Task 5 da fase 1). `tsc` limpo.

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/modules/categories
git commit -m "feat(vitrine): cabeçalho de categoria com capa, descrição curta e chips de irmãs/filhas"
```

---

### Task 7: Dados do card (puro)

**Files:**
- Create: `apps/storefront/src/lib/util/product-card-data.ts`, `apps/storefront/src/lib/util/product-card-data.test.ts`

**Interfaces (Produces):**
```ts
export type CardVariant = { id: string; size: string | null; available: boolean }
export type CardColor = { name: string; hex: string; swatch_url: string | null; known: boolean; images: string[]; variants: CardVariant[]; available: boolean; lowStock: boolean; firstAvailableVariantId: string | null }
export type CardBadge = "esgotado" | "ultimas" | "promo" | "novo" | null
export type ProductCardData = { id: string; handle: string; title: string; price: VariantPrice | null; colors: CardColor[]; images: string[]; isNew: boolean; onSale: boolean; available: boolean }
export function buildProductCardData(product: HttpTypes.StoreProduct, colorMap: ColorMap, now?: number): ProductCardData
export function badgeFor(data: ProductCardData, colorIndex: number): CardBadge   // prioridade esgotado › ultimas › promo › novo
```
Regras: cores na ordem dos valores da opção "Cor" do produto (`product.options`), incluindo cores sem estoque (`available=false`); `images` de uma cor = urls de `variant.images` da primeira variante daquela cor que tem imagens, senão `product.images` (fallback); `images` do produto = `product.images` urls (thumbnail primeiro se existir); tamanhos ordenados por `sortSizes`; `price` = `getProductPrice(product).cheapestPrice`; `onSale` = `price?.price_type === "sale"`; `lowStock` = `isLowStock(product, cor)`; `available` do produto = `isProductAvailable`.

- [ ] **Step 1: Teste que falha**

```ts
import { describe, expect, it } from "vitest"
import type { HttpTypes } from "@medusajs/types"
import { badgeFor, buildProductCardData } from "./product-card-data"

const OPTS = [
  { id: "o_t", title: "Tamanho", values: [{ value: "P" }, { value: "M" }] },
  { id: "o_c", title: "Cor", values: [{ value: "Verde Exercito" }, { value: "Licor" }] },
]
const v = (id: string, tam: string, cor: string, qty: number, imgs: string[] = []) => ({
  id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty,
  options: [{ option_id: "o_t", value: tam }, { option_id: "o_c", value: cor }],
  images: imgs.map((url, i) => ({ id: `${id}-${i}`, url })),
  calculated_price: { calculated_amount: 219, original_amount: 259, currency_code: "brl", calculated_price: { price_list_type: "sale" } },
})
const P = {
  id: "p1", handle: "legging-vertice", title: "Legging Vértice", created_at: "2026-09-01T00:00:00Z", thumbnail: "t.jpg",
  images: [{ id: "i1", url: "a.jpg" }, { id: "i2", url: "b.jpg" }], options: OPTS,
  variants: [v("v1", "M", "Verde Exercito", 2, ["verde1.jpg", "verde2.jpg"]), v("v2", "P", "Verde Exercito", 0), v("v3", "P", "Licor", 0), v("v4", "M", "Licor", 0)],
} as unknown as HttpTypes.StoreProduct
const MAP = { "Verde Exército": { hex: "#3B4A2F", swatch_url: null } }
const NOW = Date.parse("2026-09-08T00:00:00Z")

describe("buildProductCardData", () => {
  const d = buildProductCardData(P, MAP, NOW)
  it("cores na ordem da opção, resolvidas pelo mapa", () => {
    expect(d.colors.map((c) => c.name)).toEqual(["Verde Exército", "Licor"])
    expect(d.colors[0].hex).toBe("#3B4A2F")
    expect(d.colors[1].known).toBe(false)
  })
  it("imagens por cor da primeira variante com fotos; fallback do produto", () => {
    expect(d.colors[0].images).toEqual(["verde1.jpg", "verde2.jpg"])
    expect(d.colors[1].images).toEqual(["t.jpg", "a.jpg", "b.jpg"])
  })
  it("tamanhos ordenados, disponibilidade por variante e por cor", () => {
    expect(d.colors[0].variants).toEqual([{ id: "v2", size: "P", available: false }, { id: "v1", size: "M", available: true }])
    expect(d.colors[0].available).toBe(true)
    expect(d.colors[0].lowStock).toBe(true)
    expect(d.colors[0].firstAvailableVariantId).toBe("v1")
    expect(d.colors[1].available).toBe(false)
    expect(d.colors[1].firstAvailableVariantId).toBeNull()
  })
  it("preço, promoção, novo e disponibilidade do produto", () => {
    expect(d.price?.price_type).toBe("sale")
    expect(d.onSale).toBe(true)
    expect(d.isNew).toBe(true)
    expect(d.available).toBe(true)
  })
  it("produto sem opção Cor vira uma cor única sem nome", () => {
    const semCor = { ...P, options: [OPTS[0]], variants: P.variants!.map((x) => ({ ...x, options: [x.options![0]] })) } as unknown as HttpTypes.StoreProduct
    const s = buildProductCardData(semCor, MAP, NOW)
    expect(s.colors.length).toBe(1)
    expect(s.colors[0].name).toBe("")
    expect(s.colors[0].variants.length).toBe(4)
  })
})

describe("badgeFor", () => {
  const d = buildProductCardData(P, MAP, NOW)
  it("prioridade esgotado › ultimas › promo › novo", () => {
    expect(badgeFor(d, 1)).toBe("esgotado")
    expect(badgeFor(d, 0)).toBe("ultimas")
    expect(badgeFor({ ...d, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBe("promo")
    expect(badgeFor({ ...d, onSale: false, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBe("novo")
    expect(badgeFor({ ...d, onSale: false, isNew: false, colors: [{ ...d.colors[0], lowStock: false }] }, 0)).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `Cannot find module './product-card-data'`.

- [ ] **Step 3: Implementar**

```ts
// Dados do card de produto (spec §7), calculados no servidor a partir do produto
// da Store API + mapa de cores. Puro. O card (client) só apresenta.
import type { HttpTypes } from "@medusajs/types"
import type { VariantPrice } from "types/global"
import { isLowStock, isNew, isProductAvailable, isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { sortSizes } from "./catalog-facets"
import { resolveColor, type ColorMap } from "./colors"
import { getProductPrice } from "./get-product-price"

export type CardVariant = { id: string; size: string | null; available: boolean }
export type CardColor = {
  name: string
  hex: string
  swatch_url: string | null
  known: boolean
  images: string[]
  variants: CardVariant[]
  available: boolean
  lowStock: boolean
  firstAvailableVariantId: string | null
}
export type CardBadge = "esgotado" | "ultimas" | "promo" | "novo" | null
export type ProductCardData = {
  id: string
  handle: string
  title: string
  price: VariantPrice | null
  colors: CardColor[]
  images: string[]
  isNew: boolean
  onSale: boolean
  available: boolean
}

type V = HttpTypes.StoreProductVariant & { images?: { url?: string | null }[] | null }

const urls = (imgs: { url?: string | null }[] | null | undefined) => (imgs ?? []).map((i) => i.url).filter((u): u is string => !!u)

export function buildProductCardData(product: HttpTypes.StoreProduct, colorMap: ColorMap, now = Date.now()): ProductCardData {
  const variants = (product.variants ?? []) as V[]
  const productImages = [product.thumbnail, ...urls(product.images)].filter((u, i, a): u is string => !!u && a.indexOf(u) === i)
  const corOpt = (product.options ?? []).find((o) => (o.title ?? "").toLowerCase() === "cor")
  const colorNames: string[] = corOpt
    ? (corOpt.values ?? []).map((x) => x.value).filter((x): x is string => !!x)
    : [""]

  const buildColor = (name: string): CardColor => {
    const vs = name === "" ? variants : variants.filter((v) => optionValue(product.options, v as StockVariant, "Cor") === name)
    const r = name === "" ? { name: "", hex: "", swatch_url: null, known: false } : resolveColor(colorMap, name)
    const withImages = vs.find((v) => urls(v.images).length > 0)
    const sizes = sortSizes(vs.map((v) => optionValue(product.options, v as StockVariant, "Tamanho") ?? "").filter(Boolean))
    const ordered = [
      ...sizes.map((s) => vs.find((v) => optionValue(product.options, v as StockVariant, "Tamanho") === s)!),
      ...vs.filter((v) => !optionValue(product.options, v as StockVariant, "Tamanho")),
    ]
    const cardVariants = ordered.map((v) => ({ id: v.id, size: optionValue(product.options, v as StockVariant, "Tamanho"), available: isVariantAvailable(v as StockVariant) }))
    return {
      name: r.name,
      hex: r.hex,
      swatch_url: r.swatch_url,
      known: r.known,
      images: withImages ? urls(withImages.images) : productImages,
      variants: cardVariants,
      available: cardVariants.some((v) => v.available),
      lowStock: name === "" ? false : isLowStock(product, name),
      firstAvailableVariantId: cardVariants.find((v) => v.available)?.id ?? null,
    }
  }

  const price = getProductPrice({ product }).cheapestPrice
  return {
    id: product.id,
    handle: product.handle ?? "",
    title: product.title ?? "",
    price,
    colors: colorNames.map(buildColor),
    images: productImages,
    isNew: isNew(product, now),
    onSale: price?.price_type === "sale",
    available: isProductAvailable(variants as StockVariant[]),
  }
}

export function badgeFor(data: ProductCardData, colorIndex: number): CardBadge {
  const c = data.colors[colorIndex] ?? data.colors[0]
  if (!c || !c.available) return "esgotado"
  if (c.lowStock) return "ultimas"
  if (data.onSale) return "promo"
  if (data.isNew) return "novo"
  return null
}
```

- [ ] **Step 4: Rodar e ver passar** → 53 + 6 = 59 testes. `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/lib/util/product-card-data.ts apps/storefront/src/lib/util/product-card-data.test.ts
git commit -m "feat(vitrine): dados do card — cores, fotos por cor, tamanhos, selo com prioridade (puro, testado)"
```

---

### Task 8: `ProductCard` — swatches, segunda foto, selos, adição rápida, toast, tracking

**Files:**
- Create: `apps/storefront/src/modules/products/components/product-card/index.tsx`, `badge.tsx`, `swatches.tsx`, `quick-add.tsx`; `apps/storefront/src/modules/common/components/toast/index.tsx`
- Modify: `apps/storefront/src/modules/products/components/product-preview/index.tsx`

**Interfaces:**
- `ProductCard` (client) props `{ data: ProductCardData; countryCode: string; listName?: string }`.
- `ProductPreview` (server) mantém a assinatura `{ product, isFeatured?, region }` (usada por home, relacionados e busca): faz `getColorMap()` + `buildProductCardData` e renderiza `<ProductCard>`.
- `Toast`: `showToast(message: string, action?: { label: string; href: string })` via evento `window` (`eclat:toast`) + `<ToastHost/>` montado no `(main)/layout.tsx`.

- [ ] **Step 1: Toast**

`modules/common/components/toast/index.tsx`:

```tsx
"use client"

import { useEffect, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"

type ToastMsg = { message: string; action?: { label: string; href: string } }
export function showToast(t: ToastMsg) {
  window.dispatchEvent(new CustomEvent<ToastMsg>("eclat:toast", { detail: t }))
}

export default function ToastHost() {
  const [toast, setToast] = useState<ToastMsg | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      setToast((e as CustomEvent<ToastMsg>).detail)
      window.setTimeout(() => setToast(null), 3500)
    }
    window.addEventListener("eclat:toast", on)
    return () => window.removeEventListener("eclat:toast", on)
  }, [])
  if (!toast) return null
  return (
    <div role="status" className="fixed bottom-4 inset-x-4 z-[80] small:left-auto small:right-6 small:w-80 bg-eclat-grafite text-eclat-luz rounded-lg px-4 py-3 text-sm flex items-center justify-between gap-4 shadow-lg" data-testid="toast">
      <span>{toast.message}</span>
      {toast.action && <LocalizedClientLink href={toast.action.href} className="underline whitespace-nowrap">{toast.action.label}</LocalizedClientLink>}
    </div>
  )
}
```

Montar `<ToastHost />` no fim de `app/[countryCode]/(main)/layout.tsx` (ao lado do `Wizard`).

- [ ] **Step 2: `Badge`, `Swatches`, `QuickAdd`**

`badge.tsx`:

```tsx
import type { CardBadge } from "@lib/util/product-card-data"

const LABEL: Record<Exclude<CardBadge, null>, string> = { esgotado: "Esgotado", ultimas: "Últimas peças", promo: "Promoção", novo: "Novo" }

export default function Badge({ badge, percent }: { badge: CardBadge; percent?: string }) {
  if (!badge) return null
  const text = badge === "promo" && percent ? `-${percent}%` : LABEL[badge]
  return (
    <span className={`absolute top-2 left-2 z-10 text-[10px] uppercase tracking-[0.15em] px-2 py-1 rounded ${badge === "esgotado" ? "bg-eclat-grafite/80 text-eclat-luz" : "bg-eclat-luz/90 text-eclat-grafite"}`} data-testid={`badge-${badge}`}>
      {text}
    </span>
  )
}
```

`swatches.tsx`:

```tsx
"use client"

import type { CardColor } from "@lib/util/product-card-data"
import { clx } from "@modules/common/components/ui"

const MAX = 5
export default function Swatches({ colors, active, onSelect }: { colors: CardColor[]; active: number; onSelect: (i: number) => void }) {
  if (colors.length <= 1 && !colors[0]?.name) return null
  const shown = colors.slice(0, MAX)
  return (
    <div className="flex items-center gap-1.5 mt-2" data-testid="swatches">
      {shown.map((c, i) => (
        <button
          key={c.name || i}
          type="button"
          onClick={(e) => { e.preventDefault(); onSelect(i) }}
          title={c.name}
          aria-label={`Cor ${c.name}${c.available ? "" : " (esgotada)"}`}
          aria-pressed={i === active}
          className={clx("relative w-5 h-5 rounded-full border border-black/10", i === active && "ring-2 ring-eclat-terracota ring-offset-1")}
          style={c.swatch_url ? { backgroundImage: `url(${c.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: c.hex }}
        >
          {!c.available && <span aria-hidden className="absolute inset-0 flex items-center justify-center text-eclat-grafite/70 text-[14px] leading-none">/</span>}
        </button>
      ))}
      {colors.length > MAX && <span className="text-[11px] text-eclat-grafite/60">+{colors.length - MAX}</span>}
    </div>
  )
}
```

`quick-add.tsx`:

```tsx
"use client"

import { useState } from "react"
import { addToCart } from "@lib/data/cart"
import type { CardColor, ProductCardData } from "@lib/util/product-card-data"
import { clx } from "@modules/common/components/ui"
import { showToast } from "@modules/common/components/toast"

function pushAddToCart(data: ProductCardData, v: { id: string; size: string | null }, color: string) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({
      event: "add_to_cart",
      ecommerce: {
        currency: (data.price?.currency_code || "brl").toUpperCase(),
        value: data.price?.calculated_price_number,
        items: [{ item_id: v.id, item_name: data.title, price: data.price?.calculated_price_number, quantity: 1, item_variant: [color, v.size].filter(Boolean).join(" / ") }],
      },
    })
  } catch {}
}

// Faixa de tamanhos com adição rápida (spec §7): desktop no hover, mobile via "+".
export default function QuickAdd({ data, color, countryCode, open, onClose }: { data: ProductCardData; color: CardColor; countryCode: string; open: boolean; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null)
  const isMobile = () => typeof window !== "undefined" && window.matchMedia("(max-width: 1023px)").matches

  async function add(v: CardColor["variants"][number]) {
    if (!v.available || busy) return
    setBusy(v.id)
    try {
      await addToCart({ variantId: v.id, quantity: 1, countryCode })
      pushAddToCart(data, v, color.name)
      if (isMobile()) showToast({ message: `${data.title} ${v.size ?? ""} adicionado à sacola`, action: { label: "Ver sacola", href: "/cart" } })
      onClose()
    } catch {
      showToast({ message: "Não foi possível adicionar. Tente de novo." })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div
      className={clx(
        "absolute inset-x-0 bottom-0 z-10 bg-eclat-luz/95 backdrop-blur px-2 py-2 transition-opacity",
        open ? "opacity-100" : "opacity-0 pointer-events-none small:group-hover:opacity-100 small:group-hover:pointer-events-auto"
      )}
      data-testid="quick-add"
    >
      <p className="text-[10px] uppercase tracking-[0.15em] text-eclat-grafite/60 mb-1 text-center">Adicionar rápido</p>
      <div className="flex justify-center gap-1.5 flex-wrap">
        {color.variants.map((v) => (
          <button
            key={v.id}
            type="button"
            disabled={!v.available || busy !== null}
            onClick={() => add(v)}
            className={clx("h-8 min-w-[36px] px-2 text-xs rounded border", v.available ? "border-eclat-grafite hover:bg-eclat-grafite hover:text-eclat-luz" : "border-eclat-pedra/50 text-eclat-grafite/40 line-through cursor-not-allowed")}
            data-testid={`quick-add-${v.size ?? "unico"}`}
          >
            {busy === v.id ? "…" : v.size ?? "Único"}
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: `ProductCard`**

```tsx
"use client"

import Image from "next/image"
import { useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { Text, clx } from "@modules/common/components/ui"
import { badgeFor, type ProductCardData } from "@lib/util/product-card-data"
import Badge from "./badge"
import QuickAdd from "./quick-add"
import Swatches from "./swatches"

function pushSelectItem(data: ProductCardData, listName?: string) {
  try {
    const w = window as unknown as { dataLayer?: Record<string, unknown>[] }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ ecommerce: null })
    w.dataLayer.push({ event: "select_item", ecommerce: { item_list_name: listName, items: [{ item_id: data.id, item_name: data.title, price: data.price?.calculated_price_number }] } })
  } catch {}
}

export default function ProductCard({ data, countryCode, listName }: { data: ProductCardData; countryCode: string; listName?: string }) {
  const [active, setActive] = useState(() => Math.max(0, data.colors.findIndex((c) => c.available)))
  const [sheet, setSheet] = useState(false)
  const color = data.colors[active] ?? data.colors[0]
  const [img1, img2] = color?.images.length ? color.images : data.images
  const badge = badgeFor(data, active)
  const href = `/products/${data.handle}${color?.firstAvailableVariantId ? `?v_id=${color.firstAvailableVariantId}` : ""}`

  // A faixa de adição rápida fica FORA do link (botão dentro de <a> é HTML inválido):
  // o link cobre a imagem por baixo, a faixa fica por cima como irmã posicionada.
  return (
    <div className="group relative" data-testid="product-wrapper">
      <div className="relative aspect-[9/16] w-full overflow-hidden rounded-large bg-ui-bg-subtle">
        <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName)} className="absolute inset-0 block" aria-label={data.title}>
          <Badge badge={badge} percent={data.price?.percentage_diff} />
          {img1 ? (
            <Image src={img1} alt={`${data.title} — ${color?.name || "use.ÉCLAT"}`} fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className={clx("object-cover object-center transition-opacity duration-300", img2 && "small:group-hover:opacity-0")} draggable={false} />
          ) : null}
          {img2 && <Image src={img2} alt="" aria-hidden fill quality={80} sizes="(max-width: 576px) 50vw, (max-width: 1024px) 33vw, 25vw" className="object-cover object-center opacity-0 transition-opacity duration-300 small:group-hover:opacity-100" draggable={false} />}
        </LocalizedClientLink>
        {color && color.available && <QuickAdd data={data} color={color} countryCode={countryCode} open={sheet} onClose={() => setSheet(false)} />}
      </div>
      <LocalizedClientLink href={href} onClick={() => pushSelectItem(data, listName)} className="block">
        <div className="flex mt-4 justify-between items-start gap-2">
          <Text className="text-ui-fg-subtle" data-testid="product-title">{data.title}</Text>
          <div className="flex items-center gap-x-2 shrink-0">
            {data.price?.price_type === "sale" && <Text className="line-through text-ui-fg-muted" data-testid="original-price">{data.price.original_price}</Text>}
            {data.price && <Text className={clx("text-ui-fg-muted", data.price.price_type === "sale" && "text-ui-fg-interactive")} data-testid="price">{data.price.calculated_price}</Text>}
          </div>
        </div>
      </LocalizedClientLink>
      <div className="flex items-center justify-between">
        <Swatches colors={data.colors} active={active} onSelect={(i) => { setActive(i); setSheet(false) }} />
        {color?.available && (
          <button type="button" onClick={() => setSheet((s) => !s)} aria-label="Adicionar rápido" className="small:hidden mt-2 w-8 h-8 rounded-full border border-eclat-grafite text-lg leading-none" data-testid="quick-add-toggle">+</button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: `ProductPreview` vira invólucro**

```tsx
import { HttpTypes } from "@medusajs/types"
import { getColorMap } from "@lib/data/colors"
import { buildProductCardData } from "@lib/util/product-card-data"
import ProductCard from "../product-card"

// Server: prepara os dados do card (cores, fotos, estoque) e delega ao client.
export default async function ProductPreview({ product, region, listName }: { product: HttpTypes.StoreProduct; isFeatured?: boolean; region: HttpTypes.StoreRegion; listName?: string }) {
  const colorMap = await getColorMap()
  const countryCode = region.countries?.[0]?.iso_2 ?? "br"
  return <ProductCard data={buildProductCardData(product, colorMap)} countryCode={countryCode} listName={listName} />
}
```

Em `product-listing.tsx`, passar `listName={listName}` ao `ProductPreview`. Apagar `product-preview/price.tsx` se ficar sem uso (`grep -rn "product-preview/price"`). `thumbnail/index.tsx` continua para outros usos; se só o card usava, deixar (fora de escopo apagar).

- [ ] **Step 5: Validar no navegador**

`/br/categories/leggings`: card com swatches (cinza para cores sem hex — esperado até o dono preencher), clicar swatch troca a foto e a URL do link (`?v_id=`); hover desktop mostra segunda foto (se a cor tiver 2 fotos) e a faixa de tamanhos; clicar "M" adiciona: mini-cart abre (desktop) e o badge da sacola incrementa; `dataLayer` recebe `add_to_cart` e, ao clicar no card, `select_item`. Mobile 375px: "+" abre a faixa; adicionar mostra o toast com "Ver sacola". Selos: cor esgotada → "Esgotado"; estoque ≤ 3 → "Últimas peças". `tsc` limpo, testes verdes.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/modules/products/components/product-card apps/storefront/src/modules/products/components/product-preview apps/storefront/src/modules/common/components/toast "apps/storefront/src/app/[countryCode]/(main)/layout.tsx" apps/storefront/src/modules/store/templates/product-listing.tsx
git commit -m "feat(vitrine): card de produto com swatches, segunda foto no hover, selos, adição rápida (desktop/mobile), toast e select_item/add_to_cart"
```

---

### Task 9: Documentação, critérios de aceite e limpeza

**Files:**
- Modify: `architecture/catalog.md`, `progress.md`, `apps/storefront/package.json` (remover `@types/react-instantsearch-dom` e `pg`/`@types/pg` se `grep -rn "instantsearch\|from \"pg\"" apps/storefront/src` for vazio — spec §13)

- [ ] **Step 1: Critérios de aceite (spec §14, itens 2–5, 10) no navegador**

Com a vitrine em dev contra produção, registrar no relatório (com screenshots via ferramenta de browser) cada item:
2. `/br/categories/leggings?tamanho=G&cor=Verde%20Exercito` → só produtos com G Verde disponível; chips ativos; contador; `<link rel="canonical">` sem query; `<meta name="robots" content="noindex, follow">`.
3. Mobile: gaveta abre, aplica, fecha, grade atualiza.
4. `?cor=Roxo` → estado vazio; "Ver em outras cores" remove só `cor`.
5. Card: swatch troca foto; hover segunda foto; adição rápida "M" abre mini-cart; tamanho esgotado riscado.
10. `dataLayer` com `view_item_list`, `select_item`, `filter_apply`, `add_to_cart`; `npx tsc` limpo nos dois apps; `npm test` verde (59 na vitrine).

- [ ] **Step 2: `architecture/catalog.md`** — acrescentar seção "Listagem (Fase 2)": pipeline em memória e teto de 100; params de URL; regra tamanho∧cor; facetas; ordenação; `ProductListing` como ponto único; card data; eventos; bypass do gate (`COMING_SOON_BYPASS=1` só em dev).

- [ ] **Step 3: `progress.md`** — entrada datada com o que entrou, resultado dos critérios, e pendências: hex das cores (dono), fotos por cor reais, "Mais vendidos" (sem dado), wizard→tamanho (F5).

- [ ] **Step 4: Commit**

```bash
git add architecture/catalog.md progress.md apps/storefront/package.json package-lock.json
git commit -m "docs(catalogo): SOP da fase 2 (listagem, filtros, card) + critérios de aceite validados"
```

---

## Cobertura da spec (auto-revisão)

| Spec | Task |
|---|---|
| 6.1 pipeline em memória, regra tamanho∧cor, preço pela variante mais barata, teto documentado | 2, 3, 9 |
| 6.2 params em português, redirect 308, `destaques` por `destaque_rank`, "mais vendidos" fora | 1, 2, 4 |
| 6.3 painel desktop, gaveta mobile, chips, contador, estado vazio, cabeçalho com irmãs, 24/página | 4, 5, 6 |
| 6.4 canonical sem query + noindex quando filtrado/pagina>1; ItemList JSON-LD | 4 |
| 7 swatches, hover, selos, tamanhos + adição rápida, client/server split, quality 80, tracking | 7, 8 |
| 11 view_item_list, select_item, add_to_cart (rápido), filter_apply | 4, 5, 8 |
| 13 remover resíduos (`instantsearch`, `pg`) | 9 |
| 14 critérios 2, 3, 4, 5, 10 | 9 |

Fora por design (spec, outras fases): 14.1/6/7/8/9 (F3–F5), `size-guide` por categoria (F3), wizard pré-filtro (F5). Decisão registrada: estado vazio **não** reusa `notify-me` (tabela por produto).
