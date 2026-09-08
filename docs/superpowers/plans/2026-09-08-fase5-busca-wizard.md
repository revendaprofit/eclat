# Fase 5 — Busca com sugestões + Wizard ligado à navegação — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A barra de busca sugere categorias, cores e peças enquanto a cliente digita; `/busca` usa o mesmo pipeline de listagem (filtros, ordenação, paginação) com sinônimos; o tamanho salvo no wizard "Minha ÉCLAT" pré-filtra toda listagem (chip removível, URL intacta) e os estilos escolhidos reordenam o bloco "Compre por peça" da home.

**Architecture:** Mesmo padrão das fases anteriores — módulos **puros** em `src/lib/util/*` (sinônimos, sugestões, cookie de preferências, ordem por estilo; testados com Vitest) e leitores de I/O em `src/lib/data/*` (`server-only` / `"use server"`). A barra de busca (client) recebe a `NavData` já existente (categorias + cores) como prop e só vai à rede para os até 5 produtos (server action com debounce de 200 ms). O tamanho preferido entra **no servidor**, lendo o cookie espelho `eclat_prefs` que `prefs.ts` já grava: `parseFilters(sp)` vira `resolveListingFilters(sp)` nas quatro páginas de listagem, que devolve também `implicitSize`; o opt-out da chip é `?tamanho=` (param presente e vazio). A ordem por estilo é uma função pura aplicada em `ShopByCategory` sobre `nav.feminine`.

**Tech Stack:** Next 15.5 App Router (server actions, `cookies()`, `redirect`), Medusa Store API (`/store/products?q=`), Vitest 3, Tailwind, Headless UI já presente. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` — §9 (Busca), §10 (Wizard), §11 (`search_suggestion_click`), §14 itens 7, 8, 9. Fases anteriores: F1–F4 já em `main` (HEAD `0a16895`).

## Global Constraints

- **Sem eixo de modalidade** em lugar nenhum (treino/casual/pilates) — só tipos de peça. Nenhum texto novo pode citar "linha Treino/Casual".
- **Copy pt-BR** em todo texto visível; sem strings em inglês na vitrine.
- **Contrato de URL da listagem (spec §6.2)**: `tamanho, cor, preco, disponivel, ordenar, pagina` — inalterado. `/busca` acrescenta só `q`. Canonical sempre sem query; `robots noindex, follow` quando filtrada/`pagina>1`; `/busca` é sempre `noindex`.
- **Tamanho preferido nunca entra na URL** por conta própria (spec §10): a URL só muda quando a cliente mexe. Sem cookie, o HTML é idêntico ao de hoje (SEO intacto: crawler não tem cookie).
- **Identidade de cor** sempre via `normalizeColorName`/`normalizeTerm` (acento e caixa-insensível).
- **Teto de 100 produtos** por listagem/navegação continua (spec §16); `/busca` segue o mesmo teto.
- **tsconfig `target: es5`**: nunca espalhar `Map`/`Set` (`[...set]`) — usar `Array.from(...)`.
- **Testes**: só módulos puros em `src/lib/util/*.test.ts` (Vitest, `environment: node`, sem React nem `server-only`). Suite atual: storefront 92, cockpit 19. `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit` limpos ao fim de cada task (`typescript.ignoreBuildErrors=false`).
- **Sem escrita em produção** nesta fase. Nunca editar `.env.local`. Validação em dev contra o backend de produção: `COMING_SOON_BYPASS=1 NEXT_PUBLIC_MEDUSA_BACKEND_URL=https://endearing-enthusiasm-production-775b.up.railway.app npm run dev --workspace=apps/storefront` (porta 8000; matar servidores antigos antes). Navegador de aceite: `mcp__plugin_chrome-devtools-mcp` (o painel padrão não hidrata o bundle do Turbopack nesta máquina — ver `progress.md` 2026-09-08/Fase 3).
- **Commits pequenos e em pt-BR** no padrão do repositório (`feat(vitrine): …`, `test(...)`, `docs(...)`). Rodapé `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Rulings do controller (registrar no ledger; não reabrir)

1. **"bermuda" NÃO vira sinônimo de `shorts`** (spec §9 dizia que sim). A spec foi escrita antes da árvore Masculino › Bermudas existir; hoje `bermudas` é categoria real. "bermuda" cai no match de nome de categoria (sugere "Bermudas") e na busca textual do Medusa. Task 6 corrige o texto da spec.
2. **Redirect por sinônimo só quando a busca inteira é um sinônimo** ("calça", "Calças" → `/categories/leggings`, 307 via `redirect`). "calça preta" vai para `/busca?q=calça preta` (Medusa `q`). Sem expansão de termos dentro da frase (YAGNI).
3. **Opt-out do tamanho implícito = `?tamanho=`** (param presente, vazio). `parseFilters` já lê isso como "sem tamanho"; `serializeFilters` descarta o vazio, então o opt-out dura até a próxima mudança de filtro que deixe a URL sem filtro nenhum — nesse caso a chip volta. Limite conhecido, documentado na Task 6.
4. **Wizard chama `router.refresh()`** ao fechar/concluir, para a home reordenar e a listagem mostrar a chip sem recarregar a página.
5. **Home já é dinâmica** (`getRegion` → cookies). Ler o cookie de preferências em `ShopByCategory` não muda o modo de renderização.
6. **Sem evento GA4 `search`** (não está na spec §11). Só `search_suggestion_click`, com `suggestion_type`, `suggestion_value` e `search_term`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/storefront/src/lib/util/search-synonyms.ts` (novo) | `normalizeTerm`, `SEARCH_SYNONYMS`, `synonymCategoryHandle` — puro |
| `apps/storefront/src/lib/util/search-suggest.ts` (novo) | `buildSuggestions(q, nav, products)` — puro, sobre `NavData` |
| `apps/storefront/src/lib/data/search.ts` (novo) | `suggestProducts(q, countryCode)` — server action, ≤5 produtos |
| `apps/storefront/src/modules/layout/components/search-bar/index.tsx` | Barra com dropdown de sugestões (debounce 200 ms), evento `search_suggestion_click` |
| `apps/storefront/src/modules/layout/templates/nav/index.tsx` | Passa `nav` às duas `SearchBar` |
| `apps/storefront/src/lib/data/products.ts` | `ListingScope.q` → `queryParams.q` |
| `apps/storefront/src/app/[countryCode]/(main)/busca/page.tsx` | `/busca` no pipeline de listagem + redirect por sinônimo |
| `apps/storefront/src/modules/store/templates/product-listing.tsx` | Props `query` (estado vazio) e `implicitSize` |
| `apps/storefront/src/modules/store/components/filters/empty-results.tsx` | Mensagem para busca sem resultado; usa `listingHref` |
| `apps/storefront/src/lib/util/prefs-cookie.ts` (novo) | `EclatPrefs`, `parsePrefsCookie`, `applyPreferredSize` — puro |
| `apps/storefront/src/lib/util/catalog-filters.ts` | `listingHref(pathname, next, implicitSize)` |
| `apps/storefront/src/lib/data/prefs.ts` (novo) | `getServerPrefs()`, `resolveListingFilters(sp)` — `server-only` |
| `apps/storefront/src/modules/personalization/prefs.ts` | Reexporta o tipo de `prefs-cookie` |
| `apps/storefront/src/modules/store/components/filters/listing-transition.tsx` | Contexto ganha `implicitSize` |
| `apps/storefront/src/modules/store/components/filters/use-filter-navigation.ts` | Usa `listingHref` (opt-out do tamanho implícito) |
| `apps/storefront/src/modules/store/components/filters/active-chips.tsx` | Chip "Seu tamanho: M" |
| `apps/storefront/src/app/[countryCode]/(main)/{store,categories/[...category],collections/[handle],busca}/page.tsx` + templates | `resolveListingFilters` e `implicitSize` |
| `apps/storefront/src/lib/util/style-order.ts` (novo) | `STYLE_HANDLES`, `orderByStyles` — puro |
| `apps/storefront/src/modules/home/components/shop-by-category/index.tsx` | Ordem por estilos do cookie |
| `apps/storefront/src/modules/personalization/wizard.tsx` | Estilo "Shorts", `router.refresh()` |
| `architecture/catalog.md`, `progress.md`, spec §9 | Documentação e aceite |

---

### Task 1: Sinônimos e sugestões (módulos puros)

**Files:**
- Create: `apps/storefront/src/lib/util/search-synonyms.ts`
- Create: `apps/storefront/src/lib/util/search-suggest.ts`
- Test: `apps/storefront/src/lib/util/search-synonyms.test.ts`
- Test: `apps/storefront/src/lib/util/search-suggest.test.ts`

**Interfaces:**
- Consumes: `NavData`, `NavCategory` de `@lib/util/navigation` (já existe: `roots[].colors[] = { name, hex, swatch_url }`, `roots[].children[]`).
- Produces:
  - `normalizeTerm(s: string): string`
  - `synonymCategoryHandle(q: string): string | null`
  - `MIN_QUERY = 2`, `MAX_PRODUCTS = 5`
  - `type ProductHit = { id: string; title: string; handle: string; thumbnail: string | null }`
  - `type Suggestions = { categories: CategorySuggestion[]; colors: ColorSuggestion[]; products: ProductSuggestion[] }`
  - `buildSuggestions(q: string, nav: NavData, products?: ProductHit[]): Suggestions`

- [ ] **Step 1: Escrever os testes de sinônimos (falhando)**

`apps/storefront/src/lib/util/search-synonyms.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { normalizeTerm, synonymCategoryHandle } from "./search-synonyms"

describe("normalizeTerm", () => {
  it("tira acento, caixa e espaços repetidos", () => {
    expect(normalizeTerm("  Calça   Preta ")).toBe("calca preta")
    expect(normalizeTerm("MACACÃO")).toBe("macacao")
  })
})

describe("synonymCategoryHandle", () => {
  it("busca inteira que é sinônimo devolve o handle da categoria (spec §9)", () => {
    expect(synonymCategoryHandle("calça")).toBe("leggings")
    expect(synonymCategoryHandle("Calças")).toBe("leggings")
    expect(synonymCategoryHandle("blusa")).toBe("tops")
    expect(synonymCategoryHandle("cropped")).toBe("tops")
    expect(synonymCategoryHandle("macacão")).toBe("macaquinhos")
  })
  it("frase com mais palavras, termo vazio ou sem sinônimo devolve null", () => {
    expect(synonymCategoryHandle("calça preta")).toBeNull()
    expect(synonymCategoryHandle("")).toBeNull()
    expect(synonymCategoryHandle("verde")).toBeNull()
  })
  it("'bermuda' NÃO é sinônimo (Bermudas é categoria real em Masculino — ruling 1)", () => {
    expect(synonymCategoryHandle("bermuda")).toBeNull()
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/storefront -- search-synonyms`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implementar `search-synonyms.ts`**

```ts
// Sinônimos de busca (spec §9): termo popular → handle da categoria. Puro, sem I/O.
// Só entram aqui palavras que NÃO são nome de categoria (o match por nome já cobre "top",
// "legging", "short"…). "bermuda" fica de fora: Bermudas é categoria real (Masculino) — ruling 1.

export const SEARCH_SYNONYMS: Record<string, string> = {
  calca: "leggings",
  calcas: "leggings",
  blusa: "tops",
  blusas: "tops",
  cropped: "tops",
  croppeds: "tops",
  macacao: "macaquinhos",
  macacoes: "macaquinhos",
  shortinho: "shorts",
  shortinhos: "shorts",
}

// Mesma normalização de normalizeColorName (acento/caixa/espaços) — aqui para texto livre.
export function normalizeTerm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

// Devolve o handle só quando a busca INTEIRA é um sinônimo ("calça", "Calças"); "calça preta" → null.
export function synonymCategoryHandle(q: string): string | null {
  const t = normalizeTerm(q)
  if (!t) return null
  return SEARCH_SYNONYMS[t] ?? null
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npm test --workspace=apps/storefront -- search-synonyms`
Expected: PASS (4 testes).

- [ ] **Step 5: Escrever os testes de sugestões (falhando)**

`apps/storefront/src/lib/util/search-suggest.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { buildSuggestions } from "./search-suggest"
import type { NavCategory, NavData } from "./navigation"

const cat = (id: string, name: string, handle: string, colors: { name: string; hex: string }[] = [], children: NavCategory[] = []): NavCategory =>
  ({ id, name, handle, image_url: null, descricao_curta: null, rank: 0, feminine: true, hasProducts: true, colors: colors.map((c) => ({ ...c, swatch_url: null })), children })

const NAV: NavData = {
  roots: [
    cat("c_top", "Top", "tops", [{ name: "Verde Exército", hex: "#3B4A2F" }, { name: "Licor", hex: "#D5823E" }]),
    cat("c_leg", "Legging", "leggings", [{ name: "Verde Exército", hex: "#3B4A2F" }]),
    cat("c_ace", "Acessórios", "acessorios", [{ name: "Preto", hex: "#000000" }], [cat("c_meia", "Meias", "meias")]),
  ],
  feminine: [],
  collections: [],
}

describe("buildSuggestions", () => {
  it("menos de 2 caracteres não sugere nada", () => {
    expect(buildSuggestions("v", NAV)).toEqual({ categories: [], colors: [], products: [] })
  })
  it("'verde' sugere a cor com as categorias onde ela existe (link já filtrado por cor)", () => {
    const s = buildSuggestions("verde", NAV)
    expect(s.categories).toEqual([])
    expect(s.colors).toEqual([
      {
        type: "cor",
        color: "Verde Exército",
        hex: "#3B4A2F",
        categories: [
          { name: "Top", handle: "tops", href: "/categories/tops?cor=Verde%20Ex%C3%A9rcito" },
          { name: "Legging", handle: "leggings", href: "/categories/leggings?cor=Verde%20Ex%C3%A9rcito" },
        ],
      },
    ])
  })
  it("nome de categoria (inclusive filha) casa sem acento e caixa", () => {
    expect(buildSuggestions("MEIA", NAV).categories).toEqual([{ type: "categoria", name: "Meias", handle: "meias", href: "/categories/meias" }])
    expect(buildSuggestions("acessor", NAV).categories.map((c) => c.handle)).toEqual(["acessorios"])
  })
  it("sinônimo sugere a categoria-alvo ('calça' → Legging)", () => {
    expect(buildSuggestions("calça", NAV).categories.map((c) => c.handle)).toEqual(["leggings"])
  })
  it("produtos passam no máximo 5, com href da PDP", () => {
    const hits = Array.from({ length: 7 }, (_, i) => ({ id: `p${i}`, title: `Peça ${i}`, handle: `peca-${i}`, thumbnail: null }))
    const s = buildSuggestions("peça", NAV, hits)
    expect(s.products).toHaveLength(5)
    expect(s.products[0]).toEqual({ type: "produto", id: "p0", title: "Peça 0", handle: "peca-0", thumbnail: null, href: "/products/peca-0" })
  })
})
```

- [ ] **Step 6: Rodar e ver falhar**

Run: `npm test --workspace=apps/storefront -- search-suggest`
Expected: FAIL (módulo não existe).

- [ ] **Step 7: Implementar `search-suggest.ts`**

```ts
// Sugestões da barra de busca (spec §9): categorias cujo nome bate, cores do menu que batem
// (com link já filtrado por cor em cada categoria) e até 5 produtos vindos da Store API.
// Puro: recebe a NavData (mesma da barra/menu) e a lista de produtos já buscada.
import type { NavCategory, NavData } from "./navigation"
import { normalizeTerm, synonymCategoryHandle } from "./search-synonyms"

export const MIN_QUERY = 2
export const MAX_PRODUCTS = 5
const MAX_CATEGORIES = 4
const MAX_COLORS = 3

export type ProductHit = { id: string; title: string; handle: string; thumbnail: string | null }
export type CategorySuggestion = { type: "categoria"; name: string; handle: string; href: string }
export type ColorSuggestion = { type: "cor"; color: string; hex: string; categories: { name: string; handle: string; href: string }[] }
export type ProductSuggestion = { type: "produto"; id: string; title: string; handle: string; thumbnail: string | null; href: string }
export type Suggestions = { categories: CategorySuggestion[]; colors: ColorSuggestion[]; products: ProductSuggestion[] }

const EMPTY: Suggestions = { categories: [], colors: [], products: [] }

const flatten = (roots: NavCategory[]): NavCategory[] => roots.flatMap((r) => [r, ...r.children])

export function buildSuggestions(q: string, nav: NavData, products: ProductHit[] = []): Suggestions {
  const t = normalizeTerm(q)
  if (t.length < MIN_QUERY) return EMPTY
  const syn = synonymCategoryHandle(t)

  const categories: CategorySuggestion[] = flatten(nav.roots)
    .filter((c) => normalizeTerm(c.name).includes(t) || c.handle === syn)
    .slice(0, MAX_CATEGORIES)
    .map((c) => ({ type: "categoria", name: c.name, handle: c.handle, href: `/categories/${c.handle}` }))

  // cores: as raízes já agregam as cores das filhas (buildNavData), então basta percorrer roots
  const byColor = new Map<string, ColorSuggestion>()
  for (const r of nav.roots) {
    for (const col of r.colors) {
      const key = normalizeTerm(col.name)
      if (!key.includes(t)) continue
      let entry = byColor.get(key)
      if (!entry) {
        entry = { type: "cor", color: col.name, hex: col.hex, categories: [] }
        byColor.set(key, entry)
      }
      entry.categories.push({ name: r.name, handle: r.handle, href: `/categories/${r.handle}?cor=${encodeURIComponent(col.name)}` })
    }
  }
  const colors = Array.from(byColor.values()).slice(0, MAX_COLORS)

  const prods: ProductSuggestion[] = products
    .slice(0, MAX_PRODUCTS)
    .map((p) => ({ type: "produto", id: p.id, title: p.title, handle: p.handle, thumbnail: p.thumbnail, href: `/products/${p.handle}` }))

  return { categories, colors, products: prods }
}
```

- [ ] **Step 8: Rodar tudo e ver passar**

Run: `npm test --workspace=apps/storefront`
Expected: 92 + 9 = 101 testes passando.

- [ ] **Step 9: Commit**

```bash
git add apps/storefront/src/lib/util/search-synonyms.ts apps/storefront/src/lib/util/search-synonyms.test.ts apps/storefront/src/lib/util/search-suggest.ts apps/storefront/src/lib/util/search-suggest.test.ts
git commit -m "feat(busca): sinônimos e sugestões (módulos puros, spec §9)"
```

---

### Task 2: Barra de busca com sugestões ao digitar

**Files:**
- Create: `apps/storefront/src/lib/data/search.ts`
- Modify: `apps/storefront/src/modules/layout/components/search-bar/index.tsx` (reescrever)
- Modify: `apps/storefront/src/modules/layout/templates/nav/index.tsx` (passar `nav` às duas barras)

**Interfaces:**
- Consumes: `buildSuggestions`, `MIN_QUERY`, `ProductHit` (Task 1); `NavData` (já existe, `Nav` já busca via `getNavigation`); `pushEcommerceEvent(event, ecommerce?, extra?)` de `@modules/analytics/push`; `listProducts` de `@lib/data/products` (arquivo `"use server"`).
- Produces: `suggestProducts(q: string, countryCode: string): Promise<ProductHit[]>` (server action); `SearchBar` passa a exigir prop `nav: NavData`.

- [ ] **Step 1: Server action de produtos sugeridos**

`apps/storefront/src/lib/data/search.ts`:

```ts
"use server"

import { listProducts } from "./products"
import { MAX_PRODUCTS, MIN_QUERY, type ProductHit } from "@lib/util/search-suggest"

// Até 5 produtos para o dropdown da busca (spec §9). Nunca lança: dropdown vazio é melhor
// que barra quebrada. Usa listProducts (cache/revalidate de 5 min, mesmos fields padrão).
export async function suggestProducts(q: string, countryCode: string): Promise<ProductHit[]> {
  const termo = q.trim()
  if (termo.length < MIN_QUERY) return []
  try {
    const { response } = await listProducts({ countryCode, queryParams: { q: termo, limit: MAX_PRODUCTS } })
    return response.products
      .filter((p) => !!p.handle)
      .map((p) => ({ id: p.id, title: p.title ?? "", handle: p.handle as string, thumbnail: p.thumbnail ?? null }))
  } catch (e) {
    console.error("[search] sugestões", e)
    return []
  }
}
```

- [ ] **Step 2: Reescrever `search-bar/index.tsx`**

```tsx
"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { pushEcommerceEvent } from "@modules/analytics/push"
import { suggestProducts } from "@lib/data/search"
import { buildSuggestions, MIN_QUERY, type ProductHit, type Suggestions } from "@lib/util/search-suggest"
import type { NavData } from "@lib/util/navigation"

// Busca da vitrine (spec §9): sugestões ao digitar (categorias + cores vêm da NavData já em
// memória; produtos via server action com debounce de 200 ms). Enter continua indo para /busca.
// variant "inline" = lupa que expande (desktop nav); "full" = barra arredondada (mobile).

const DEBOUNCE_MS = 200
type SuggestionType = "categoria" | "cor" | "produto" | "todos"

export default function SearchBar({ variant = "inline", nav }: { variant?: "inline" | "full"; nav: NavData }) {
  const router = useRouter()
  const { countryCode } = useParams() as { countryCode?: string }
  const cc = countryCode || "br"
  const [q, setQ] = useState("")
  const [aberta, setAberta] = useState(false) // campo expandido (só "inline")
  const [focada, setFocada] = useState(false) // dropdown visível
  const [hits, setHits] = useState<ProductHit[]>([])
  const ultimoTermo = useRef("")

  // produtos: debounce; resposta de um termo antigo é descartada (ultimoTermo)
  useEffect(() => {
    const termo = q.trim()
    ultimoTermo.current = termo
    if (termo.length < MIN_QUERY) {
      setHits([])
      return
    }
    const t = setTimeout(() => {
      suggestProducts(termo, cc).then((res) => {
        if (ultimoTermo.current === termo) setHits(res)
      })
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [q, cc])

  const sugestoes = useMemo(() => buildSuggestions(q, nav, hits), [q, nav, hits])
  const mostrar = focada && q.trim().length >= MIN_QUERY

  function fechar() {
    setFocada(false)
    if (!q) setAberta(false)
  }
  function submit(e: React.FormEvent) {
    e.preventDefault()
    const termo = q.trim()
    if (!termo) return
    router.push(`/${cc}/busca?q=${encodeURIComponent(termo)}`)
    setFocada(false)
    setAberta(false)
  }
  function escolher(type: SuggestionType, value: string) {
    pushEcommerceEvent("search_suggestion_click", undefined, { suggestion_type: type, suggestion_value: value, search_term: q.trim() })
    setFocada(false)
    setAberta(false)
    setQ("")
  }
  // fecha quando o foco sai do formulário inteiro (input + dropdown); Tab dentro do dropdown mantém
  function onBlur(e: React.FocusEvent<HTMLFormElement>) {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) fechar()
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") setFocada(false)
  }

  const Lupa = ({ size = 18 }: { size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="11" cy="11" r="7" />
      <line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  )

  const dropdown = mostrar && (
    <Dropdown sugestoes={sugestoes} termo={q.trim()} cc={cc} onPick={escolher} className={variant === "full" ? "left-0 right-0" : "right-0 w-80"} />
  )

  if (variant === "full") {
    return (
      <form onSubmit={submit} onBlur={onBlur} onKeyDown={onKeyDown} className="relative w-full" role="search">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => setFocada(true)}
          placeholder="Buscar peças, coleções…"
          aria-label="Buscar produtos"
          aria-expanded={!!mostrar}
          aria-controls="busca-sugestoes"
          autoComplete="off"
          className="w-full rounded-full border border-eclat-pedra/60 bg-white px-5 py-3 pr-14 text-base text-eclat-grafite placeholder:text-eclat-grafite/40 outline-none focus:border-eclat-terracota transition-colors"
        />
        <button type="submit" aria-label="Buscar" className="absolute right-1.5 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-eclat-grafite/70 hover:text-eclat-terracota transition-colors">
          <Lupa size={20} />
        </button>
        {dropdown}
      </form>
    )
  }

  return (
    <form onSubmit={submit} onBlur={onBlur} onKeyDown={onKeyDown} className="relative flex items-center" role="search">
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar peças…"
        aria-label="Buscar produtos"
        aria-expanded={!!mostrar}
        aria-controls="busca-sugestoes"
        autoComplete="off"
        className={`bg-transparent border-b border-ui-border-base focus:border-eclat-terracota outline-none text-small-regular transition-all duration-200 ${
          aberta ? "w-40 small:w-48 px-1" : "w-0 px-0"
        } small:w-40 small:px-1`}
        onFocus={() => {
          setAberta(true)
          setFocada(true)
        }}
      />
      <button type="submit" aria-label="Buscar" onClick={() => setAberta(true)} className="hover:text-eclat-terracota transition-colors px-1">
        <Lupa />
      </button>
      {dropdown}
    </form>
  )
}

function Dropdown({ sugestoes, termo, cc, onPick, className }: { sugestoes: Suggestions; termo: string; cc: string; onPick: (t: SuggestionType, v: string) => void; className: string }) {
  const vazio = sugestoes.categories.length + sugestoes.colors.length + sugestoes.products.length === 0
  const titulo = "px-4 pt-3 pb-1 text-[10px] uppercase tracking-[0.2em] text-eclat-grafite/50"
  const item = "block px-4 py-2 text-sm text-eclat-grafite hover:bg-eclat-areia/40 focus:bg-eclat-areia/40 outline-none"
  return (
    <div id="busca-sugestoes" className={`absolute top-full mt-2 z-50 bg-white border border-ui-border-base rounded-xl shadow-lg overflow-hidden ${className}`} data-testid="search-suggestions">
      {vazio ? (
        <p className="px-4 py-3 text-sm text-eclat-grafite/60">Nenhuma sugestão — pressione Enter para buscar “{termo}”.</p>
      ) : (
        <>
          {sugestoes.categories.length > 0 && (
            <div>
              <p className={titulo}>Categorias</p>
              {sugestoes.categories.map((c) => (
                <LocalizedClientLink key={c.handle} href={c.href} className={item} onClick={() => onPick("categoria", c.handle)}>
                  {c.name}
                </LocalizedClientLink>
              ))}
            </div>
          )}
          {sugestoes.colors.length > 0 && (
            <div>
              <p className={titulo}>Cores</p>
              {sugestoes.colors.map((c) => (
                <div key={c.color} className="px-4 py-2 text-sm">
                  <span className="inline-flex items-center gap-2 text-eclat-grafite">
                    <span className="h-3.5 w-3.5 rounded-full border border-eclat-pedra/60" style={{ backgroundColor: c.hex }} aria-hidden />
                    {c.color}
                  </span>
                  <span className="text-eclat-grafite/60"> em </span>
                  {c.categories.map((cat, i) => (
                    <span key={cat.handle}>
                      {i > 0 && <span className="text-eclat-grafite/60">, </span>}
                      <LocalizedClientLink href={cat.href} className="underline text-eclat-terracota outline-none focus:bg-eclat-areia/40" onClick={() => onPick("cor", `${c.color}|${cat.handle}`)}>
                        {cat.name}
                      </LocalizedClientLink>
                    </span>
                  ))}
                </div>
              ))}
            </div>
          )}
          {sugestoes.products.length > 0 && (
            <div>
              <p className={titulo}>Peças</p>
              {sugestoes.products.map((p) => (
                <LocalizedClientLink key={p.id} href={p.href} className={`${item} flex items-center gap-3`} onClick={() => onPick("produto", p.handle)}>
                  <span className="relative h-10 w-8 shrink-0 rounded bg-eclat-areia/40 overflow-hidden">
                    {p.thumbnail && <Image src={p.thumbnail} alt="" fill sizes="32px" className="object-cover" />}
                  </span>
                  <span className="truncate">{p.title}</span>
                </LocalizedClientLink>
              ))}
            </div>
          )}
        </>
      )}
      <LocalizedClientLink href={`/busca?q=${encodeURIComponent(termo)}`} className={`${item} border-t border-ui-border-base text-eclat-terracota`} onClick={() => onPick("todos", termo)}>
        Ver todos os resultados para “{termo}”
      </LocalizedClientLink>
    </div>
  )
}
```

Observações para o implementador:
- Verifique se `LocalizedClientLink` aceita `onClick` (é um wrapper de `next/link`; se não repassa props, acrescente `...props` — mesma técnica usada no `product-card`).
- `Image` de `next/image` já aceita as URLs do backend (config `images` do `next.config.js` — thumbnails já aparecem nos cards). Se o domínio falhar, usar `<img>` simples com `loading="lazy"` e registrar no relatório.
- `ultimoTermo` evita "resposta atrasada sobrescrever termo novo" sem AbortController (server action não abortável).

- [ ] **Step 3: Passar `nav` às barras no `Nav`**

Em `apps/storefront/src/modules/layout/templates/nav/index.tsx`, as duas ocorrências:

```tsx
<SearchBar nav={nav} />
…
<SearchBar variant="full" nav={nav} />
```

- [ ] **Step 4: Tipos e testes**

Run: `npx tsc -p apps/storefront --noEmit && npm test --workspace=apps/storefront`
Expected: tsc limpo; 101 testes.

- [ ] **Step 5: Validar no navegador (dev contra produção, chrome-devtools MCP)**

Subir o dev server (comando nas Global Constraints; matar servidor antigo na porta 8000). Em `http://localhost:8000/br`, 1440px:
- Focar a lupa, digitar `verde`: dropdown com "Cores › Verde Exercito em Top, Legging…" (nomes conforme mapa de cores de produção); clicar "Top" abre `/br/categories/tops?cor=Verde%20Exercito`; no console, `window.dataLayer` contém `{ event: "search_suggestion_click", suggestion_type: "cor", … }`.
- Digitar `legg`: "Categorias › Legging" e "Peças" com até 5 produtos (thumbnail visível).
- Digitar `calça`: "Categorias › Legging" (sinônimo).
- `Escape` fecha; `Tab` do input entra no dropdown (links focáveis); clicar fora fecha.
- Mobile 390×844: barra `full` mostra o dropdown de borda a borda.
Registrar screenshots/observações no relatório da task.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/data/search.ts apps/storefront/src/modules/layout/components/search-bar/index.tsx apps/storefront/src/modules/layout/templates/nav/index.tsx
git commit -m "feat(busca): sugestões ao digitar (categorias, cores, peças) com evento search_suggestion_click"
```

---

### Task 3: `/busca` no pipeline de listagem + redirect por sinônimo

**Files:**
- Modify: `apps/storefront/src/lib/data/products.ts` (`ListingScope.q`)
- Modify: `apps/storefront/src/modules/store/templates/product-listing.tsx` (prop `query`)
- Modify: `apps/storefront/src/modules/store/components/filters/empty-results.tsx` (prop `query`)
- Modify: `apps/storefront/src/app/[countryCode]/(main)/busca/page.tsx` (reescrever)

**Interfaces:**
- Consumes: `synonymCategoryHandle` (Task 1); `ProductListing`, `parseFilters`, `legacyRedirectQuery`.
- Produces: `ListingScope = { categoryIds?; collectionId?; productIds?; q?: string }`; `ProductListing` aceita `query?: string`; `EmptyResults` aceita `query?: string`.

- [ ] **Step 1: `ListingScope.q` em `products.ts`**

```ts
export type ListingScope = { categoryIds?: string[]; collectionId?: string; productIds?: string[]; q?: string }
```
e, em `listProductsFiltered`, logo após o `if (scope.productIds?.length) …`:
```ts
  if (scope.q) queryParams.q = scope.q // busca textual da Store API (título/descrição), spec §9
```

- [ ] **Step 2: `ProductListing` repassa `query` ao estado vazio**

Adicionar `query?: string` às props de `ProductListing` e trocar `<EmptyResults filters={filters} />` por `<EmptyResults filters={filters} query={query} />`.

- [ ] **Step 3: `EmptyResults` com mensagem de busca**

```tsx
export default function EmptyResults({ filters, query }: { filters: FilterState; query?: string }) {
  …
  const semFiltro = partes.length === 0
  return (
    <div className="py-16 text-center flex flex-col items-center gap-4" data-testid="empty-results">
      <p className="font-serif text-2xl text-eclat-grafite">
        {query && semFiltro
          ? <>Não encontramos peças para “{query}”.</>
          : <>Nenhuma peça {partes.length ? `em ${partes.join(" e ")}` : "com esses filtros"}.</>}
      </p>
      <div className="flex flex-wrap justify-center gap-3 text-sm">
        {/* links existentes … */}
        {query && (
          <LocalizedClientLink href="/store" className="underline text-eclat-grafite/70">Ver toda a loja</LocalizedClientLink>
        )}
      </div>
    </div>
  )
}
```
(Manter os quatro links atuais; só acrescenta o quinto quando é busca.)

- [ ] **Step 4: Reescrever `busca/page.tsx`**

```tsx
import { Metadata } from "next"
import { permanentRedirect, redirect } from "next/navigation"

import { legacyRedirectQuery, parseFilters } from "@lib/util/catalog-filters"
import { synonymCategoryHandle } from "@lib/util/search-synonyms"
import ProductListing from "@modules/store/templates/product-listing"

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
  params: Promise<{ countryCode: string }>
}

const termoDe = (sp: Record<string, string | string[] | undefined>) => (Array.isArray(sp.q) ? sp.q[0] : sp.q ?? "").trim()

export async function generateMetadata(props: Props): Promise<Metadata> {
  const { countryCode } = await props.params
  const termo = termoDe(await props.searchParams)
  return {
    title: termo ? `Busca: ${termo}` : "Busca",
    description: termo ? `Resultados da busca por "${termo}" na use.ÉCLAT.` : "Busque peças da use.ÉCLAT.",
    alternates: { canonical: `/${countryCode}/busca` },
    robots: { index: false, follow: true }, // resultados de busca nunca indexam (spec §6.4/§9)
  }
}

export default async function BuscaPage(props: Props) {
  const { countryCode } = await props.params
  const sp = await props.searchParams
  const termo = termoDe(sp)
  const path = `/${countryCode}/busca`

  // "calça" → /categories/leggings (ruling 2: só quando a busca inteira é sinônimo; 307, sinônimos mudam)
  if (termo) {
    const handle = synonymCategoryHandle(termo)
    if (handle) redirect(`/${countryCode}/categories/${handle}`)
  }
  const legacy = legacyRedirectQuery(sp)
  if (legacy !== null) permanentRedirect(`${path}?q=${encodeURIComponent(termo)}${legacy ? `&${legacy}` : ""}`)
  const filters = parseFilters(sp)

  const header = (
    <div className="mb-6">
      <p className="uppercase tracking-[0.25em] text-[11px] text-eclat-terracota">Busca</p>
      <h1 className="font-serif text-3xl text-eclat-grafite mt-1">
        {termo ? <>Resultados para “{termo}”</> : "O que você procura?"}
      </h1>
    </div>
  )

  if (!termo) {
    return (
      <div className="content-container py-10">
        {header}
        <p className="text-sm text-eclat-grafite/60">Digite um termo na busca acima — por nome, cor ou tipo de peça.</p>
      </div>
    )
  }

  return (
    <ProductListing
      filters={filters}
      scope={{ q: termo }}
      countryCode={countryCode}
      listName={`Busca: ${termo}`}
      query={termo}
      breadcrumb={[
        { name: "Início", href: "" },
        { name: "Busca", href: "/busca" },
      ]}
      header={header}
    />
  )
}
```

Atenção: `useFilterNavigation` navega para `${pathname}?${serializeFilters(...)}` — isso **derruba o `q`** da URL em `/busca`. Corrigir no hook: preservar `q` lendo `useSearchParams()`:

```ts
const searchParams = useSearchParams()
…
const replace = useCallback((next, type, value) => {
  const params = new URLSearchParams(serializeFilters({ ...next, pagina: 1 }))
  const q = searchParams.get("q")
  if (q) params.set("q", q)
  const qs = params.toString()
  track(type, value)
  startTransition(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }))
}, [router, pathname, searchParams, startTransition])
```
(`Pagination` já preserva a query inteira via `useSearchParams`, e `EmptyResults` recebe o mesmo tratamento na Task 4 — em `listingHref`.) Na Task 4 o hook muda de novo; aqui basta preservar `q`.

- [ ] **Step 5: Tipos e testes**

Run: `npx tsc -p apps/storefront --noEmit && npm test --workspace=apps/storefront`
Expected: limpo; 101.

- [ ] **Step 6: Validar no navegador**

- `/br/busca?q=legging`: cabeçalho "Resultados para “legging”", toolbar com contador, filtros na coluna esquerda, grade; aplicar Cor mantém `q` na URL; paginação (se houver) idem.
- `/br/busca?q=calça` → chega em `/br/categories/leggings` (status 307 na aba Network).
- `/br/busca?q=zzzz`: "Não encontramos peças para “zzzz”." + "Ver toda a loja".
- `/br/busca` (sem q): "O que você procura?".
- `<head>`: `<link rel="canonical" href="…/br/busca">` e `<meta name="robots" content="noindex, follow">`.

- [ ] **Step 7: Commit**

```bash
git add apps/storefront/src/lib/data/products.ts apps/storefront/src/modules/store/templates/product-listing.tsx apps/storefront/src/modules/store/components/filters/empty-results.tsx apps/storefront/src/modules/store/components/filters/use-filter-navigation.ts "apps/storefront/src/app/[countryCode]/(main)/busca/page.tsx"
git commit -m "feat(busca): /busca no pipeline de listagem (filtros, ordenação, paginação) e redirect por sinônimo"
```

---

### Task 4: Tamanho salvo pré-aplicado nas listagens (chip "Seu tamanho")

**Files:**
- Create: `apps/storefront/src/lib/util/prefs-cookie.ts`
- Test: `apps/storefront/src/lib/util/prefs-cookie.test.ts`
- Modify: `apps/storefront/src/lib/util/catalog-filters.ts` (`listingHref`) + `catalog-filters.test.ts`
- Create: `apps/storefront/src/lib/data/prefs.ts`
- Modify: `apps/storefront/src/modules/personalization/prefs.ts` (reexport do tipo)
- Modify: `apps/storefront/src/modules/store/components/filters/listing-transition.tsx` (contexto ganha `implicitSize`)
- Modify: `apps/storefront/src/modules/store/components/filters/use-filter-navigation.ts`
- Modify: `apps/storefront/src/modules/store/components/filters/active-chips.tsx`
- Modify: `apps/storefront/src/modules/store/components/filters/empty-results.tsx`
- Modify: `apps/storefront/src/modules/store/templates/product-listing.tsx` (prop `implicitSize`)
- Modify: `apps/storefront/src/modules/store/templates/index.tsx`, `apps/storefront/src/modules/categories/templates/index.tsx`, `apps/storefront/src/modules/collections/templates/index.tsx` (prop `implicitSize`)
- Modify: `apps/storefront/src/app/[countryCode]/(main)/store/page.tsx`, `categories/[...category]/page.tsx`, `collections/[handle]/page.tsx`, `busca/page.tsx` (`resolveListingFilters`)

**Interfaces:**
- Consumes: `parseFilters`, `hasActiveFilters`, `serializeFilters`, `FilterState`, `SearchParamsLike`; `SIZE_ORDER` de `catalog-facets`; `cookies()` de `next/headers`.
- Produces:
  - `type EclatPrefs` (movido para `prefs-cookie.ts`; `personalization/prefs.ts` reexporta)
  - `PREFS_COOKIE = "eclat_prefs"`, `parsePrefsCookie(raw): EclatPrefs`
  - `applyPreferredSize(filters, sp, prefs): { filters: FilterState; implicitSize: string | null }`
  - `listingHref(pathname: string, next: FilterState, implicitSize: string | null | undefined, keepQ?: string | null): string`
  - `getServerPrefs(): Promise<EclatPrefs>`, `resolveListingFilters(sp): Promise<{ filters; implicitSize }>`
  - `useListingTransition()` devolve também `implicitSize: string | null`
  - `useFilterNavigation(filters)` inalterado na assinatura (lê `implicitSize` do contexto)

- [ ] **Step 1: Testes do cookie e da pré-aplicação (falhando)**

`apps/storefront/src/lib/util/prefs-cookie.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { applyPreferredSize, parsePrefsCookie } from "./prefs-cookie"
import { DEFAULT_FILTERS } from "./catalog-filters"

describe("parsePrefsCookie", () => {
  it("lê o cookie espelho codificado (encodeURIComponent) ou cru", () => {
    const raw = encodeURIComponent(JSON.stringify({ tamanho: "m", estilos: ["legging", 3], wizard_done: true, persona_id: "p1" }))
    expect(parsePrefsCookie(raw)).toEqual({ tamanho: "M", estilos: ["legging"], wizard_done: true, persona_id: "p1" })
    expect(parsePrefsCookie('{"tamanho":"GG"}')).toEqual({ tamanho: "GG" })
  })
  it("tamanho fora da grade, JSON inválido ou vazio → sem preferência", () => {
    expect(parsePrefsCookie('{"tamanho":"XXL"}')).toEqual({})
    expect(parsePrefsCookie("%7B")).toEqual({})
    expect(parsePrefsCookie(undefined)).toEqual({})
    expect(parsePrefsCookie("[1]")).toEqual({})
  })
})

describe("applyPreferredSize", () => {
  const prefs = { tamanho: "M" }
  it("URL sem filtro e sem o param tamanho → aplica o tamanho salvo, URL intacta", () => {
    expect(applyPreferredSize(DEFAULT_FILTERS, {}, prefs)).toEqual({ filters: { ...DEFAULT_FILTERS, tamanho: ["M"] }, implicitSize: "M" })
    expect(applyPreferredSize({ ...DEFAULT_FILTERS, pagina: 2, ordenar: "destaques" }, { pagina: "2", ordenar: "destaques" }, prefs).implicitSize).toBe("M")
  })
  it("qualquer filtro explícito, ou `tamanho=` vazio (opt-out), ou sem preferência → não mexe", () => {
    const comCor = { ...DEFAULT_FILTERS, cor: ["Licor"] }
    expect(applyPreferredSize(comCor, { cor: "Licor" }, prefs)).toEqual({ filters: comCor, implicitSize: null })
    expect(applyPreferredSize(DEFAULT_FILTERS, { tamanho: "" }, prefs)).toEqual({ filters: DEFAULT_FILTERS, implicitSize: null })
    expect(applyPreferredSize(DEFAULT_FILTERS, {}, {})).toEqual({ filters: DEFAULT_FILTERS, implicitSize: null })
  })
})
```

E em `catalog-filters.test.ts`, novo bloco:

```ts
describe("listingHref", () => {
  it("sem tamanho implícito: URL normal; com q preservado", () => {
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, cor: ["Licor"] }, null)).toBe("/br/store?cor=Licor")
    expect(listingHref("/br/store", DEFAULT_FILTERS, null)).toBe("/br/store")
    expect(listingHref("/br/busca", { ...DEFAULT_FILTERS, cor: ["Licor"] }, null, "calça preta")).toBe("/br/busca?cor=Licor&q=cal%C3%A7a+preta")
  })
  it("com tamanho implícito e resultado sem filtro: grava `tamanho=` vazio (opt-out), mantendo ordenação", () => {
    expect(listingHref("/br/store", DEFAULT_FILTERS, "M")).toBe("/br/store?tamanho=")
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, ordenar: "destaques" }, "M")).toBe("/br/store?tamanho=&ordenar=destaques")
    expect(listingHref("/br/store", { ...DEFAULT_FILTERS, cor: ["Licor"] }, "M")).toBe("/br/store?cor=Licor")
  })
})
```
(adicionar `listingHref` ao import do teste).

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/storefront -- prefs-cookie catalog-filters`
Expected: FAIL.

- [ ] **Step 3: `prefs-cookie.ts`**

```ts
// Preferências "Minha ÉCLAT" lidas no SERVIDOR a partir do cookie espelho `eclat_prefs`
// (gravado por modules/personalization/prefs.ts). Puro: parse defensivo + regra do tamanho
// pré-aplicado (spec §10). Sem cookie, nada muda — o HTML fica igual ao de um crawler.
import { SIZE_ORDER } from "./catalog-facets"
import { hasActiveFilters, type FilterState, type SearchParamsLike } from "./catalog-filters"

export type EclatPrefs = {
  persona_id?: string
  persona_slug?: string
  tamanho?: string // P | M | G | GG
  estilos?: string[] // ex.: ["legging", "top"] — chaves de STYLE_HANDLES (style-order.ts)
  wizard_done?: boolean
}

export const PREFS_COOKIE = "eclat_prefs"

export function parsePrefsCookie(raw: string | null | undefined): EclatPrefs {
  if (!raw) return {}
  try {
    const text = raw.trim().startsWith("{") ? raw : decodeURIComponent(raw)
    const obj = JSON.parse(text) as Record<string, unknown>
    if (!obj || typeof obj !== "object" || Array.isArray(obj)) return {}
    const out: EclatPrefs = {}
    if (typeof obj.persona_id === "string") out.persona_id = obj.persona_id
    if (typeof obj.persona_slug === "string") out.persona_slug = obj.persona_slug
    if (typeof obj.tamanho === "string") {
      const t = obj.tamanho.trim().toUpperCase()
      if (SIZE_ORDER.includes(t)) out.tamanho = t
    }
    if (Array.isArray(obj.estilos)) out.estilos = obj.estilos.filter((e): e is string => typeof e === "string")
    if (typeof obj.wizard_done === "boolean") out.wizard_done = obj.wizard_done
    return out
  } catch {
    return {}
  }
}

// Tamanho salvo entra SÓ quando a URL não tem filtro nenhum e o param `tamanho` está AUSENTE.
// `?tamanho=` (presente, vazio) é o opt-out da chip "Seu tamanho" (ruling 3). A URL nunca é alterada.
export function applyPreferredSize(
  filters: FilterState,
  sp: SearchParamsLike,
  prefs: EclatPrefs
): { filters: FilterState; implicitSize: string | null } {
  if (!prefs.tamanho || hasActiveFilters(filters) || sp.tamanho !== undefined) return { filters, implicitSize: null }
  return { filters: { ...filters, tamanho: [prefs.tamanho] }, implicitSize: prefs.tamanho }
}
```

- [ ] **Step 4: `listingHref` em `catalog-filters.ts`** (após `serializeFilters`)

```ts
// URL de uma mudança de filtro na listagem. Preserva `q` (/busca). Com tamanho implícito do wizard
// e resultado SEM filtro nenhum, grava `?tamanho=` (param presente, vazio) = opt-out do pré-filtro
// do servidor (applyPreferredSize); senão a chip "Seu tamanho" voltaria na próxima renderização.
export function listingHref(pathname: string, next: FilterState, implicitSize: string | null | undefined, keepQ?: string | null): string {
  const params = new URLSearchParams(serializeFilters({ ...next, pagina: 1 }))
  if (keepQ) params.set("q", keepQ)
  let qs = params.toString()
  if (implicitSize && !hasActiveFilters(next)) qs = `tamanho=${qs ? `&${qs}` : ""}`
  return qs ? `${pathname}?${qs}` : pathname
}
```
(`hasActiveFilters` já está declarada antes no arquivo — ordem de declaração não importa para funções, mas mantenha `listingHref` depois dela por leitura.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npm test --workspace=apps/storefront`
Expected: 101 + 4 + 2 = 107.

- [ ] **Step 6: Leitor de servidor `lib/data/prefs.ts`**

```ts
import "server-only"

import { cookies } from "next/headers"
import { parseFilters, type FilterState, type SearchParamsLike } from "@lib/util/catalog-filters"
import { applyPreferredSize, parsePrefsCookie, PREFS_COOKIE, type EclatPrefs } from "@lib/util/prefs-cookie"

// Cookie espelho das preferências do wizard (spec §10). Nunca lança.
export async function getServerPrefs(): Promise<EclatPrefs> {
  try {
    const jar = await cookies()
    return parsePrefsCookie(jar.get(PREFS_COOKIE)?.value)
  } catch {
    return {}
  }
}

export type ListingFilters = { filters: FilterState; implicitSize: string | null }

// parseFilters + tamanho preferido. Substitui `parseFilters(sp)` nas páginas de listagem.
export async function resolveListingFilters(sp: SearchParamsLike): Promise<ListingFilters> {
  return applyPreferredSize(parseFilters(sp), sp, await getServerPrefs())
}
```

- [ ] **Step 7: `personalization/prefs.ts` reexporta o tipo**

Substituir o bloco `export type EclatPrefs = {…}` por:
```ts
import type { EclatPrefs } from "@lib/util/prefs-cookie"
export type { EclatPrefs }
```
(mantém `"use client"` e todo o resto).

- [ ] **Step 8: Contexto de listagem com `implicitSize`**

`listing-transition.tsx`:
```tsx
type ListingTransitionValue = { isPending: boolean; startTransition: TransitionStartFunction; implicitSize: string | null }
const ListingTransitionContext = createContext<ListingTransitionValue>({ isPending: false, startTransition: noop, implicitSize: null })

// implicitSize: tamanho do wizard pré-aplicado pelo servidor (spec §10) — a navegação de filtros
// precisa dele para gravar o opt-out `?tamanho=` (listingHref).
export function ListingTransitionProvider({ children, implicitSize = null }: { children: ReactNode; implicitSize?: string | null }) {
  const [isPending, startTransition] = useTransition()
  return <ListingTransitionContext.Provider value={{ isPending, startTransition, implicitSize }}>{children}</ListingTransitionContext.Provider>
}
```

- [ ] **Step 9: Hook de navegação usa `listingHref`**

`use-filter-navigation.ts` — `replace` vira:
```ts
const { startTransition, implicitSize } = useListingTransition()
const searchParams = useSearchParams()
const replace = useCallback(
  (next: FilterState, type: FilterType, value: string) => {
    track(type, value)
    const href = listingHref(pathname, next, implicitSize, searchParams.get("q"))
    startTransition(() => router.push(href, { scroll: false }))
  },
  [router, pathname, searchParams, startTransition, implicitSize]
)
```
e acrescentar:
```ts
    // chip "Seu tamanho: M": some sem virar filtro explícito (opt-out via listingHref)
    clearImplicitSize: () => replace({ ...filters, tamanho: [] }, "tamanho", "-pref"),
```
(`FilterType` já inclui `"tamanho"`.) Remover o `params`/`q` manual da Task 3 — `listingHref` cobre.

- [ ] **Step 10: Chip "Seu tamanho"**

`active-chips.tsx`:
```tsx
const { implicitSize } = useListingTransition()
…
{filters.tamanho.map((t) =>
  implicitSize && t === implicitSize
    ? chip(`Seu tamanho: ${t}`, nav.clearImplicitSize, `t-${t}`)
    : chip(`Tamanho ${t}`, () => nav.toggleList("tamanho", t), `t-${t}`)
)}
```
(importar `useListingTransition` de `./listing-transition`). Dar `data-testid="implicit-size-chip"` ao chip implícito: alterar `chip(label, onRemove, key, testId = "active-chip")`.

- [ ] **Step 11: `EmptyResults` usa `listingHref`**

Trocar o `link` local por:
```tsx
const { implicitSize } = useListingTransition()
const searchParams = useSearchParams()
const link = (f: FilterState) => listingHref(pathname, f, implicitSize, searchParams.get("q"))
```
(importar `useSearchParams` de `next/navigation`, `listingHref` de `@lib/util/catalog-filters`, `useListingTransition`). Remover `serializeFilters` do import se ficar sem uso.

- [ ] **Step 12: `ProductListing` e templates**

`product-listing.tsx`: prop `implicitSize?: string | null`, e `<ListingTransitionProvider implicitSize={implicitSize ?? null}>`.

`store/templates/index.tsx`, `categories/templates/index.tsx`, `collections/templates/index.tsx`: prop `implicitSize?: string | null` repassada a `ProductListing`.

Páginas `store`, `categories/[...category]`, `collections/[handle]`, `busca`: trocar `const filters = parseFilters(sp)` por
```ts
const { filters, implicitSize } = await resolveListingFilters(sp)
```
(import de `@lib/data/prefs`; `parseFilters` continua importado onde `generateMetadata` o usa — `isIndexable(parseFilters(sp))` NÃO muda: indexabilidade depende só da URL) e passar `implicitSize={implicitSize}` ao template/`ProductListing`.

- [ ] **Step 13: Tipos e testes**

Run: `npx tsc -p apps/storefront --noEmit && npm test --workspace=apps/storefront`
Expected: limpo; 107.

- [ ] **Step 14: Validar no navegador**

No console da página (chrome-devtools MCP): `document.cookie = "eclat_prefs=" + encodeURIComponent(JSON.stringify({tamanho:"M", wizard_done:true})) + "; path=/; max-age=31536000"`, depois abrir `/br/categories/tops`:
- chip "Seu tamanho: M" acima da grade; contador filtrado; painel esquerdo com M marcado; **URL sem query**; `<link rel="canonical">` sem query e **sem** `<meta name="robots" content="noindex">` (URL limpa continua indexável).
- Clicar no × da chip → URL `/br/categories/tops?tamanho=`; chip some; grade completa. Recarregar: continua sem chip.
- Voltar para `/br/categories/tops` (sem query): chip volta (esperado).
- Com chip ativa, clicar "M" no painel esquerdo → mesmo opt-out (`?tamanho=`), não volta a M.
- Com chip ativa, clicar cor "Licor" → URL `?cor=Licor` **sem** tamanho; chip "Seu tamanho" some (só filtros explícitos). Remover "Licor" → URL limpa → chip volta (limite conhecido, ruling 3).
- `/br/busca?q=legging` com o cookie: chip "Seu tamanho: M" e `q` preservado ao mexer em filtros.
- Apagar o cookie (`document.cookie="eclat_prefs=; path=/; max-age=0"`) e recarregar: página idêntica à de hoje.

- [ ] **Step 15: Commit**

```bash
git add apps/storefront/src/lib/util/prefs-cookie.ts apps/storefront/src/lib/util/prefs-cookie.test.ts apps/storefront/src/lib/util/catalog-filters.ts apps/storefront/src/lib/util/catalog-filters.test.ts apps/storefront/src/lib/data/prefs.ts apps/storefront/src/modules/personalization/prefs.ts apps/storefront/src/modules/store apps/storefront/src/modules/categories/templates/index.tsx apps/storefront/src/modules/collections/templates/index.tsx "apps/storefront/src/app/[countryCode]/(main)"
git commit -m "feat(vitrine): tamanho do wizard pré-aplicado nas listagens com chip 'Seu tamanho' (spec §10)"
```

---

### Task 5: Estilos do wizard reordenam "Compre por peça"

**Files:**
- Create: `apps/storefront/src/lib/util/style-order.ts`
- Test: `apps/storefront/src/lib/util/style-order.test.ts`
- Modify: `apps/storefront/src/modules/home/components/shop-by-category/index.tsx`
- Modify: `apps/storefront/src/modules/personalization/wizard.tsx`

**Interfaces:**
- Consumes: `getServerPrefs` (Task 4), `getNavigation` (`nav.feminine: NavCategory[]`).
- Produces: `STYLE_HANDLES: Record<string, string>` (`legging→leggings, top→tops, short→shorts, macacao→macaquinhos, conjunto→conjuntos`), `orderByStyles<T extends { handle: string }>(items: T[], estilos?: string[]): T[]`.

- [ ] **Step 1: Teste (falhando)**

`apps/storefront/src/lib/util/style-order.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { orderByStyles, STYLE_HANDLES } from "./style-order"

const ITEMS = [{ handle: "tops" }, { handle: "shorts" }, { handle: "leggings" }, { handle: "macaquinhos" }]

describe("orderByStyles", () => {
  it("escolhidos primeiro (na ordem original entre si), o resto depois; nada some", () => {
    expect(orderByStyles(ITEMS, ["macacao", "legging"]).map((i) => i.handle)).toEqual(["leggings", "macaquinhos", "tops", "shorts"])
  })
  it("sem estilos, estilo desconhecido ou lista vazia → ordem original", () => {
    expect(orderByStyles(ITEMS, undefined)).toBe(ITEMS)
    expect(orderByStyles(ITEMS, [])).toBe(ITEMS)
    expect(orderByStyles(ITEMS, ["pilates"])).toBe(ITEMS)
  })
  it("mapa cobre os 5 estilos do wizard", () => {
    expect(Object.keys(STYLE_HANDLES).sort()).toEqual(["conjunto", "legging", "macacao", "short", "top"])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npm test --workspace=apps/storefront -- style-order` → FAIL.

- [ ] **Step 3: Implementar `style-order.ts`**

```ts
// Estilos do wizard "Minha ÉCLAT" → handles de categoria (spec §10): as categorias escolhidas
// vêm primeiro no bloco "Compre por peça"; NADA é escondido. Puro.
export const STYLE_HANDLES: Record<string, string> = {
  legging: "leggings",
  top: "tops",
  short: "shorts",
  macacao: "macaquinhos",
  conjunto: "conjuntos",
}

export function orderByStyles<T extends { handle: string }>(items: T[], estilos: string[] | undefined): T[] {
  if (!estilos?.length) return items
  const chosen = new Set(estilos.map((e) => STYLE_HANDLES[e]).filter((h): h is string => !!h))
  if (chosen.size === 0) return items
  return [...items.filter((i) => chosen.has(i.handle)), ...items.filter((i) => !chosen.has(i.handle))]
}
```

- [ ] **Step 4: Rodar e ver passar** — `npm test --workspace=apps/storefront` → 110.

- [ ] **Step 5: `ShopByCategory` lê o cookie**

```tsx
import { getServerPrefs } from "@lib/data/prefs"
import { orderByStyles } from "@lib/util/style-order"
…
const [{ feminine }, prefs] = await Promise.all([getNavigation(countryCode), getServerPrefs()])
if (!feminine.length) return null
// spec §10: estilos do wizard primeiro (nunca esconde nada); sem cookie, ordem = rank
const ordered = orderByStyles(feminine, prefs.estilos)
const columns = Math.min(ordered.length, 5)
… {ordered.map((c) => ( … ))}
```

- [ ] **Step 6: Wizard — estilo "Shorts" e refresh**

Em `wizard.tsx`:
```ts
// ids = chaves de STYLE_HANDLES (lib/util/style-order.ts) — a home reordena "Compre por peça" por eles
const ESTILOS = [
  { id: "legging", label: "Leggings" },
  { id: "top", label: "Tops" },
  { id: "short", label: "Shorts" },
  { id: "conjunto", label: "Conjuntos" },
  { id: "macacao", label: "Macaquinhos & Macacões" },
]
```
e `useRouter` de `next/navigation`; em `close` e `finish`, após `setOpen(false)`: `router.refresh()` (ruling 4 — a home reordena e as listagens mostram a chip sem recarregar). O texto do passo 1 muda para "Todo produto e toda listagem já abrem no seu tamanho."

- [ ] **Step 7: Tipos e testes**

Run: `npx tsc -p apps/storefront --noEmit && npm test --workspace=apps/storefront` → limpo; 110.

- [ ] **Step 8: Validar no navegador**

- Cookie `{"estilos":["macacao","short"]}` → `/br`: "Compre por peça" começa por Macaquinho/Macacão, Short, depois Top, Legging (rank). Sem cookie: Top, Short, Legging, Macaquinho/Macacão.
- Abrir o wizard ("Minha ÉCLAT"), marcar Leggings + tamanho G, "ver minha loja ✨": a home reordena sem reload (Legging primeiro); ir a `/br/categories/tops`: chip "Seu tamanho: G".

- [ ] **Step 9: Commit**

```bash
git add apps/storefront/src/lib/util/style-order.ts apps/storefront/src/lib/util/style-order.test.ts apps/storefront/src/modules/home/components/shop-by-category/index.tsx apps/storefront/src/modules/personalization/wizard.tsx
git commit -m "feat(home): estilos do wizard reordenam 'Compre por peça'; wizard ganha Shorts e refresh"
```

---

### Task 6: Aceite (spec §14 itens 7, 8, 9) + documentação

**Files:**
- Modify: `architecture/catalog.md` (nova seção "Busca + Wizard (Fase 5, 2026-09)")
- Modify: `progress.md` (entrada 2026-09-08 — Fase 5)
- Modify: `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` §9 (ruling 1) e §10 (opt-out)
- Modify: `CLAUDE.md` linha "Parte 2 — Vitrine" (busca deixa de ser pendente)

- [ ] **Step 1: Suites e tipos completos**

Run: `npm test --workspace=apps/storefront && npm test --workspace=apps/cockpit && npx tsc -p apps/storefront --noEmit && npx tsc -p apps/cockpit --noEmit`
Expected: 110 / 19 / limpo / limpo.

- [ ] **Step 2: Aceite no navegador (dev contra produção, chrome-devtools MCP)**

Registrar PASSOU/FALHOU com evidência (URL, texto lido do DOM, screenshot):
- **Item 7** — digitar "verde" sugere cor + categorias; "calça" (Enter) leva a `/br/categories/leggings`.
- **Item 8** — cookie com tamanho M: `/br/categories/tops` mostra chip "Seu tamanho: M" e a grade filtrada; remover a chip limpa (`?tamanho=`).
- **Item 9 (parte variável)** — ordem de "Compre por peça" muda conforme estilos do wizard.
- **Item 10 (parcial)** — `search_suggestion_click` aparece no `dataLayer`; `tsc` limpo nos dois apps.
- `grep -rn -i "linha treino\|linha casual" apps/storefront/src apps/cockpit/app` vazio; nenhuma string em inglês nova (`grep -n "Search\|Results" apps/storefront/src/modules/layout/components/search-bar/index.tsx` vazio).

- [ ] **Step 3: `architecture/catalog.md`** — acrescentar ao fim:

```markdown
## Busca + Wizard (Fase 5, 2026-09)

- Sugestões da barra (`modules/layout/components/search-bar`): categorias (nome, inclusive filhas) e cores vêm da **mesma `NavData`** da barra/menu (`buildSuggestions`, puro, `lib/util/search-suggest.ts`); produtos (≤5) via server action `suggestProducts` (`lib/data/search.ts`, Store API `q`, debounce 200 ms, resposta atrasada descartada). Evento `search_suggestion_click` (`suggestion_type` categoria|cor|produto|todos, `suggestion_value`, `search_term`).
- Sinônimos (`lib/util/search-synonyms.ts`): só palavras que **não** são nome de categoria ("calça"→leggings, "blusa"/"cropped"→tops, "macacão"→macaquinhos, "shortinho"→shorts). "bermuda" **não** está no mapa: Bermudas é categoria real (Masculino). Redirect 307 de `/busca?q=<sinônimo>` para a categoria só quando a busca inteira é o sinônimo.
- `/busca` usa `ProductListing` com `scope.q` (mesmo pipeline/teto de 100, filtros, ordenação, paginação); sempre `noindex, follow`, canonical `/br/busca`. `listingHref` preserva `q` ao mexer nos filtros.
- Tamanho do wizard (spec §10): `resolveListingFilters(sp)` (`lib/data/prefs.ts`) lê o cookie espelho `eclat_prefs` (parse defensivo em `lib/util/prefs-cookie.ts`) e aplica `tamanho=[X]` **só** quando a URL não tem filtro e o param `tamanho` está ausente. A URL nunca muda por conta própria; indexabilidade/canonical continuam derivadas só da URL. Opt-out = `?tamanho=` (param vazio), gravado por `listingHref` quando a cliente remove a chip "Seu tamanho", desmarca o tamanho ou limpa tudo. **Limite conhecido:** ao remover o último filtro explícito a URL volta a ficar limpa e a chip reaparece.
- Estilos do wizard: `orderByStyles` (`lib/util/style-order.ts`, `STYLE_HANDLES`) reordena `nav.feminine` em "Compre por peça" (escolhidos primeiro, nada some). O wizard chama `router.refresh()` ao fechar.
```

- [ ] **Step 4: `progress.md`** — nova entrada "2026-09-08 — Fase 5 (busca com sugestões, /busca no pipeline, wizard → listagem/home)" com: o que entrou (arquivos), resultados dos itens 7/8/9/10, contagem de testes, rulings 1–6, pendências para o dono (hex das cores para os swatches do dropdown; "Conjuntos" só aparece nas sugestões/na home quando tiver produto; sinônimos são um mapa fixo — ampliar conforme buscas reais no GA4).

- [ ] **Step 5: Spec** — em §9 trocar `"bermuda" → shorts` por `"shortinho" → shorts ("bermuda" não: Bermudas é categoria real em Masculino — ruling F5)`; em §10 acrescentar a frase `Opt-out da chip = \`?tamanho=\` (param presente e vazio).`

- [ ] **Step 6: `CLAUDE.md`** — na linha "Parte 2 — Vitrine", trocar `PENDENTE: busca, SEO por página, telas de conta.` por `PENDENTE: telas de conta. (Busca com sugestões e SEO por listagem: entregues nas Fases 2–5 da spec de navegação por tipo de peça.)`.

- [ ] **Step 7: Commit**

```bash
git add architecture/catalog.md progress.md docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md CLAUDE.md
git commit -m "docs(catalogo): fase 5 — busca com sugestões, /busca no pipeline e wizard ligado à navegação"
```

---

## Self-review

- **Cobertura da spec:** §9 sugestões (T1+T2), `/busca` no pipeline + sinônimos (T3); §10 tamanho salvo (T4), estilos na home (T5), ambos lidos do cookie espelho no servidor (T4); §11 `search_suggestion_click` (T2); §14 itens 7, 8, 9 (T6). §13 higiene: `@types/react-instantsearch-dom`/`pg` já não constam no `package.json` — nada a fazer.
- **Placeholders:** nenhum "TBD"; todo passo de código traz o código.
- **Consistência de tipos:** `ProductHit`/`Suggestions` (T1) usados em T2; `ListingScope.q` (T3) usado em `busca/page.tsx`; `implicitSize` flui página → template → `ProductListing` → `ListingTransitionProvider` → hook/chips/empty (T4); `listingHref(pathname, next, implicitSize, keepQ)` mesma assinatura em hook, `EmptyResults` e teste; `EclatPrefs` definido uma vez em `prefs-cookie.ts` e reexportado por `personalization/prefs.ts`; `STYLE_HANDLES` chaves = ids de `ESTILOS` do wizard (T5, com teste que trava as 5 chaves).
- **Ordem de tasks:** T3 altera `use-filter-navigation` para preservar `q`; T4 substitui esse trecho por `listingHref` (o brief de T4 diz explicitamente para remover o código manual de T3).
