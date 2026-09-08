# Fase 4 — Navegação, menu mobile, home "Compre por peça" e breadcrumb nas listagens — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cliente entende a loja em um olhar: barra de categorias na ordem aprovada com painel de hover (capa + cores) no desktop, menu mobile com miniaturas e acordeão só onde há filhas, bloco "Compre por peça" na home com as cinco categorias femininas, breadcrumb visível em toda listagem — e nenhum resquício de "Treino/Casual" em lugar nenhum.

**Architecture:** Um único ponto de dados de navegação (`getNavigation()`, server) monta uma árvore serializável (`NavData`) a partir de **uma** chamada de produtos (≤100, já com `*categories`, variantes e estoque), das categorias (com `rank`/`metadata`), das coleções e do mapa de cores. A regra de montagem é pura e testada (`lib/util/navigation.ts`). Desktop (`CategoryBar`), mobile (`SideMenu`) e home (`ShopByCategory`) consomem a mesma `NavData`, então ordem, capas, cores disponíveis e visibilidade nunca divergem. O breadcrumb das listagens reaproveita `Breadcrumb` + `getCategoryChain` da fase 3.

**Tech Stack:** Next 15.5 App Router · Medusa 2.15.5 Store API · Headless UI (Popover do menu mobile existente) · Tailwind (`small` = 1024px) · Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` — seção 5 (5.1–5.4), 5.3 na listagem, 13 (resquícios), 14.1 e 14.9. Fases 1–3 entregues (ver `architecture/catalog.md`).

## Global Constraints

- Modalidade não existe. Remover **todo** resquício de "Treino/Casual/linhas": `nav/index.tsx` (cálculo `lines`), `side-menu` (bloco "Linhas"), `modules/home/content.ts` (`HOME_DEFAULTS.lines` aponta para `/categories/treino|casual`, categorias desativadas), e os mesmos defaults em `apps/cockpit/app/(painel)/vitrine/page.tsx`.
- Ordem das raízes = `rank` (fase 1): Top · Short · Legging · Macaquinho / Macacão · Conjuntos · Acessórios · Masculino. Handles fixos: `tops, shorts, leggings, macaquinhos, conjuntos, acessorios, masculino` (+ filhas planas `oculos, meias, bermudas, camisetas-regatas`). **Femininas** = `tops, shorts, leggings, macaquinhos, conjuntos` (constante).
- Visibilidade: uma raiz aparece se tem ≥1 produto publicado nela **ou** em alguma filha. Filhas de uma raiz visível aparecem **todas**, mesmo sem produto (regra da fase 2, cabeçalho). `conjuntos` fica oculta enquanto não tem produto (spec 4.1: entra na spec 2).
- Barra desktop: **Novidades** (`/store?ordenar=novidades`) → raízes visíveis → **Coleções** → **Ver tudo** (`/store`). "Nova Coleção" sai. Acessórios e Masculino em estilo discreto (`text-eclat-grafite/60`, peso normal).
- Painel de hover (desktop): feminina → capa (`metadata.image_url`) + cores disponíveis como swatches (`resolveColor`) linkando `/categories/<handle>?cor=<nome do catálogo>`; Acessórios/Masculino → filhas com miniatura (capa da filha ou da mãe); Coleções → coleções com capa (`collection.metadata.image_url` ou thumbnail do 1º produto). Painel abre por hover **e** por foco (teclado), fecha ao sair/Escape.
- Menu mobile: Início · 7 raízes visíveis com miniatura quadrada (capa; sem capa, quadrado neutro com a inicial) · Coleções (expande) · Toda a loja · Conta. Só Acessórios/Masculino expandem filhas (acordeão nativo `<details>`); femininas abrem direto. Seletores de país/idioma e rodapé mantidos.
- Home: bloco **"Compre por peça"** logo abaixo do hero com as femininas visíveis (capa + nome, ordem por `rank`). Acessórios/Masculino não entram. A reordenação pelo estilo do wizard é da **fase 5** (spec §10): nesta fase, ordem fixa.
- Breadcrumb nas listagens (spec 5.3): loja → Início › Todos os produtos; categoria → Início › {cadeia} (handles planos, `getCategoryChain`); coleção → Início › Coleções › {título}? — não existe página de coleções: usar Início › {título}. `BreadcrumbJsonLd` vem do mesmo componente (uma fonte). `ItemListJsonLd` continua.
- Cores disponíveis por categoria: distintas por `normalizeColorName`, só de variantes disponíveis (`isVariantAvailable`), ordem de primeira aparição; máximo 6 no painel + "+n".
- Uma chamada de produtos por render de navegação (`limit: 100`); cache do Next (`force-cache` + tags) já cobre. Limite conhecido de 100 produtos registrado no SOP.
- pt-BR; commits `feat(vitrine)`/`fix(...)`/`docs(...)` com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`; npm da raiz com `--workspace=apps/storefront`; target es5 (sem spread de Map/Set); `tsc` limpo obrigatório (`ignoreBuildErrors=false`).
- Validação no navegador: `COMING_SOON_BYPASS=1 NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://endearing-enthusiasm-production-775b.up.railway.app npm run dev --workspace=apps/storefront` (porta 8000; conferir livre; encerrar ao fim). O painel de browser padrão pode não hidratar o bundle do Turbopack (limite de conexões); preferir `chrome-devtools` MCP. Nada grava em produção.
- Fora: busca/autocomplete e wizard→filtros/home (F5); mega-menu editorial além de capa+cores; Conjuntos (spec 2).

---

## Mapa de arquivos (`apps/storefront/`)

**Create**
- `src/lib/util/navigation.ts` (+ `.test.ts`) — `buildNavData` puro.
- `src/lib/data/navigation.ts` — `getNavigation()` (server).
- `src/modules/layout/components/category-bar/nav-panel.tsx` — painel de hover (client).
- `src/modules/home/components/shop-by-category/index.tsx` — "Compre por peça".

**Modify**
- `src/modules/layout/components/category-bar/index.tsx` (vira client, recebe `NavData`), `src/modules/layout/components/side-menu/index.tsx`, `src/modules/layout/templates/nav/index.tsx`
- `src/app/[countryCode]/(main)/page.tsx` (home), `src/modules/home/content.ts` (defaults), `apps/cockpit/app/(painel)/vitrine/page.tsx` (defaults)
- `src/modules/store/templates/product-listing.tsx` (prop `breadcrumb`), `src/modules/store/templates/index.tsx`, `src/modules/categories/templates/index.tsx`, `src/modules/collections/templates/index.tsx`
- `architecture/catalog.md`, `progress.md`

---

### Task 1: Árvore de navegação (puro + dados)

**Files:**
- Create: `apps/storefront/src/lib/util/navigation.ts`, `apps/storefront/src/lib/util/navigation.test.ts`, `apps/storefront/src/lib/data/navigation.ts`

**Interfaces (Produces):**
```ts
export const FEMININE_HANDLES = ["tops", "shorts", "leggings", "macaquinhos", "conjuntos"] as const
export type NavColor = { name: string; hex: string; swatch_url: string | null }
export type NavCategory = { id: string; name: string; handle: string; image_url: string | null; descricao_curta: string | null; rank: number; feminine: boolean; hasProducts: boolean; colors: NavColor[]; children: NavCategory[] }
export type NavCollection = { id: string; title: string; handle: string; image_url: string | null }
export type NavData = { roots: NavCategory[]; feminine: NavCategory[]; collections: NavCollection[] }
export function buildNavData(input: { categories: CategoryInput[]; products: ProductInput[]; collections: CollectionInput[]; colorMap: ColorMap }): NavData
export async function getNavigation(countryCode: string): Promise<NavData>   // server; nunca lança (devolve vazio em erro)
```
`CategoryInput` = `{ id, name, handle, parent_category_id?, rank?, metadata? }`; `ProductInput` = `{ id, thumbnail?, collection_id?, categories?: {id}[], options?, variants? }` (o `StoreProduct` serve); `CollectionInput` = `{ id, title, handle, metadata? }`.

- [ ] **Step 1: Teste que falha**

`navigation.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildNavData } from "./navigation"

const cat = (id: string, name: string, handle: string, rank: number, parent: string | null = null, meta: Record<string, unknown> = {}) =>
  ({ id, name, handle, rank, parent_category_id: parent, metadata: meta })
const CATS = [
  cat("c_top", "Top", "tops", 0, null, { image_url: "top.jpg", descricao_curta: "Tops que sustentam" }),
  cat("c_short", "Short", "shorts", 1),
  cat("c_leg", "Legging", "leggings", 2),
  cat("c_mac", "Macaquinho / Macacão", "macaquinhos", 3),
  cat("c_conj", "Conjuntos", "conjuntos", 4),
  cat("c_ace", "Acessórios", "acessorios", 5),
  cat("c_ocu", "Óculos", "oculos", 0, "c_ace"),
  cat("c_meia", "Meias", "meias", 1, "c_ace"),
  cat("c_masc", "Masculino", "masculino", 6),
  cat("c_berm", "Bermudas", "bermudas", 0, "c_masc"),
]
const OPTS = [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }]
const v = (id: string, cor: string, qty: number) => ({ id, manage_inventory: true, allow_backorder: false, inventory_quantity: qty, options: [{ option_id: "o_t", value: "M" }, { option_id: "o_c", value: cor }] })
const prod = (id: string, catIds: string[], variants: any[], collection_id: string | null = null, thumbnail = `${id}.jpg`) =>
  ({ id, thumbnail, collection_id, categories: catIds.map((i) => ({ id: i })), options: OPTS, variants })
const PRODUCTS = [
  prod("p1", ["c_top"], [v("v1", "Licor", 2), v("v2", "Verde Exercito", 0)], "col_black"),
  prod("p2", ["c_top"], [v("v3", "verde exército", 1)], "col_black"),
  prod("p3", ["c_leg"], [v("v4", "Blackout", 5)], "col_black"),
  prod("p4", ["c_meia"], [v("v5", "Preto", 1)], null),
]
const COLLECTIONS = [{ id: "col_black", title: "Família Blackout", handle: "familia-blackout", metadata: {} }, { id: "col_lum", title: "Lumière", handle: "lumiere", metadata: { image_url: "lum.jpg" } }]
const MAP = { "Verde Exército": { hex: "#3B4A2F", swatch_url: null }, Licor: { hex: "#D5823E", swatch_url: null } }

describe("buildNavData", () => {
  const nav = buildNavData({ categories: CATS as any, products: PRODUCTS as any, collections: COLLECTIONS, colorMap: MAP })
  it("raízes visíveis na ordem do rank; sem produto some (Short, Legging fica, Conjuntos some, Masculino some)", () => {
    expect(nav.roots.map((r) => r.handle)).toEqual(["tops", "leggings", "acessorios"])
  })
  it("Acessórios aparece por causa de Meias e lista TODAS as filhas, na ordem", () => {
    const ace = nav.roots.find((r) => r.handle === "acessorios")!
    expect(ace.children.map((c) => c.handle)).toEqual(["oculos", "meias"])
    expect(ace.children[0].hasProducts).toBe(false)
    expect(ace.hasProducts).toBe(true)
    expect(ace.feminine).toBe(false)
  })
  it("cores distintas, só disponíveis, resolvidas pelo mapa, ordem de aparição", () => {
    const top = nav.roots.find((r) => r.handle === "tops")!
    expect(top.colors).toEqual([
      { name: "Licor", hex: "#D5823E", swatch_url: null },
      { name: "Verde Exército", hex: "#3B4A2F", swatch_url: null }, // v2 esgotada, v3 disponível (grafia diferente → 1 cor, nome canônico)
    ])
    expect(top.feminine).toBe(true)
    expect(top.image_url).toBe("top.jpg")
    expect(top.descricao_curta).toBe("Tops que sustentam")
  })
  it("femininas = só as visíveis entre as cinco, na ordem", () => {
    expect(nav.feminine.map((c) => c.handle)).toEqual(["tops", "leggings"])
  })
  it("coleções com capa do metadata ou thumbnail do 1º produto; sem produto e sem capa continua listada", () => {
    expect(nav.collections).toEqual([
      { id: "col_black", title: "Família Blackout", handle: "familia-blackout", image_url: "p1.jpg" },
      { id: "col_lum", title: "Lumière", handle: "lumiere", image_url: "lum.jpg" },
    ])
  })
  it("entrada vazia devolve vazio", () => {
    expect(buildNavData({ categories: [], products: [], collections: [], colorMap: {} })).toEqual({ roots: [], feminine: [], collections: [] })
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test --workspace=apps/storefront` → `Cannot find module './navigation'`.

- [ ] **Step 3: Implementar o puro**

`lib/util/navigation.ts`:

```ts
// Árvore de navegação (spec §5): uma regra só para barra desktop, menu mobile e home.
// Puro: recebe categorias, produtos (com categories/variants) e coleções já buscados.
import { isVariantAvailable, optionValue, type StockVariant } from "./availability"
import { normalizeColorName, resolveColor, type ColorMap } from "./colors"

export const FEMININE_HANDLES = ["tops", "shorts", "leggings", "macaquinhos", "conjuntos"] as const

export type CategoryInput = { id: string; name: string; handle: string; parent_category_id?: string | null; rank?: number | null; metadata?: Record<string, unknown> | null }
export type ProductInput = {
  id: string
  thumbnail?: string | null
  collection_id?: string | null
  categories?: { id: string }[] | null
  options?: { id: string; title?: string | null }[] | null
  variants?: StockVariant[] | null
}
export type CollectionInput = { id: string; title: string; handle: string; metadata?: Record<string, unknown> | null }

export type NavColor = { name: string; hex: string; swatch_url: string | null }
export type NavCategory = {
  id: string
  name: string
  handle: string
  image_url: string | null
  descricao_curta: string | null
  rank: number
  feminine: boolean
  hasProducts: boolean
  colors: NavColor[]
  children: NavCategory[]
}
export type NavCollection = { id: string; title: string; handle: string; image_url: string | null }
export type NavData = { roots: NavCategory[]; feminine: NavCategory[]; collections: NavCollection[] }

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null)
const byRank = (a: { rank: number; name: string }, b: { rank: number; name: string }) => a.rank - b.rank || a.name.localeCompare(b.name, "pt-BR")

export function buildNavData(input: { categories: CategoryInput[]; products: ProductInput[]; collections: CollectionInput[]; colorMap: ColorMap }): NavData {
  const { categories, products, collections, colorMap } = input

  // produtos por categoria (ids)
  const productsByCat = new Map<string, ProductInput[]>()
  for (const p of products) for (const c of p.categories ?? []) {
    if (!productsByCat.has(c.id)) productsByCat.set(c.id, [])
    productsByCat.get(c.id)!.push(p)
  }

  const colorsOf = (prods: ProductInput[]): NavColor[] => {
    const seen = new Map<string, NavColor>()
    for (const p of prods) for (const v of p.variants ?? []) {
      if (!isVariantAvailable(v)) continue
      const raw = optionValue(p.options, v, "Cor")
      if (!raw) continue
      const key = normalizeColorName(raw)
      if (seen.has(key)) continue
      const r = resolveColor(colorMap, raw)
      seen.set(key, { name: r.name, hex: r.hex, swatch_url: r.swatch_url })
    }
    return Array.from(seen.values())
  }

  const toNode = (c: CategoryInput, children: NavCategory[]): NavCategory => {
    const own = productsByCat.get(c.id) ?? []
    const all = [...own, ...children.flatMap((ch) => productsByCat.get(ch.id) ?? [])]
    const meta = c.metadata ?? {}
    return {
      id: c.id,
      name: c.name,
      handle: c.handle,
      image_url: str(meta.image_url),
      descricao_curta: str(meta.descricao_curta),
      rank: c.rank ?? 0,
      feminine: (FEMININE_HANDLES as readonly string[]).includes(c.handle),
      hasProducts: all.length > 0,
      colors: colorsOf(all),
      children,
    }
  }

  const rootsIn = categories.filter((c) => !c.parent_category_id)
  const roots: NavCategory[] = []
  for (const r of rootsIn) {
    const kids = categories.filter((c) => c.parent_category_id === r.id).map((k) => toNode(k, []))
    kids.sort(byRank)
    const node = toNode(r, kids)
    if (node.hasProducts) roots.push(node)
  }
  roots.sort(byRank)

  const feminine = roots.filter((r) => r.feminine)

  const firstThumb = (collectionId: string): string | null =>
    products.find((p) => p.collection_id === collectionId && str(p.thumbnail))?.thumbnail ?? null
  const navCollections: NavCollection[] = collections.map((c) => ({
    id: c.id,
    title: c.title,
    handle: c.handle,
    image_url: str(c.metadata?.image_url) ?? firstThumb(c.id),
  }))

  return { roots, feminine, collections: navCollections }
}
```

- [ ] **Step 4: Rodar e ver passar** → 86 + 6 = 92.

- [ ] **Step 5: Dados (server)**

`lib/data/navigation.ts`:

```ts
import "server-only"

import { listCategories } from "./categories"
import { listCollections } from "./collections"
import { listProducts } from "./products"
import { getColorMap } from "./colors"
import { buildNavData, type NavData } from "@lib/util/navigation"

// Uma busca de produtos (≤100, com *categories/variantes/estoque — fields padrão) + categorias +
// coleções + mapa de cores → NavData. Nunca lança: navegação vazia é melhor que página quebrada.
export async function getNavigation(countryCode: string): Promise<NavData> {
  try {
    const [categories, collectionsRes, productsRes, colorMap] = await Promise.all([
      listCategories(),
      listCollections({ fields: "id,title,handle,metadata" }),
      listProducts({ countryCode, queryParams: { limit: 100 } }),
      getColorMap(),
    ])
    return buildNavData({
      categories: categories as any,
      products: productsRes.response.products as any,
      collections: collectionsRes.collections as any,
      colorMap,
    })
  } catch {
    return { roots: [], feminine: [], collections: [] }
  }
}
```

(Se `listCategories` não devolver `parent_category_id` no tipo, ele já vem no payload — o cast `as any` é aceito nesta borda; anotar no SOP.)

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/util/navigation.ts apps/storefront/src/lib/util/navigation.test.ts apps/storefront/src/lib/data/navigation.ts
git commit -m "feat(vitrine): árvore de navegação única (raízes por rank, visibilidade, cores disponíveis, coleções com capa)"
```

---

### Task 2: Barra de categorias desktop com painel de hover

**Files:**
- Create: `apps/storefront/src/modules/layout/components/category-bar/nav-panel.tsx`
- Modify: `apps/storefront/src/modules/layout/components/category-bar/index.tsx`, `apps/storefront/src/modules/layout/templates/nav/index.tsx`

**Interfaces:**
- `CategoryBar` vira client: props `{ nav: NavData }`. Itens: Novidades · raízes · Coleções · Ver tudo. Estado `open: string | null` (handle ou `"colecoes"`); abre em `onMouseEnter`/`onFocus`, fecha em `onMouseLeave` (com atraso de 120ms), `Escape`, e ao clicar num link. `aria-expanded`/`aria-controls` no item.
- `NavPanel` props `{ kind: "feminine" | "parent" | "collections"; category?: NavCategory; collections?: NavCollection[]; onNavigate: () => void }` — client.
- `Nav` (server) chama `getNavigation(countryCode)` uma vez e passa `nav` à `CategoryBar` e ao `SideMenu` (Task 3). O `countryCode` vem de `params`? O `Nav` está no layout `(main)` — obter via `headers()`/`params` não está disponível; usar a região padrão: `listRegions()` já é chamado → `regions[0]?.countries?.[0]?.iso_2 ?? "br"`.

- [ ] **Step 1: `NavPanel`**

```tsx
"use client"

import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import type { NavCategory, NavCollection } from "@lib/util/navigation"

const MAX_COLORS = 6

// Painel do hover da barra (spec §5.1): feminina = capa + cores; mãe = filhas; coleções = capas.
export default function NavPanel({ kind, category, collections = [], onNavigate }: { kind: "feminine" | "parent" | "collections"; category?: NavCategory; collections?: NavCollection[]; onNavigate: () => void }) {
  const Capa = ({ src, alt }: { src: string | null; alt: string }) => (
    <div className="relative w-40 aspect-[3/4] rounded-md overflow-hidden bg-eclat-areia/40 shrink-0">
      {src && <Image src={src} alt={alt} fill sizes="160px" quality={80} className="object-cover" />}
    </div>
  )
  if (kind === "feminine" && category) {
    const cores = category.colors.slice(0, MAX_COLORS)
    return (
      <div className="flex gap-8">
        <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate}><Capa src={category.image_url} alt={category.name} /></LocalizedClientLink>
        <div className="flex flex-col gap-3 min-w-[220px]">
          <p className="font-serif text-xl text-eclat-grafite">{category.name}</p>
          {category.descricao_curta && <p className="text-sm text-eclat-grafite/70 max-w-xs">{category.descricao_curta}</p>}
          {cores.length > 0 && (
            <div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-eclat-grafite/60 mb-2">Cores disponíveis</p>
              <ul className="flex flex-wrap gap-3">
                {cores.map((c) => (
                  <li key={c.name}>
                    <LocalizedClientLink href={`/categories/${category.handle}?cor=${encodeURIComponent(c.name)}`} onClick={onNavigate} className="flex items-center gap-2 text-sm hover:text-eclat-terracota" title={c.name}>
                      <span className="w-5 h-5 rounded-full border border-black/10" style={c.swatch_url ? { backgroundImage: `url(${c.swatch_url})`, backgroundSize: "cover" } : { backgroundColor: c.hex }} aria-hidden />
                      <span>{c.name}</span>
                    </LocalizedClientLink>
                  </li>
                ))}
                {category.colors.length > MAX_COLORS && <li className="text-sm text-eclat-grafite/50">+{category.colors.length - MAX_COLORS}</li>}
              </ul>
            </div>
          )}
          <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate} className="text-xs uppercase tracking-widest underline underline-offset-4 mt-2">Ver tudo de {category.name}</LocalizedClientLink>
        </div>
      </div>
    )
  }
  if (kind === "parent" && category) {
    return (
      <ul className="flex gap-6">
        {category.children.map((ch) => (
          <li key={ch.id}>
            <LocalizedClientLink href={`/categories/${ch.handle}`} onClick={onNavigate} className="flex flex-col gap-2 group/item">
              <Capa src={ch.image_url ?? category.image_url} alt={ch.name} />
              <span className="text-sm group-hover/item:text-eclat-terracota">{ch.name}</span>
            </LocalizedClientLink>
          </li>
        ))}
        <li>
          <LocalizedClientLink href={`/categories/${category.handle}`} onClick={onNavigate} className="text-xs uppercase tracking-widest underline underline-offset-4 self-end">Ver tudo de {category.name}</LocalizedClientLink>
        </li>
      </ul>
    )
  }
  return (
    <ul className="flex gap-6">
      {collections.map((c) => (
        <li key={c.id}>
          <LocalizedClientLink href={`/collections/${c.handle}`} onClick={onNavigate} className="flex flex-col gap-2 group/item">
            <Capa src={c.image_url} alt={c.title} />
            <span className="text-sm group-hover/item:text-eclat-terracota">{c.title}</span>
          </LocalizedClientLink>
        </li>
      ))}
    </ul>
  )
}
```

- [ ] **Step 2: `CategoryBar` (client)**

```tsx
"use client"

import { useEffect, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { clx } from "@modules/common/components/ui"
import type { NavData } from "@lib/util/navigation"
import NavPanel from "./nav-panel"

// Barra de categorias (desktop, spec §5.1): Novidades · raízes por rank · Coleções · Ver tudo.
// Painel abre por hover ou foco; fecha ao sair (com atraso), Escape ou clique num link.
export default function CategoryBar({ nav }: { nav: NavData }) {
  const [open, setOpen] = useState<string | null>(null)
  const timer = useRef<number | null>(null)
  const show = (key: string) => { if (timer.current) window.clearTimeout(timer.current); setOpen(key) }
  const hide = () => { if (timer.current) window.clearTimeout(timer.current); timer.current = window.setTimeout(() => setOpen(null), 120) }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(null) }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const item = "h-11 flex items-center transition-colors hover:text-eclat-terracota focus:outline-none focus-visible:text-eclat-terracota"
  const current = open ? nav.roots.find((r) => r.handle === open) : undefined
  const panelKind = open === "colecoes" ? "collections" : current?.children.length ? "parent" : "feminine"
  const hasPanel = open === "colecoes" ? nav.collections.length > 0 : !!current && (current.children.length > 0 || current.colors.length > 0 || !!current.image_url)

  return (
    <div className="hidden small:block bg-white border-b border-ui-border-base relative" onMouseLeave={hide}>
      <nav className="content-container flex items-center justify-center gap-x-10 h-11 text-xsmall-regular uppercase tracking-[0.18em]" aria-label="Categorias">
        <LocalizedClientLink href="/store?ordenar=novidades" className={clx(item, "text-eclat-terracota font-semibold")} onMouseEnter={hide} data-testid="nav-novidades">Novidades</LocalizedClientLink>
        {nav.roots.map((r) => (
          <LocalizedClientLink
            key={r.id}
            href={`/categories/${r.handle}`}
            className={clx(item, r.feminine ? "text-eclat-grafite/80" : "text-eclat-grafite/60", open === r.handle && "text-eclat-terracota")}
            onMouseEnter={() => show(r.handle)}
            onFocus={() => show(r.handle)}
            aria-expanded={open === r.handle}
            aria-controls="nav-panel"
            data-testid={`nav-cat-${r.handle}`}
          >
            {r.name}
          </LocalizedClientLink>
        ))}
        {nav.collections.length > 0 && (
          <button type="button" className={clx(item, "uppercase tracking-[0.18em] text-eclat-grafite/80", open === "colecoes" && "text-eclat-terracota")} onMouseEnter={() => show("colecoes")} onFocus={() => show("colecoes")} onClick={() => setOpen(open === "colecoes" ? null : "colecoes")} aria-expanded={open === "colecoes"} aria-controls="nav-panel" data-testid="nav-colecoes">Coleções</button>
        )}
        <LocalizedClientLink href="/store" className={clx(item, "text-eclat-grafite/60")} onMouseEnter={hide} data-testid="nav-ver-tudo">Ver tudo</LocalizedClientLink>
      </nav>
      {open && hasPanel && (
        <div id="nav-panel" role="region" aria-label="Detalhes da categoria" className="absolute inset-x-0 top-full bg-white border-b border-ui-border-base shadow-lg z-40" onMouseEnter={() => show(open)} onMouseLeave={hide}>
          <div className="content-container py-6">
            <NavPanel kind={panelKind} category={current} collections={nav.collections} onNavigate={() => setOpen(null)} />
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: `Nav` passa `nav`**

Em `nav/index.tsx`: remover `listCategories` e o cálculo `lines`; adicionar `getNavigation(countryCode)` ao `Promise.all` com `const countryCode = regions?.[0]?.countries?.[0]?.iso_2 ?? "br"` (calcular após `listRegions`, ou fazer `getNavigation("br")`? Não: regiões são uma só hoje, mas preferir o `iso_2` da primeira região; se vazio, `"br"`). Renderizar `<CategoryBar nav={nav} />` e `<SideMenu … nav={nav} />` (Task 3 muda a assinatura; nesta task, passar `nav` já e manter `lines` removido — ajustar o tipo de `SideMenu` para aceitar `nav` opcional até a Task 3, ou fazer as duas no mesmo commit se preferir; a ordem das tasks é 2 → 3).

- [ ] **Step 4: Validar** — desktop ≥1024px: barra "Novidades · Top · Short · Legging · Macaquinho / Macacão · Coleções · Ver tudo" (Conjuntos/Acessórios/Masculino ausentes até terem produto); hover em "Top" abre painel com capa (se cadastrada) e cores com nome; clicar numa cor leva a `/br/categories/tops?cor=…` com a cor pré-marcada no filtro; Tab pelo teclado abre o painel; Escape fecha; hover em "Coleções" lista as coleções. `tsc` limpo, 92 testes.

- [ ] **Step 5: Commit**

```bash
git add apps/storefront/src/modules/layout/components/category-bar apps/storefront/src/modules/layout/templates/nav/index.tsx
git commit -m "feat(vitrine): barra de categorias por rank com painel de hover (capa, cores disponíveis, filhas, coleções)"
```

---

### Task 3: Menu mobile com miniaturas e acordeão só nas categorias-mãe

**Files:**
- Modify: `apps/storefront/src/modules/layout/components/side-menu/index.tsx`, `apps/storefront/src/modules/layout/templates/nav/index.tsx` (assinatura)

**Interfaces:** `SideMenu` props `{ regions, locales, currentLocale, nav: NavData }` (sem `lines`).

- [ ] **Step 1: Reescrever a lista do menu**

Substituir o bloco `<ul className="flex flex-col gap-6 …">` por:

```tsx
<ul className="flex flex-col gap-3 items-stretch justify-start overflow-y-auto" data-testid="mobile-nav">
  <li>
    <LocalizedClientLink href="/" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="início-link">Início</LocalizedClientLink>
  </li>
  {nav.roots.map((r) => {
    const Thumb = (
      <span className="w-12 h-12 rounded-md overflow-hidden bg-white/10 shrink-0 flex items-center justify-center font-serif text-lg">
        {r.image_url ? <Image src={r.image_url} alt="" width={48} height={48} className="w-12 h-12 object-cover" /> : r.name.charAt(0)}
      </span>
    )
    if (r.children.length === 0) {
      return (
        <li key={r.id}>
          <LocalizedClientLink href={`/categories/${r.handle}`} onClick={close} className="flex items-center gap-3 text-xl leading-tight hover:text-ui-fg-disabled" data-testid={`mobile-cat-${r.handle}`}>
            {Thumb}<span>{r.name}</span>
          </LocalizedClientLink>
        </li>
      )
    }
    return (
      <li key={r.id}>
        <details className="group/acc">
          <summary className="flex items-center gap-3 text-xl leading-tight cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-ui-fg-disabled" data-testid={`mobile-cat-${r.handle}`}>
            {Thumb}<span className="flex-1">{r.name}</span><ArrowRightMini className="transition-transform group-open/acc:rotate-90" />
          </summary>
          <ul className="flex flex-col gap-1 mt-2 ml-[60px]">
            {r.children.map((ch) => (
              <li key={ch.id}><LocalizedClientLink href={`/categories/${ch.handle}`} onClick={close} className="text-base leading-7 text-ui-fg-on-color/80 hover:text-ui-fg-on-color">{ch.name}</LocalizedClientLink></li>
            ))}
            <li><LocalizedClientLink href={`/categories/${r.handle}`} onClick={close} className="text-sm underline underline-offset-4">Ver tudo de {r.name}</LocalizedClientLink></li>
          </ul>
        </details>
      </li>
    )
  })}
  {nav.collections.length > 0 && (
    <li>
      <details className="group/acc">
        <summary className="flex items-center gap-3 text-xl leading-tight cursor-pointer list-none [&::-webkit-details-marker]:hidden hover:text-ui-fg-disabled" data-testid="mobile-colecoes">
          <span className="w-12 h-12 rounded-md bg-white/10 flex items-center justify-center font-serif text-lg">C</span><span className="flex-1">Coleções</span><ArrowRightMini className="transition-transform group-open/acc:rotate-90" />
        </summary>
        <ul className="flex flex-col gap-1 mt-2 ml-[60px]">
          {nav.collections.map((c) => (
            <li key={c.id}><LocalizedClientLink href={`/collections/${c.handle}`} onClick={close} className="text-base leading-7 text-ui-fg-on-color/80 hover:text-ui-fg-on-color">{c.title}</LocalizedClientLink></li>
          ))}
        </ul>
      </details>
    </li>
  )}
  <li><LocalizedClientLink href="/store" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="loja-link">Toda a loja</LocalizedClientLink></li>
  <li><LocalizedClientLink href="/account" className="text-2xl leading-10 hover:text-ui-fg-disabled" onClick={close} data-testid="conta-link">Conta</LocalizedClientLink></li>
</ul>
```

Importar `Image` de `next/image` e `NavData`; remover a prop `lines`, o comentário "Linhas (Treino, Casual…)" e o import de `HttpTypes` se ficar sem uso. Em `nav/index.tsx`, `<SideMenu regions locales currentLocale nav={nav} />`.

- [ ] **Step 2: Validar** — 375px: sanduíche → Início, Top, Short, Legging, Macaquinho / Macacão (com miniatura ou inicial), Coleções (expande), Toda a loja, Conta; nenhuma menção a Treino/Casual (`grep -rn -i "treino\|casual" apps/storefront/src/modules/layout` vazio). `tsc` limpo.

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/modules/layout
git commit -m "feat(vitrine): menu mobile com categorias por rank e miniaturas, acordeão só nas categorias-mãe; remove resquício de linhas"
```

---

### Task 4: Home "Compre por peça" + limpeza dos defaults Treino/Casual

**Files:**
- Create: `apps/storefront/src/modules/home/components/shop-by-category/index.tsx`
- Modify: `apps/storefront/src/app/[countryCode]/(main)/page.tsx`, `apps/storefront/src/modules/home/content.ts`, `apps/cockpit/app/(painel)/vitrine/page.tsx`

**Interfaces:** `ShopByCategory` (server) props `{ countryCode: string }` → `getNavigation(countryCode).feminine`; sem CMS. Renderiza nada se a lista estiver vazia.

- [ ] **Step 1: Componente**

```tsx
import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { getNavigation } from "@lib/data/navigation"

// "Compre por peça" (spec §5.4): as categorias femininas visíveis, por rank, com capa.
export default async function ShopByCategory({ countryCode }: { countryCode: string }) {
  const { feminine } = await getNavigation(countryCode)
  if (!feminine.length) return null
  return (
    <section className="content-container py-12 small:py-16" data-testid="shop-by-category">
      <h2 className="font-serif text-3xl small:text-4xl text-eclat-grafite mb-8 text-center">Compre por peça</h2>
      <ul className="grid grid-cols-2 small:grid-cols-5 gap-3 small:gap-5">
        {feminine.map((c) => (
          <li key={c.id}>
            <LocalizedClientLink href={`/categories/${c.handle}`} className="group block">
              <div className="relative aspect-[3/4] rounded-md overflow-hidden bg-eclat-areia/40">
                {c.image_url ? (
                  <Image src={c.image_url} alt={c.name} fill sizes="(max-width: 1024px) 50vw, 20vw" quality={80} className="object-cover transition-transform duration-700 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center font-serif text-4xl text-eclat-grafite/30">{c.name.charAt(0)}</div>
                )}
              </div>
              <p className="mt-2 text-sm uppercase tracking-[0.15em] text-eclat-grafite group-hover:text-eclat-terracota">{c.name}</p>
            </LocalizedClientLink>
          </li>
        ))}
      </ul>
    </section>
  )
}
```

Em `page.tsx` (home), logo após `<Hero …/>`: `<ShopByCategory countryCode={countryCode} />`.

- [ ] **Step 2: Defaults sem Treino/Casual**

`modules/home/content.ts` `HOME_DEFAULTS.lines`: `heading: "Nossas peças"`, items → `{ label: "Legging", caption: "Compressão que sustenta do treino ao dia todo", href: "/categories/leggings" }` e `{ label: "Top", caption: "Sustentação e caimento que valorizam", href: "/categories/tops" }`. Mesmos dois itens no fallback `lineItems` de `apps/cockpit/app/(painel)/vitrine/page.tsx`. `grep -rn -i "categories/treino\|categories/casual" apps` deve voltar vazio.

- [ ] **Step 3: Validar** — `/br`: bloco "Compre por peça" abaixo do hero com Top, Short, Legging, Macaquinho / Macacão (Conjuntos ausente); links funcionam; home sem erros de console. `tsc` limpo nos dois apps.

- [ ] **Step 4: Commit**

```bash
git add apps/storefront/src/modules/home apps/storefront/src/app "apps/cockpit/app/(painel)/vitrine/page.tsx"
git commit -m "feat(vitrine): bloco Compre por peça na home; remove defaults Treino/Casual da vitrine e do Cockpit"
```

---

### Task 5: Breadcrumb visível nas listagens

**Files:**
- Modify: `apps/storefront/src/modules/store/templates/product-listing.tsx`, `apps/storefront/src/modules/store/templates/index.tsx`, `apps/storefront/src/modules/categories/templates/index.tsx`, `apps/storefront/src/modules/collections/templates/index.tsx`

**Interfaces:** `ProductListing` ganha `breadcrumb?: Crumb[]`; renderiza `<Breadcrumb items countryCode />` antes do `header`. Templates: loja → `[{ name: "Início", href: "" }, { name: "Todos os produtos", href: "/store" }]`; categoria → Início + `getCategoryChain(category.id)` mapeada para `/categories/<handle>` (template vira `async`); coleção → Início + `{ name: collection.title, href: `/collections/${handle}` }`.

- [ ] **Step 1: Implementar** conforme acima (`Breadcrumb` e `Crumb` de `@modules/common/components/breadcrumb`; `getCategoryChain` de `@lib/data/category-path`). O `CategoryHeader` continua logo abaixo.

- [ ] **Step 2: Validar** — `/br/categories/tops`: "Início › Top"; `/br/categories/oculos` (se visível): "Início › Acessórios › Óculos"; `/br/store`: "Início › Todos os produtos"; view-source com um único BreadcrumbList por página. `tsc` limpo.

- [ ] **Step 3: Commit**

```bash
git add apps/storefront/src/modules/store apps/storefront/src/modules/categories apps/storefront/src/modules/collections
git commit -m "feat(vitrine): breadcrumb visível nas listagens (loja, categoria com cadeia, coleção) com JSON-LD único"
```

---

### Task 6: Documentação e critérios de aceite

**Files:**
- Modify: `architecture/catalog.md`, `progress.md`

- [ ] **Step 1: Aceite no navegador** — spec §14.1 (barra na ordem; hover com capa + swatches; clicar swatch abre a categoria filtrada; hover Acessórios/Masculino lista filhas — só se visíveis; `/br/categories/masculino` com chips das filhas), §14.9 (bloco "Compre por peça"; a reordenação pelo wizard é F5 — registrar como pendente), menu mobile, breadcrumbs, `grep -rn -i "treino\|casual" apps/storefront/src apps/cockpit/app` vazio (exceto ocorrências legítimas em textos de marketing — listar), `npx tsc` nos dois apps, `npm test` (92).
- [ ] **Step 2: `architecture/catalog.md`** — seção "Navegação (Fase 4)": `NavData`/`buildNavData` (regras de visibilidade, femininas, cores, capas de coleção), `getNavigation` (1 busca ≤100, nunca lança), barra desktop + painel, menu mobile, "Compre por peça", breadcrumb nas listagens, limite de 100 produtos.
- [ ] **Step 3: `progress.md`** — entrada datada; pendências: wizard reordenando a home (F5), capas de categoria/coleção a cadastrar (dono), `conjuntos` oculta até a spec 2, Masculino/Acessórios ocultos até terem produto.
- [ ] **Step 4: Commit**

```bash
git add architecture/catalog.md progress.md
git commit -m "docs(catalogo): SOP da fase 4 (navegação, menu mobile, home, breadcrumb) + aceite"
```

---

## Cobertura da spec (auto-revisão)

| Spec | Task |
|---|---|
| 5.1 barra por rank, Novidades/Coleções/Ver tudo, hover feminina (capa+cores), mãe (filhas), Coleções; discretas | 1, 2 |
| 5.2 menu mobile com miniaturas, acordeão só nas mães, remoção de "Linhas" | 1, 3 |
| 5.3 breadcrumb visível nas listagens, uma fonte com o JSON-LD | 5 |
| 5.4 "Compre por peça" com as femininas (ordem por wizard → F5) | 4 |
| 4.1 `conjuntos` oculta sem produto; visibilidade por produto publicado | 1 |
| 13 resquícios Treino/Casual (nav, side-menu, defaults vitrine e Cockpit) | 2, 3, 4 |
| 14.1, 14.9 (parte fixa) | 6 |

Fora por design: wizard→home/filtros e busca (F5); mega-menu editorial; Conjuntos (spec 2).
