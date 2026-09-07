# Fase 1 — Dados de catálogo + Cockpit — Plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deixar o catálogo do Medusa e o Cockpit prontos para a navegação por tipo de peça: árvore final de categorias com ordem, capa e descrição; opções `Tamanho`/`Cor` padronizadas e validadas; mapa de cores e guia de medidas editáveis; fotos vinculadas por cor; utilitários de disponibilidade que as fases 2 e 3 vão consumir.

**Architecture:** Medusa continua fonte da verdade do comércio (categorias com `rank` + `metadata`, opções de variante, imagens vinculadas a variantes via `POST /admin/products/{id}/images/{image_id}/variants/batch`). Conteúdo transversal de vitrine (mapa de cores, tabelas de medidas) vive em `site_content` no Supabase, editado no Cockpit e lido pela vitrine com revalidação de 30s. Regras puras (validação de opções, resolução de cor, escolha de tabela de medidas, disponibilidade) ficam em módulos sem I/O, com teste unitário.

**Tech Stack:** Next 15.5 (App Router) nos dois apps · Medusa 2.15.5 Admin/Store API · Supabase REST (`site_content`) · Vitest 3 (novo, só para funções puras) · Python 3 + `requests` para scripts operacionais (padrão já usado em `scripts/`).

**Spec:** `docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md` — seções 4.1–4.6 e 12. Leia a spec antes de qualquer task.

## Global Constraints

- Nunca adivinhar business logic; em ambiguidade, perguntar (CLAUDE.md).
- Dinheiro sempre em centavos inteiros. Este plano não toca preço.
- Handles de categoria são contrato de URL e **não mudam**: `tops`, `shorts`, `leggings`, `macaquinhos`, `conjuntos`, `acessorios`, `acessorios/oculos`, `acessorios/meias`, `masculino`, `masculino/bermudas`, `masculino/camisetas-regatas`.
- Nomes exibidos: `Top`, `Short`, `Legging`, `Macaquinho / Macacão`, `Conjuntos`, `Acessórios` (`Óculos`, `Meias`), `Masculino` (`Bermudas`, `Camisetas / Regatas`). Ordem = essa.
- Títulos de opção fixos: `Tamanho` e `Cor`. Tamanhos de vestuário: exatamente `P`, `M`, `G`, `GG`.
- Chaves de `site_content` criadas aqui: `cores` e `medidas`. Formatos definidos nas tasks 2 e 3.
- Metadata de categoria: `image_url`, `descricao_curta`. Metadata de produto: `destaque_rank` (string numérica).
- Todo texto de interface em pt-BR. Commits com prefixo `feat(...)`/`fix(...)`/`docs(...)` como no histórico.
- Não há modalidade (treino/casual/etc.) em lugar nenhum. Se encontrar resquício, remover só se estiver no arquivo que a task já toca; senão, anotar em `progress.md`.
- Cockpit roda em `apps/cockpit` (porta 7001), vitrine em `apps/storefront` (porta 8000). Comandos npm rodam da raiz `eclat/` com `--workspace`.
- Scripts Python leem credenciais de `apps/cockpit/.env.local` (padrão de `scripts/import-lancamento.py`). Backend de produção: `https://endearing-enthusiasm-production-775b.up.railway.app`. Scripts têm modo de simulação por padrão e só gravam com `--apply`.

---

## Mapa de arquivos

**Storefront (`apps/storefront/`)**
- Create: `vitest.config.ts`, `src/lib/util/availability.ts` (+ `.test.ts`), `src/lib/util/colors.ts` (+ `.test.ts`), `src/lib/util/measurements.ts` (+ `.test.ts`), `src/lib/data/colors.ts`, `src/lib/data/measurements.ts`
- Modify: `package.json` (script `test`, devDep vitest), `src/lib/data/categories.ts` (campos `metadata`, `rank`)

**Cockpit (`apps/cockpit/`)**
- Create: `vitest.config.ts`, `lib/catalog-rules.ts` (+ `.test.ts`), `lib/color-images.ts` (+ `.test.ts`), `components/cores-editor.tsx`, `components/medidas-editor.tsx`, `components/color-images.tsx`, `app/api/catalog-colors/route.ts`, `app/api/products/[id]/images/route.ts`, `app/api/products/[id]/images/[imageId]/route.ts`
- Modify: `package.json`, `lib/medusa.ts`, `app/api/taxonomy/categories/[id]/route.ts`, `app/api/products/create/route.ts`, `components/taxonomy-manager.tsx`, `components/product-form.tsx`, `app/(painel)/vitrine/page.tsx`

**Scripts (`scripts/`)**
- Create: `setup-categorias.py`, `seed-site-content-catalogo.py`, `check-catalog-options.py`

**Docs**
- Modify: `architecture/catalog.md`, `progress.md`

---

### Task 1: Infra de testes na vitrine + utilitário de disponibilidade

**Files:**
- Create: `apps/storefront/vitest.config.ts`
- Create: `apps/storefront/src/lib/util/availability.ts`
- Create: `apps/storefront/src/lib/util/availability.test.ts`
- Modify: `apps/storefront/package.json`

**Interfaces:**
- Produces:
  ```ts
  export type StockVariant = { id?: string; manage_inventory?: boolean | null; allow_backorder?: boolean | null; inventory_quantity?: number | null; options?: { option_id?: string | null; value?: string | null }[] | null }
  export type OptionDef = { id: string; title?: string | null }
  export function isVariantAvailable(v: StockVariant): boolean
  export function isProductAvailable(variants: StockVariant[] | null | undefined): boolean
  export function optionValue(options: OptionDef[] | null | undefined, variant: StockVariant, title: string): string | null
  export function variantsOfColor(product: { options?: OptionDef[] | null; variants?: StockVariant[] | null }, color: string): StockVariant[]
  export function colorStock(product, color: string): number
  export function isLowStock(product, color: string, threshold?: number): boolean   // padrão 3
  export function isNew(product: { created_at?: string | null; tags?: { value?: string | null }[] | null }, now?: number): boolean  // 30 dias ou tag "novo"
  ```
  Consumido pelas fases 2 (card, filtros) e 3 (seletores da PDP).

- [ ] **Step 1: Instalar o Vitest e criar a config**

Da raiz `eclat/`:

```bash
npm install -D vitest@^3.2.0 --workspace=apps/storefront
```

Criar `apps/storefront/vitest.config.ts`:

```ts
import path from "node:path"
import { defineConfig } from "vitest/config"

// Só funções puras (src/lib/util). Nada de React, nada de "server-only".
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "@lib": path.resolve(process.cwd(), "src/lib"),
      "@modules": path.resolve(process.cwd(), "src/modules"),
    },
  },
})
```

Em `apps/storefront/package.json`, adicionar ao bloco `scripts`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Escrever o teste que falha**

`apps/storefront/src/lib/util/availability.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import {
  colorStock,
  isLowStock,
  isNew,
  isProductAvailable,
  isVariantAvailable,
  optionValue,
  variantsOfColor,
} from "./availability"

const OPTS = [
  { id: "opt_tam", title: "Tamanho" },
  { id: "opt_cor", title: "Cor" },
]
const v = (id: string, tam: string, cor: string, qty: number, extra = {}) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity: qty,
  options: [
    { option_id: "opt_tam", value: tam },
    { option_id: "opt_cor", value: cor },
  ],
  ...extra,
})
const PRODUCT = {
  options: OPTS,
  variants: [
    v("v1", "P", "Verde Exército", 2),
    v("v2", "M", "Verde Exército", 0),
    v("v3", "P", "Licor", 5),
    v("v4", "M", "Licor", 0, { allow_backorder: true }),
  ],
}

describe("isVariantAvailable", () => {
  it("disponível quando não gerencia estoque", () => {
    expect(isVariantAvailable({ manage_inventory: false, inventory_quantity: 0 })).toBe(true)
  })
  it("disponível com backorder mesmo sem estoque", () => {
    expect(isVariantAvailable({ manage_inventory: true, allow_backorder: true, inventory_quantity: 0 })).toBe(true)
  })
  it("indisponível com estoque zero", () => {
    expect(isVariantAvailable({ manage_inventory: true, inventory_quantity: 0 })).toBe(false)
  })
  it("disponível com estoque positivo", () => {
    expect(isVariantAvailable({ manage_inventory: true, inventory_quantity: 1 })).toBe(true)
  })
})

describe("isProductAvailable", () => {
  it("true se alguma variante está disponível", () => {
    expect(isProductAvailable(PRODUCT.variants)).toBe(true)
  })
  it("false sem variantes ou todas esgotadas", () => {
    expect(isProductAvailable([])).toBe(false)
    expect(isProductAvailable(null)).toBe(false)
    expect(isProductAvailable([v("x", "P", "Licor", 0)])).toBe(false)
  })
})

describe("optionValue / variantsOfColor", () => {
  it("lê o valor pelo título da opção", () => {
    expect(optionValue(OPTS, PRODUCT.variants[0], "Cor")).toBe("Verde Exército")
    expect(optionValue(OPTS, PRODUCT.variants[0], "Tamanho")).toBe("P")
    expect(optionValue(OPTS, PRODUCT.variants[0], "Inexistente")).toBeNull()
  })
  it("filtra variantes de uma cor", () => {
    expect(variantsOfColor(PRODUCT, "Licor").map((x) => x.id)).toEqual(["v3", "v4"])
  })
})

describe("colorStock / isLowStock", () => {
  it("soma só o estoque numérico das variantes disponíveis da cor", () => {
    expect(colorStock(PRODUCT, "Verde Exército")).toBe(2)
    expect(colorStock(PRODUCT, "Licor")).toBe(5) // backorder sem quantidade não soma
  })
  it("últimas peças com 3 ou menos", () => {
    expect(isLowStock(PRODUCT, "Verde Exército")).toBe(true)
    expect(isLowStock(PRODUCT, "Licor")).toBe(false)
    expect(isLowStock(PRODUCT, "Licor", 5)).toBe(true)
  })
  it("cor totalmente esgotada não é 'últimas peças'", () => {
    expect(isLowStock({ options: OPTS, variants: [v("z", "P", "Preto", 0)] }, "Preto")).toBe(false)
  })
})

describe("isNew", () => {
  const now = Date.parse("2026-09-07T12:00:00Z")
  it("novo se criado há menos de 30 dias", () => {
    expect(isNew({ created_at: "2026-08-20T00:00:00Z" }, now)).toBe(true)
    expect(isNew({ created_at: "2026-07-01T00:00:00Z" }, now)).toBe(false)
  })
  it("novo se tem a tag 'novo', em qualquer caixa", () => {
    expect(isNew({ created_at: "2026-01-01T00:00:00Z", tags: [{ value: "Novo" }] }, now)).toBe(true)
  })
  it("sem data e sem tag não é novo", () => {
    expect(isNew({}, now)).toBe(false)
  })
})
```

- [ ] **Step 3: Rodar e ver falhar**

Da raiz: `npm test --workspace=apps/storefront`
Esperado: FAIL — `Cannot find module './availability'`.

- [ ] **Step 4: Implementar**

`apps/storefront/src/lib/util/availability.ts`:

```ts
// Regras de disponibilidade e "novidade" — uma fonte só para card, filtros e PDP.
// Sem I/O, sem React: testável e usável em server e client components.

export type StockVariant = {
  id?: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
  inventory_quantity?: number | null
  options?: { option_id?: string | null; value?: string | null }[] | null
}

export type OptionDef = { id: string; title?: string | null }

type ProductLike = {
  options?: OptionDef[] | null
  variants?: StockVariant[] | null
}

export const LOW_STOCK_THRESHOLD = 3
export const NEW_DAYS = 30

// Mesma regra do botão de compra (product-actions): não gerencia estoque → sempre;
// backorder → sempre; senão precisa de quantidade > 0.
export function isVariantAvailable(v: StockVariant): boolean {
  if (!v.manage_inventory) return true
  if (v.allow_backorder) return true
  return (v.inventory_quantity ?? 0) > 0
}

export function isProductAvailable(variants: StockVariant[] | null | undefined): boolean {
  return (variants ?? []).some(isVariantAvailable)
}

export function optionValue(
  options: OptionDef[] | null | undefined,
  variant: StockVariant,
  title: string
): string | null {
  const opt = (options ?? []).find((o) => (o.title ?? "").toLowerCase() === title.toLowerCase())
  if (!opt) return null
  const hit = (variant.options ?? []).find((vo) => vo.option_id === opt.id)
  return hit?.value ?? null
}

export function variantsOfColor(product: ProductLike, color: string): StockVariant[] {
  return (product.variants ?? []).filter((v) => optionValue(product.options, v, "Cor") === color)
}

// Soma só quantidade numérica das variantes disponíveis (backorder sem estoque conta 0).
export function colorStock(product: ProductLike, color: string): number {
  return variantsOfColor(product, color)
    .filter(isVariantAvailable)
    .reduce((acc, v) => acc + Math.max(0, v.inventory_quantity ?? 0), 0)
}

export function isLowStock(product: ProductLike, color: string, threshold = LOW_STOCK_THRESHOLD): boolean {
  const vs = variantsOfColor(product, color)
  if (!vs.some(isVariantAvailable)) return false
  return colorStock(product, color) <= threshold
}

export function isNew(
  product: { created_at?: string | null; tags?: { value?: string | null }[] | null },
  now: number = Date.now()
): boolean {
  if ((product.tags ?? []).some((t) => (t.value ?? "").trim().toLowerCase() === "novo")) return true
  if (!product.created_at) return false
  const created = Date.parse(product.created_at)
  if (Number.isNaN(created)) return false
  return now - created < NEW_DAYS * 24 * 60 * 60 * 1000
}
```

- [ ] **Step 5: Rodar e ver passar**

`npm test --workspace=apps/storefront`
Esperado: PASS, 13 testes.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/vitest.config.ts apps/storefront/package.json package-lock.json apps/storefront/src/lib/util/availability.ts apps/storefront/src/lib/util/availability.test.ts
git commit -m "feat(vitrine): utilitário de disponibilidade/novidade + infra Vitest para funções puras"
```

---

### Task 2: Mapa de cores — resolução pura + leitura na vitrine

**Files:**
- Create: `apps/storefront/src/lib/util/colors.ts`
- Create: `apps/storefront/src/lib/util/colors.test.ts`
- Create: `apps/storefront/src/lib/data/colors.ts`

**Interfaces:**
- Formato de `site_content.cores` (contrato com o Cockpit, task 7):
  ```json
  { "Verde Exército": { "hex": "#3B4A2F", "swatch_url": null }, "Licor": { "hex": "#D5823E", "swatch_url": "https://.../licor.jpg" } }
  ```
- Produces:
  ```ts
  export type ColorEntry = { hex: string | null; swatch_url?: string | null }
  export type ColorMap = Record<string, ColorEntry>
  export type ResolvedColor = { name: string; hex: string; swatch_url: string | null; known: boolean }
  export const FALLBACK_HEX = "#C9C4BC"
  export function normalizeColorName(s: string): string
  export function resolveColor(map: ColorMap | null | undefined, name: string): ResolvedColor
  export function isValidHex(s: string): boolean
  // data (server-only):
  export async function getColorMap(): Promise<ColorMap>
  ```

- [ ] **Step 1: Teste que falha**

`apps/storefront/src/lib/util/colors.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { FALLBACK_HEX, isValidHex, normalizeColorName, resolveColor } from "./colors"

const MAP = {
  "Verde Exército": { hex: "#3B4A2F", swatch_url: null },
  Licor: { hex: "#d5823e", swatch_url: "https://x/licor.jpg" },
  "Off-white": { hex: null },
}

describe("normalizeColorName", () => {
  it("ignora caixa, acento e espaços extras", () => {
    expect(normalizeColorName("  verde exercito ")).toBe("verde exercito")
    expect(normalizeColorName("Verde Exército")).toBe("verde exercito")
  })
})

describe("resolveColor", () => {
  it("acha por nome exato e devolve hex em maiúsculas", () => {
    expect(resolveColor(MAP, "Licor")).toEqual({ name: "Licor", hex: "#D5823E", swatch_url: "https://x/licor.jpg", known: true })
  })
  it("acha ignorando acento/caixa e devolve o nome canônico do mapa", () => {
    expect(resolveColor(MAP, "verde exercito").name).toBe("Verde Exército")
    expect(resolveColor(MAP, "verde exercito").known).toBe(true)
  })
  it("cor conhecida sem hex usa o fallback mas continua known", () => {
    const r = resolveColor(MAP, "Off-white")
    expect(r.hex).toBe(FALLBACK_HEX)
    expect(r.known).toBe(true)
  })
  it("cor desconhecida: fallback, known=false, nome como veio", () => {
    expect(resolveColor(MAP, "Azul Petróleo")).toEqual({ name: "Azul Petróleo", hex: FALLBACK_HEX, swatch_url: null, known: false })
    expect(resolveColor(null, "Licor").known).toBe(false)
  })
})

describe("isValidHex", () => {
  it("aceita #RGB e #RRGGBB", () => {
    expect(isValidHex("#fff")).toBe(true)
    expect(isValidHex("#3B4A2F")).toBe(true)
    expect(isValidHex("3B4A2F")).toBe(false)
    expect(isValidHex("#GGG")).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

`npm test --workspace=apps/storefront` → FAIL: `Cannot find module './colors'`.

- [ ] **Step 3: Implementar a parte pura**

`apps/storefront/src/lib/util/colors.ts`:

```ts
// Mapa de cores da marca (site_content.cores) → swatch do card, filtro, seletor da PDP.
// Puro: sem I/O. A leitura fica em lib/data/colors.ts.

export type ColorEntry = { hex: string | null; swatch_url?: string | null }
export type ColorMap = Record<string, ColorEntry>
export type ResolvedColor = { name: string; hex: string; swatch_url: string | null; known: boolean }

// "pedra" da paleta ÉCLAT — neutro para cor sem hex cadastrado.
export const FALLBACK_HEX = "#C9C4BC"

export function normalizeColorName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
}

export function isValidHex(s: string): boolean {
  return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(s)
}

export function resolveColor(map: ColorMap | null | undefined, name: string): ResolvedColor {
  const wanted = normalizeColorName(name)
  const canonical = Object.keys(map ?? {}).find((k) => normalizeColorName(k) === wanted)
  if (!canonical) return { name, hex: FALLBACK_HEX, swatch_url: null, known: false }
  const entry = (map as ColorMap)[canonical]
  const hex = entry.hex && isValidHex(entry.hex) ? entry.hex.toUpperCase() : FALLBACK_HEX
  return { name: canonical, hex, swatch_url: entry.swatch_url ?? null, known: true }
}
```

- [ ] **Step 4: Rodar e ver passar**

`npm test --workspace=apps/storefront` → PASS.

- [ ] **Step 5: Leitura server-side**

`apps/storefront/src/lib/data/colors.ts`:

```ts
import "server-only"

import { getSiteContent } from "./site-content"
import type { ColorMap } from "@lib/util/colors"

// Lê o mapa de cores editado no Cockpit (Vitrine → Cores). Revalida em ~30s
// (herdado de getSiteContent). Sem mapa → objeto vazio; resolveColor cai no fallback.
export async function getColorMap(): Promise<ColorMap> {
  const raw = await getSiteContent<ColorMap>("cores")
  if (!raw || typeof raw !== "object") return {}
  return raw
}
```

Verificar tipos: da raiz, `npx tsc -p apps/storefront --noEmit` — esperado sem erros novos (o projeto pode ter erros antigos; compare com `git stash` se houver dúvida).

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/util/colors.ts apps/storefront/src/lib/util/colors.test.ts apps/storefront/src/lib/data/colors.ts
git commit -m "feat(vitrine): mapa de cores — resolução pura com fallback + leitura de site_content.cores"
```

---

### Task 3: Guia de medidas por categoria — escolha pura + leitura + campos de categoria

**Files:**
- Create: `apps/storefront/src/lib/util/measurements.ts`
- Create: `apps/storefront/src/lib/util/measurements.test.ts`
- Create: `apps/storefront/src/lib/data/measurements.ts`
- Modify: `apps/storefront/src/lib/data/categories.ts`

**Interfaces:**
- Formato de `site_content.medidas` (contrato com o Cockpit, task 8). Chave = caminho de handle da categoria:
  ```json
  { "leggings": { "columns": ["Cintura", "Quadril"], "rows": [["P","62–68 cm","88–94 cm"], ["M","68–74 cm","94–100 cm"]] },
    "masculino": { "columns": ["Cintura", "Quadril"], "rows": [["P","76–82 cm","92–98 cm"]] } }
  ```
- Produces:
  ```ts
  export type MeasureTable = { columns: string[]; rows: string[][] }   // rows[i][0] = tamanho
  export type MeasureMap = Record<string, MeasureTable>
  export function pickMeasurements(map: MeasureMap | null | undefined, handlePath: string): MeasureTable | null  // herda da mãe
  export function isMeasureTable(x: unknown): x is MeasureTable
  export async function getMeasureMap(): Promise<MeasureMap>   // server-only
  ```
- `listCategories()` passa a devolver `metadata` e `rank` (usados pela fase 4).

- [ ] **Step 1: Teste que falha**

`apps/storefront/src/lib/util/measurements.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isMeasureTable, pickMeasurements } from "./measurements"

const T = (c: string[]) => ({ columns: c, rows: [["P", ...c.map(() => "1")], ["M", ...c.map(() => "2")]] })
const MAP = {
  leggings: T(["Cintura", "Quadril"]),
  masculino: T(["Cintura", "Quadril"]),
  "masculino/camisetas-regatas": T(["Tórax", "Comprimento"]),
}

describe("pickMeasurements", () => {
  it("acha pelo caminho completo", () => {
    expect(pickMeasurements(MAP, "masculino/camisetas-regatas")?.columns).toEqual(["Tórax", "Comprimento"])
  })
  it("subcategoria sem tabela herda da mãe", () => {
    expect(pickMeasurements(MAP, "masculino/bermudas")?.columns).toEqual(["Cintura", "Quadril"])
  })
  it("sem tabela em nenhum nível devolve null (acessórios)", () => {
    expect(pickMeasurements(MAP, "acessorios/oculos")).toBeNull()
    expect(pickMeasurements(null, "leggings")).toBeNull()
  })
  it("ignora barra inicial/final", () => {
    expect(pickMeasurements(MAP, "/leggings/")).not.toBeNull()
  })
})

describe("isMeasureTable", () => {
  it("valida forma", () => {
    expect(isMeasureTable({ columns: ["a"], rows: [["P", "1"]] })).toBe(true)
    expect(isMeasureTable({ columns: "a", rows: [] })).toBe(false)
    expect(isMeasureTable(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

`npm test --workspace=apps/storefront` → FAIL: `Cannot find module './measurements'`.

- [ ] **Step 3: Implementar a parte pura**

`apps/storefront/src/lib/util/measurements.ts`:

```ts
// Tabela de medidas por tipo de peça (site_content.medidas). Chave = caminho de handle
// da categoria ("leggings", "masculino/bermudas"). Subcategoria sem tabela herda da mãe.

export type MeasureTable = { columns: string[]; rows: string[][] }
export type MeasureMap = Record<string, MeasureTable>

export function isMeasureTable(x: unknown): x is MeasureTable {
  if (!x || typeof x !== "object") return false
  const t = x as Partial<MeasureTable>
  return (
    Array.isArray(t.columns) &&
    t.columns.every((c) => typeof c === "string") &&
    Array.isArray(t.rows) &&
    t.rows.every((r) => Array.isArray(r) && r.every((c) => typeof c === "string"))
  )
}

export function pickMeasurements(map: MeasureMap | null | undefined, handlePath: string): MeasureTable | null {
  if (!map) return null
  const parts = handlePath.split("/").filter(Boolean)
  for (let n = parts.length; n > 0; n--) {
    const key = parts.slice(0, n).join("/")
    const t = map[key]
    if (isMeasureTable(t)) return t
  }
  return null
}
```

- [ ] **Step 4: Rodar e ver passar**

`npm test --workspace=apps/storefront` → PASS.

- [ ] **Step 5: Leitura server-side + campos de categoria**

`apps/storefront/src/lib/data/measurements.ts`:

```ts
import "server-only"

import { getSiteContent } from "./site-content"
import { isMeasureTable, type MeasureMap } from "@lib/util/measurements"

// Guia de medidas editado no Cockpit (Vitrine → Medidas). Descarta entradas malformadas.
export async function getMeasureMap(): Promise<MeasureMap> {
  const raw = await getSiteContent<Record<string, unknown>>("medidas")
  if (!raw || typeof raw !== "object") return {}
  const out: MeasureMap = {}
  for (const [k, v] of Object.entries(raw)) if (isMeasureTable(v)) out[k] = v
  return out
}
```

Em `apps/storefront/src/lib/data/categories.ts`, nas duas chamadas, trocar o `fields`:

```ts
// listCategories
fields: "*category_children, *products, *parent_category, *parent_category.parent_category, +metadata, +rank",
// getCategoryByHandle
fields: "*category_children, *products, *parent_category, +metadata, +rank",
```

Verificar: `npx tsc -p apps/storefront --noEmit` sem erros novos.

- [ ] **Step 6: Commit**

```bash
git add apps/storefront/src/lib/util/measurements.ts apps/storefront/src/lib/util/measurements.test.ts apps/storefront/src/lib/data/measurements.ts apps/storefront/src/lib/data/categories.ts
git commit -m "feat(vitrine): guia de medidas por categoria (herança da mãe) + metadata/rank nas categorias"
```

---

### Task 4: Script que cria a árvore final de categorias no Medusa

**Files:**
- Create: `scripts/setup-categorias.py`

**Interfaces:**
- Consome a Admin API (`/admin/product-categories`). Idempotente: roda quantas vezes for preciso. Sem `--apply` só imprime o que faria.

- [ ] **Step 1: Escrever o script**

`scripts/setup-categorias.py`:

```python
"""
Cria/ajusta a ÁRVORE FINAL de categorias da ÉCLAT no Medusa (spec 4.1).
Idempotente. Padrão = simulação; grave com:  python scripts/setup-categorias.py --apply
Requisitos: pip install requests
Credenciais: apps/cockpit/.env.local -> MEDUSA_ADMIN_EMAIL / MEDUSA_ADMIN_PASSWORD
"""
import os, sys

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv

# (nome exibido, handle, handle da mãe ou None, rank)
ARVORE = [
    ("Top", "tops", None, 0),
    ("Short", "shorts", None, 1),
    ("Legging", "leggings", None, 2),
    ("Macaquinho / Macacão", "macaquinhos", None, 3),
    ("Conjuntos", "conjuntos", None, 4),
    ("Acessórios", "acessorios", None, 5),
    ("Óculos", "oculos", "acessorios", 0),
    ("Meias", "meias", "acessorios", 1),
    ("Masculino", "masculino", None, 6),
    ("Bermudas", "bermudas", "masculino", 0),
    ("Camisetas / Regatas", "camisetas-regatas", "masculino", 1),
]

def env_cockpit():
    env = {}
    p = os.path.join(RAIZ, "apps", "cockpit", ".env.local")
    with open(p, encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env

def main():
    env = env_cockpit()
    email, senha = env.get("MEDUSA_ADMIN_EMAIL"), env.get("MEDUSA_ADMIN_PASSWORD")
    assert email and senha, "MEDUSA_ADMIN_EMAIL/PASSWORD ausentes no apps/cockpit/.env.local"
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": email, "password": senha}, timeout=30)
    assert r.ok and r.json().get("token"), "login admin falhou (%s)" % r.status_code
    H = {"Authorization": "Bearer " + r.json()["token"]}

    r = requests.get(BASE + "/admin/product-categories?limit=200&fields=id,name,handle,rank,parent_category_id", headers=H, timeout=30)
    r.raise_for_status()
    existentes = {c["handle"]: c for c in r.json()["product_categories"]}
    print("categorias existentes:", ", ".join(sorted(existentes)) or "(nenhuma)")
    print("modo:", "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)")

    for nome, handle, pai, rank in ARVORE:
        parent_id = existentes[pai]["id"] if pai else None
        if pai and not parent_id:
            print("  !! mãe %s ainda não existe para %s" % (pai, handle)); continue
        atual = existentes.get(handle)
        if atual:
            mudancas = {}
            if atual["name"] != nome: mudancas["name"] = nome
            if (atual.get("rank") or 0) != rank: mudancas["rank"] = rank
            if (atual.get("parent_category_id") or None) != parent_id: mudancas["parent_category_id"] = parent_id
            if not mudancas:
                print("  = %-22s ok" % handle); continue
            print("  ~ %-22s atualizar %s" % (handle, mudancas))
            if APPLY:
                rr = requests.post(BASE + "/admin/product-categories/" + atual["id"], headers=H, json=mudancas, timeout=30)
                assert rr.ok, "falhou %s: %s" % (handle, rr.text)
        else:
            body = {"name": nome, "handle": handle, "is_active": True, "is_internal": False, "rank": rank, "parent_category_id": parent_id}
            print("  + %-22s criar (mãe=%s, rank=%s)" % (handle, pai, rank))
            if APPLY:
                rr = requests.post(BASE + "/admin/product-categories", headers=H, json=body, timeout=30)
                assert rr.ok, "falhou %s: %s" % (handle, rr.text)
                existentes[handle] = rr.json()["product_category"]
    print("pronto.")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Rodar em simulação**

```bash
python scripts/setup-categorias.py
```

Esperado: lista com `~ tops atualizar {'name': 'Top'}` (e shorts/leggings/macaquinhos), `+ conjuntos criar`, `+ acessorios criar`, etc. Nenhum erro. Se aparecer `!! mãe ... não existe`, é porque a simulação não cria; ignorar nesse modo.

- [ ] **Step 3: Aplicar e conferir**

```bash
python scripts/setup-categorias.py --apply
python scripts/setup-categorias.py
```

Esperado na segunda execução: todas as linhas com `=  ok`. Conferir no Cockpit → Produtos → "Categorias, coleções & tags": árvore com 7 raízes na ordem certa e as 4 filhas.

- [ ] **Step 4: Commit**

```bash
git add scripts/setup-categorias.py
git commit -m "feat(catalogo): script idempotente da árvore final de categorias (nomes, ranks, Acessórios e Masculino)"
```

---

### Task 5: Cockpit — categorias com rank, capa e descrição curta

**Files:**
- Modify: `apps/cockpit/lib/medusa.ts` (tipo `CockpitCategory`, `medusaListCategories`, `medusaUpdateCategory`)
- Modify: `apps/cockpit/app/api/taxonomy/categories/[id]/route.ts`
- Modify: `apps/cockpit/components/taxonomy-manager.tsx`

**Interfaces:**
- Produces:
  ```ts
  export type CockpitCategory = { id: string; name: string; handle: string; parent_id: string | null; rank: number; metadata: Record<string, unknown> }
  medusaUpdateCategory(id, { name?, parent_id?, rank?, metadata? })
  ```
  `PATCH /api/taxonomy/categories/:id` aceita `{ name?, parent_id?, rank?, metadata? }`. `metadata` é mesclado sobre o existente no cliente antes de enviar (o Medusa substitui o objeto inteiro).
- `handle` na categoria é consumido pela task 6 (regra de acessório).

- [ ] **Step 1: Estender o cliente Medusa**

Em `apps/cockpit/lib/medusa.ts`, substituir o bloco `CockpitCategory` + `medusaListCategories` + `medusaUpdateCategory` por:

```ts
export type CockpitCategory = {
  id: string
  name: string
  handle: string
  parent_id: string | null
  rank: number
  metadata: Record<string, unknown>
}

export async function medusaListCategories(): Promise<CockpitCategory[]> {
  const r = await medusaAdmin(
    `/admin/product-categories?limit=200&fields=id,name,handle,parent_category_id,rank,metadata`
  )
  if (!r.ok) throw new Error(`listar categorias falhou (HTTP ${r.status})`)
  const { product_categories } = (await r.json()) as {
    product_categories: {
      id: string
      name: string
      handle: string
      parent_category_id: string | null
      rank: number
      metadata: Record<string, unknown> | null
    }[]
  }
  return product_categories.map((c) => ({
    id: c.id,
    name: c.name,
    handle: c.handle,
    parent_id: c.parent_category_id ?? null,
    rank: c.rank ?? 0,
    metadata: c.metadata ?? {},
  }))
}

export async function medusaUpdateCategory(
  id: string,
  fields: {
    name?: string
    parent_id?: string | null
    rank?: number
    metadata?: Record<string, unknown>
  }
): Promise<void> {
  const body: Record<string, unknown> = {}
  if (fields.name !== undefined) body.name = fields.name
  if (fields.parent_id !== undefined) body.parent_category_id = fields.parent_id || null
  if (fields.rank !== undefined) body.rank = Math.max(0, Math.round(fields.rank))
  if (fields.metadata !== undefined) body.metadata = fields.metadata
  const r = await medusaAdmin(`/admin/product-categories/${id}`, {
    method: "POST",
    body: JSON.stringify(body),
  })
  if (!r.ok) throw new Error(`atualizar categoria falhou (HTTP ${r.status}): ${await r.text()}`)
}
```

- [ ] **Step 2: Rota PATCH repassa rank e metadata**

`apps/cockpit/app/api/taxonomy/categories/[id]/route.ts`, função `PATCH`:

```ts
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const fields = (await req.json()) as {
    name?: string
    parent_id?: string | null
    rank?: number
    metadata?: Record<string, unknown>
  }
  if (fields.rank !== undefined && !(Number.isFinite(fields.rank) && fields.rank >= 0))
    return NextResponse.json({ error: "rank deve ser número ≥ 0" }, { status: 400 })
  if (fields.metadata !== undefined && (typeof fields.metadata !== "object" || fields.metadata === null))
    return NextResponse.json({ error: "metadata inválido" }, { status: 400 })
  try {
    await medusaUpdateCategory(id, fields)
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 3: Painel de edição por categoria no taxonomy-manager**

Em `apps/cockpit/components/taxonomy-manager.tsx`:

1. Atualizar o tipo: `type Cat = { id: string; name: string; handle: string; parent_id: string | null; rank: number; metadata: Record<string, unknown> }`.
2. Adicionar estado `const [editando, setEditando] = useState<Cat | null>(null)`.
3. Na linha de cada categoria, acrescentar o botão `<button onClick={() => setEditando(cat)} className="underline">editar</button>` antes de "renomear".
4. Abaixo do bloco `<section>` de categorias, renderizar `{editando && <CategoriaEditor cat={editando} onClose={() => setEditando(null)} onSave={salvarCategoria} />}`.
5. Adicionar a função de salvar dentro do componente:

```tsx
async function salvarCategoria(cat: Cat, dados: { rank: number; image_url: string; descricao_curta: string }) {
  await call(`/api/taxonomy/categories/${cat.id}`, "PATCH", {
    rank: dados.rank,
    metadata: {
      ...cat.metadata,
      image_url: dados.image_url || null,
      descricao_curta: dados.descricao_curta || null,
    },
  })
  setEditando(null)
}
```

6. Adicionar o componente no fim do arquivo:

```tsx
function CategoriaEditor({
  cat,
  onClose,
  onSave,
}: {
  cat: Cat
  onClose: () => void
  onSave: (cat: Cat, dados: { rank: number; image_url: string; descricao_curta: string }) => Promise<void>
}) {
  const [rank, setRank] = useState(String(cat.rank ?? 0))
  const [imageUrl, setImageUrl] = useState(String(cat.metadata?.image_url ?? ""))
  const [descricao, setDescricao] = useState(String(cat.metadata?.descricao_curta ?? ""))
  const [enviando, setEnviando] = useState(false)
  const inputCls =
    "w-full border border-eclat-pedra/50 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  const labelCls = "text-xs uppercase tracking-wider text-eclat-grafite/60 mb-1 block"

  async function upload(file: File) {
    setEnviando(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const r = await fetch("/api/site-upload", { method: "POST", body: fd })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha no upload")
      setImageUrl(d.url)
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mt-3 border border-eclat-dourado/40 rounded-lg bg-white/70 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-eclat-grafite">
          {cat.name} <span className="text-eclat-grafite/40 text-xs">/{cat.handle}</span>
        </h4>
        <button onClick={onClose} className="text-eclat-grafite/50 hover:text-eclat-grafite">✕</button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelCls}>Ordem (rank)</label>
          <input value={rank} onChange={(e) => setRank(e.target.value)} inputMode="numeric" className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Descrição curta (1 linha, cabeçalho da listagem)</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={140} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Capa (menu, home e cabeçalho da categoria)</label>
        <div className="flex items-center gap-3">
          {imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imageUrl} alt="capa" className="w-16 h-16 rounded object-cover border border-eclat-pedra/40" />
          )}
          <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} className="text-xs" />
          {enviando && <span className="text-xs text-eclat-grafite/50">enviando…</span>}
          {imageUrl && <button onClick={() => setImageUrl("")} className="text-xs text-red-700 underline">remover</button>}
        </div>
      </div>
      <div className="flex gap-3">
        <button
          onClick={() => {
            const n = Number(rank)
            if (!Number.isFinite(n) || n < 0) return alert("Ordem deve ser um número ≥ 0.")
            onSave(cat, { rank: n, image_url: imageUrl.trim(), descricao_curta: descricao.trim() })
          }}
          className="bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors"
        >
          Salvar
        </button>
        <button onClick={onClose} className="text-sm text-eclat-grafite/60 underline">cancelar</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Validar no navegador**

Subir o Cockpit (`npm run dev --workspace=apps/cockpit`, porta 7001), abrir Produtos → "Categorias, coleções & tags" → passar o mouse em "Top" → **editar** → definir capa e descrição → Salvar. Reabrir: valores persistem. Conferir `npx tsc -p apps/cockpit --noEmit` limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/lib/medusa.ts "apps/cockpit/app/api/taxonomy/categories/[id]/route.ts" apps/cockpit/components/taxonomy-manager.tsx
git commit -m "feat(cockpit): categorias com ordem, capa e descrição curta (rank + metadata via Admin API)"
```

---

### Task 6: Cockpit — regras de opções de variante (validação) no criar produto

**Files:**
- Create: `apps/cockpit/vitest.config.ts`
- Create: `apps/cockpit/lib/catalog-rules.ts`
- Create: `apps/cockpit/lib/catalog-rules.test.ts`
- Modify: `apps/cockpit/package.json`
- Modify: `apps/cockpit/app/api/products/create/route.ts`
- Modify: `apps/cockpit/components/product-form.tsx`

**Interfaces:**
- Produces:
  ```ts
  export const TAMANHOS_VESTUARIO = ["P", "M", "G", "GG"] as const
  export type OptionInput = { title: string; values: string[] }
  export type ValidationResult = { errors: string[]; warnings: string[] }
  export function isAccessoryHandle(handle: string): boolean       // "acessorios" ou "acessorios/..."
  export function validateProductOptions(options: OptionInput[], ctx: { isAccessory: boolean; knownColors: string[] }): ValidationResult
  ```
- Consumes: `CockpitCategory.handle` (task 5); `site_content.cores` (formato da task 2).

- [ ] **Step 1: Infra Vitest no Cockpit + teste que falha**

Da raiz: `npm install -D vitest@^3.2.0 --workspace=apps/cockpit`

`apps/cockpit/vitest.config.ts`:

```ts
import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  test: { include: ["lib/**/*.test.ts"], environment: "node" },
  resolve: { alias: { "@": path.resolve(process.cwd()) } },
})
```

`apps/cockpit/package.json` → `scripts`: `"test": "vitest run"`.

`apps/cockpit/lib/catalog-rules.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { isAccessoryHandle, validateProductOptions } from "./catalog-rules"

const CORES = ["Verde Exército", "Licor"]
const vest = { isAccessory: false, knownColors: CORES }
const aces = { isAccessory: true, knownColors: CORES }

describe("isAccessoryHandle", () => {
  it("reconhece a raiz e as filhas", () => {
    expect(isAccessoryHandle("acessorios")).toBe(true)
    expect(isAccessoryHandle("acessorios/meias")).toBe(true)
    expect(isAccessoryHandle("tops")).toBe(false)
    expect(isAccessoryHandle("masculino/bermudas")).toBe(false)
  })
})

describe("validateProductOptions — vestuário", () => {
  it("aceita Tamanho P/M/G/GG + Cor conhecida", () => {
    const r = validateProductOptions(
      [{ title: "Tamanho", values: ["P", "M", "G", "GG"] }, { title: "Cor", values: ["Licor"] }],
      vest
    )
    expect(r).toEqual({ errors: [], warnings: [] })
  })
  it("exige as duas opções", () => {
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }], vest).errors).toContain('Vestuário precisa da opção "Tamanho".')
    expect(validateProductOptions([{ title: "Tamanho", values: ["P"] }], vest).errors).toContain('Toda peça precisa da opção "Cor".')
  })
  it("rejeita tamanho fora do padrão e título desconhecido", () => {
    const r = validateProductOptions(
      [{ title: "Tamanho", values: ["P", "XG"] }, { title: "Cor", values: ["Licor"] }, { title: "Padrão", values: ["Único"] }],
      vest
    )
    expect(r.errors).toContain("Tamanho inválido para vestuário: XG. Use P, M, G, GG.")
    expect(r.errors).toContain('Opção não permitida: "Padrão". Só "Tamanho" e "Cor".')
  })
  it("aceita título em caixa diferente mas normaliza no aviso", () => {
    const r = validateProductOptions([{ title: "tamanho", values: ["M"] }, { title: "COR", values: ["Licor"] }], vest)
    expect(r.errors).toEqual([])
    expect(r.warnings).toContain('Título de opção fora do padrão: "tamanho" (use "Tamanho").')
  })
  it("cor fora do mapa é aviso, não erro", () => {
    const r = validateProductOptions([{ title: "Tamanho", values: ["M"] }, { title: "Cor", values: ["Azul"] }], vest)
    expect(r.errors).toEqual([])
    expect(r.warnings).toContain('Cor "Azul" não está no mapa de cores (Vitrine → Cores).')
  })
  it("valores vazios ou duplicados são erro", () => {
    const r = validateProductOptions([{ title: "Tamanho", values: [] }, { title: "Cor", values: ["Licor", "licor"] }], vest)
    expect(r.errors).toContain('Opção "Tamanho" sem valores.')
    expect(r.errors).toContain('Opção "Cor" tem valores repetidos.')
  })
})

describe("validateProductOptions — acessórios", () => {
  it("Cor obrigatória, Tamanho opcional e livre", () => {
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }], aces).errors).toEqual([])
    expect(validateProductOptions([{ title: "Cor", values: ["Licor"] }, { title: "Tamanho", values: ["34-38", "39-43"] }], aces).errors).toEqual([])
    expect(validateProductOptions([{ title: "Tamanho", values: ["34-38"] }], aces).errors).toContain('Toda peça precisa da opção "Cor".')
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

`npm test --workspace=apps/cockpit` → FAIL: `Cannot find module './catalog-rules'`.

- [ ] **Step 3: Implementar**

`apps/cockpit/lib/catalog-rules.ts`:

```ts
// Regras do catálogo (spec 4.2): opções de variante padronizadas.
// Puro — usado pela rota de criação (bloqueio) e pelo formulário (feedback ao vivo).

export const TAMANHOS_VESTUARIO = ["P", "M", "G", "GG"] as const
export type OptionInput = { title: string; values: string[] }
export type ValidationResult = { errors: string[]; warnings: string[] }

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()

export function isAccessoryHandle(handle: string): boolean {
  const h = handle.replace(/^\/+|\/+$/g, "")
  return h === "acessorios" || h.startsWith("acessorios/")
}

export function validateProductOptions(
  options: OptionInput[],
  ctx: { isAccessory: boolean; knownColors: string[] }
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const known = new Set(ctx.knownColors.map(norm))

  let tamanho: OptionInput | undefined
  let cor: OptionInput | undefined
  for (const o of options) {
    const t = norm(o.title)
    if (t === "tamanho") {
      if (o.title !== "Tamanho") warnings.push(`Título de opção fora do padrão: "${o.title}" (use "Tamanho").`)
      tamanho = o
    } else if (t === "cor") {
      if (o.title !== "Cor") warnings.push(`Título de opção fora do padrão: "${o.title}" (use "Cor").`)
      cor = o
    } else {
      errors.push(`Opção não permitida: "${o.title}". Só "Tamanho" e "Cor".`)
    }
  }

  if (!cor) errors.push('Toda peça precisa da opção "Cor".')
  if (!ctx.isAccessory && !tamanho) errors.push('Vestuário precisa da opção "Tamanho".')

  for (const o of [tamanho, cor]) {
    if (!o) continue
    const vals = o.values.map((v) => v.trim()).filter(Boolean)
    if (!vals.length) errors.push(`Opção "${o.title}" sem valores.`)
    if (new Set(vals.map(norm)).size !== vals.length) errors.push(`Opção "${o.title}" tem valores repetidos.`)
  }

  if (tamanho && !ctx.isAccessory) {
    const permitidos = new Set<string>(TAMANHOS_VESTUARIO)
    const ruins = tamanho.values.map((v) => v.trim()).filter((v) => v && !permitidos.has(v))
    if (ruins.length) errors.push(`Tamanho inválido para vestuário: ${ruins.join(", ")}. Use P, M, G, GG.`)
  }

  if (cor) {
    for (const c of cor.values.map((v) => v.trim()).filter(Boolean)) {
      if (!known.has(norm(c))) warnings.push(`Cor "${c}" não está no mapa de cores (Vitrine → Cores).`)
    }
  }

  return { errors, warnings }
}
```

- [ ] **Step 4: Rodar e ver passar**

`npm test --workspace=apps/cockpit` → PASS.

- [ ] **Step 5: Bloquear na rota de criação**

`apps/cockpit/app/api/products/create/route.ts` — substituir o arquivo por:

```ts
import { NextResponse } from "next/server"
import { medusaCreateProduct, medusaListCategories, type NewProductInput } from "@/lib/medusa"
import { sb } from "@/lib/sb-admin"
import { isAccessoryHandle, validateProductOptions } from "@/lib/catalog-rules"

// Cria um produto novo (com variantes + estoque inicial) via Medusa Admin API.
// Valida as opções (spec 4.2) ANTES de chamar o Medusa: erro bloqueia (400), aviso só informa.
// custo_centavos (opcional) é salvo no Supabase para todas as variações criadas.
export async function POST(req: Request) {
  const input = (await req.json()) as NewProductInput & { custo_centavos?: number }
  if (!input.title?.trim())
    return NextResponse.json({ error: "título obrigatório" }, { status: 400 })
  if (!input.handle?.trim())
    return NextResponse.json({ error: "handle obrigatório" }, { status: 400 })
  if (!input.variants?.length)
    return NextResponse.json({ error: "ao menos uma variação é necessária" }, { status: 400 })
  try {
    const [cats, coresRes] = await Promise.all([
      medusaListCategories(),
      sb("site_content?key=eq.cores&select=value"),
    ])
    const handles = cats.filter((c) => (input.category_ids ?? []).includes(c.id)).map((c) => c.handle)
    const isAccessory = handles.length > 0 && handles.every(isAccessoryHandle)
    const coresRows = coresRes.ok ? ((await coresRes.json()) as { value: Record<string, unknown> }[]) : []
    const knownColors = Object.keys(coresRows[0]?.value ?? {})
    const { errors, warnings } = validateProductOptions(input.options ?? [], { isAccessory, knownColors })
    if (errors.length)
      return NextResponse.json({ error: errors.join(" "), errors, warnings }, { status: 400 })

    const product = await medusaCreateProduct(input)

    const custo = input.custo_centavos
    if (typeof custo === "number" && Number.isInteger(custo) && custo >= 0) {
      const rows = product.variants.map((v) => ({
        medusa_variant_id: v.id,
        sku: v.sku,
        custo_centavos: custo,
        updated_at: new Date().toISOString(),
      }))
      if (rows.length)
        await sb("produto_custo?on_conflict=medusa_variant_id", {
          method: "POST",
          headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify(rows),
        })
    }
    return NextResponse.json({ id: product.id, warnings })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 6: Formulário — cores do mapa, acessório sem tamanho, avisos ao vivo**

Em `apps/cockpit/components/product-form.tsx`:

1. Importar: `import { isAccessoryHandle, validateProductOptions } from "@/lib/catalog-rules"`.
2. Tipo `Cat` ganha `handle: string`.
3. Novos estados: `const [coresMapa, setCoresMapa] = useState<string[]>([])`.
4. No `useEffect` de carga, junto ao `catalog-meta`, carregar o mapa:

```ts
const cr = await fetch("/api/site-content/cores", { cache: "no-store" })
const cd = await cr.json().catch(() => ({}))
setCoresMapa(cr.ok && cd && typeof cd === "object" ? Object.keys(cd) : [])
```

5. Derivar acessório e validação (após `variantesPreview`):

```ts
const isAccessory = useMemo(() => {
  const handles = categories.filter((c) => catIds.includes(c.id)).map((c) => c.handle)
  return handles.length > 0 && handles.every(isAccessoryHandle)
}, [categories, catIds])

const validacao = useMemo(() => {
  if (mode !== "create") return { errors: [], warnings: [] }
  const options: { title: string; values: string[] }[] = []
  if (tamanhos.length) options.push({ title: "Tamanho", values: tamanhos })
  if (cores.length) options.push({ title: "Cor", values: cores })
  return validateProductOptions(options, { isAccessory, knownColors: coresMapa })
}, [mode, tamanhos, cores, isAccessory, coresMapa])
```

6. Em `salvar()`, no ramo `create`, **remover** a linha `if (!options.length) options.push({ title: "Padrão", values: ["Único"] })` e, antes do `fetch`, adicionar `if (validacao.errors.length) throw new Error(validacao.errors.join(" "))`.
7. Na UI do bloco "Variações":
   - Ao lado do rótulo "Tamanhos", quando `isAccessory`: `<span className="text-xs text-eclat-grafite/50">(opcional para acessórios — deixe vazio se não houver)</span>`. Quando acessório, permitir digitar tamanhos livres: abaixo dos chips P/M/G/GG, um input igual ao de cor com `placeholder="+ tamanho livre (Enter)"` que faz `setTamanhos([...tamanhos, v])`.
   - Trocar o input livre de cor por um `<select>` com as cores do mapa + opção "Outra…" que revela o input livre atual:

```tsx
<select
  value=""
  onChange={(e) => {
    const c = e.target.value
    if (c && !cores.includes(c)) setCores([...cores, c])
  }}
  className="border border-eclat-pedra/50 rounded-md px-2 py-1 text-xs bg-white"
>
  <option value="">+ cor do mapa</option>
  {coresMapa.filter((c) => !cores.includes(c)).map((c) => <option key={c} value={c}>{c}</option>)}
</select>
```
   (manter o input livre ao lado, com placeholder `"outra cor (Enter)"`).
   - Abaixo do bloco, renderizar erros e avisos:

```tsx
{validacao.errors.map((m) => <p key={m} className="text-xs text-red-700">{m}</p>)}
{validacao.warnings.map((m) => <p key={m} className="text-xs text-amber-700">{m}</p>)}
```
   - Botão "Criar produto" com `disabled={salvando || validacao.errors.length > 0}`.

- [ ] **Step 7: Validar no navegador**

Cockpit → Produtos → Novo produto: sem cor → erro vermelho e botão desabilitado; marcar categoria "Acessórios › Meias" → aviso de tamanho opcional some do bloqueio; cor digitada fora do mapa → aviso âmbar, mas salva. `npx tsc -p apps/cockpit --noEmit` limpo.

- [ ] **Step 8: Commit**

```bash
git add apps/cockpit/vitest.config.ts apps/cockpit/package.json package-lock.json apps/cockpit/lib/catalog-rules.ts apps/cockpit/lib/catalog-rules.test.ts apps/cockpit/app/api/products/create/route.ts apps/cockpit/components/product-form.tsx
git commit -m "feat(cockpit): regras de opções Tamanho/Cor (vestuário vs acessório) com validação na criação + Vitest"
```

---

### Task 7: Cockpit — Vitrine → Cores (mapa de cores)

**Files:**
- Create: `apps/cockpit/app/api/catalog-colors/route.ts`
- Create: `apps/cockpit/components/cores-editor.tsx`
- Modify: `apps/cockpit/lib/medusa.ts` (`medusaListColorValues`)
- Modify: `apps/cockpit/app/(painel)/vitrine/page.tsx`

**Interfaces:**
- `GET /api/catalog-colors` → `{ colors: string[] }` (valores distintos da opção "Cor" em todos os produtos).
- Grava `site_content.cores` no formato da task 2 via `PUT /api/site-content/cores` (rota existente).

- [ ] **Step 1: Listar cores do catálogo**

Em `apps/cockpit/lib/medusa.ts`, adicionar após `medusaListTags`:

```ts
// Valores distintos da opção "Cor" em todos os produtos (para semear o mapa de cores).
export async function medusaListColorValues(): Promise<string[]> {
  const r = await medusaAdmin(`/admin/products?limit=200&fields=options.title,options.values.value`)
  if (!r.ok) throw new Error(`listar cores falhou (HTTP ${r.status})`)
  const { products } = (await r.json()) as {
    products: { options?: { title: string; values?: { value: string }[] }[] }[]
  }
  const set = new Set<string>()
  for (const p of products)
    for (const o of p.options ?? [])
      if (o.title.trim().toLowerCase() === "cor")
        for (const v of o.values ?? []) if (v.value?.trim()) set.add(v.value.trim())
  return [...set].sort((a, b) => a.localeCompare(b, "pt-BR"))
}
```

`apps/cockpit/app/api/catalog-colors/route.ts`:

```ts
import { NextResponse } from "next/server"
import { medusaListColorValues } from "@/lib/medusa"

export async function GET() {
  try {
    return NextResponse.json({ colors: await medusaListColorValues() })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 2: Editor de cores**

`apps/cockpit/components/cores-editor.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"

// Vitrine → Cores. Fonte única de nome canônico + hex + foto do tecido (site_content.cores).
type Entry = { hex: string | null; swatch_url?: string | null }
type Row = { name: string; hex: string; swatch_url: string }

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i

export default function CoresEditor() {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [novo, setNovo] = useState("")

  const carregar = useCallback(async () => {
    const r = await fetch("/api/site-content/cores", { cache: "no-store" })
    const d = (await r.json().catch(() => ({}))) as Record<string, Entry> | { error?: string }
    const map = r.ok && d && !("error" in d) ? (d as Record<string, Entry>) : {}
    setRows(
      Object.entries(map)
        .map(([name, e]) => ({ name, hex: e?.hex ?? "", swatch_url: e?.swatch_url ?? "" }))
        .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    )
    setLoading(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  function upd(i: number, patch: Partial<Row>) {
    setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)))
  }
  function add(name: string) {
    const n = name.trim()
    if (!n || rows.some((r) => r.name.toLowerCase() === n.toLowerCase())) return
    setRows([...rows, { name: n, hex: "", swatch_url: "" }])
  }
  async function importarDoCatalogo() {
    const r = await fetch("/api/catalog-colors", { cache: "no-store" })
    const d = await r.json()
    if (!r.ok) return alert(d.error || "Falha ao ler cores do catálogo")
    const faltantes = (d.colors as string[]).filter((c) => !rows.some((x) => x.name.toLowerCase() === c.toLowerCase()))
    if (!faltantes.length) return alert("Todas as cores do catálogo já estão no mapa.")
    setRows([...rows, ...faltantes.map((name) => ({ name, hex: "", swatch_url: "" }))])
  }
  async function upload(i: number, file: File) {
    const fd = new FormData()
    fd.append("file", file)
    const r = await fetch("/api/site-upload", { method: "POST", body: fd })
    const d = await r.json()
    if (!r.ok) return alert(d.error || "Falha no upload")
    upd(i, { swatch_url: d.url })
  }
  async function salvar() {
    for (const r of rows) {
      if (!r.name.trim()) return alert("Há uma cor sem nome.")
      if (r.hex && !HEX_RE.test(r.hex)) return alert(`Hex inválido em "${r.name}": use #RRGGBB.`)
    }
    const value: Record<string, Entry> = {}
    for (const r of rows) value[r.name.trim()] = { hex: r.hex ? r.hex.toUpperCase() : null, swatch_url: r.swatch_url || null }
    setSaving(true)
    try {
      const res = await fetch("/api/site-content/cores", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      })
      const d = await res.json()
      if (!res.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Cores salvas! A vitrine atualiza em até ~30s.")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "border border-eclat-pedra/50 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando cores…</p>

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-eclat-grafite/60">
        O nome aqui é o nome canônico: escreva-o igual na opção &quot;Cor&quot; de todo produto. O hex vira o círculo
        (swatch) no card, no filtro e na página do produto; a foto do tecido é opcional e substitui o círculo.
      </p>
      <div className="flex flex-col gap-2">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-[1fr_120px_36px_1fr_auto] gap-2 items-center">
            <input value={r.name} onChange={(e) => upd(i, { name: e.target.value })} className={inputCls} placeholder="Nome canônico" />
            <input value={r.hex} onChange={(e) => upd(i, { hex: e.target.value })} className={inputCls} placeholder="#RRGGBB" />
            <input type="color" value={HEX_RE.test(r.hex) && r.hex.length === 7 ? r.hex : "#c9c4bc"} onChange={(e) => upd(i, { hex: e.target.value.toUpperCase() })} className="w-9 h-8 p-0 border-0 bg-transparent" title="Escolher cor" />
            <div className="flex items-center gap-2 text-xs">
              {r.swatch_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.swatch_url} alt="" className="w-8 h-8 rounded-full object-cover border border-eclat-pedra/40" />
              )}
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && upload(i, e.target.files[0])} className="text-xs" />
              {r.swatch_url && <button onClick={() => upd(i, { swatch_url: "" })} className="text-red-700 underline">tirar foto</button>}
            </div>
            <button onClick={() => setRows(rows.filter((_, j) => j !== i))} className="text-eclat-grafite/40 hover:text-red-700 px-1" title="Remover">✕</button>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              add(novo)
              setNovo("")
            }
          }}
          placeholder="+ nova cor (Enter)"
          className={inputCls + " w-44"}
        />
        <button onClick={importarDoCatalogo} className="text-xs text-eclat-dourado underline">importar cores já usadas no catálogo</button>
      </div>
      <button
        onClick={salvar}
        disabled={saving}
        className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar cores"}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Montar na página Vitrine**

Em `apps/cockpit/app/(painel)/vitrine/page.tsx`: `import CoresEditor from "@/components/cores-editor"` e, no JSX principal (dentro do `<div className="flex flex-col gap-8 max-w-2xl">`), **antes** da primeira seção existente, adicionar:

```tsx
<section className={sectionA}>
  <h2 className="font-serif text-xl text-eclat-grafite">Cores (catálogo)</h2>
  <CoresEditor />
</section>
```

- [ ] **Step 4: Validar no navegador**

Vitrine → seção "Cores": clicar "importar cores já usadas no catálogo" → aparecem as cores da Família Blackout; preencher hex (color picker) → Salvar. `GET /api/site-content/cores` devolve o JSON no formato da task 2. `tsc` limpo.

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/lib/medusa.ts apps/cockpit/app/api/catalog-colors/route.ts apps/cockpit/components/cores-editor.tsx "apps/cockpit/app/(painel)/vitrine/page.tsx"
git commit -m "feat(cockpit): Vitrine → Cores — mapa canônico nome/hex/foto do tecido com importação do catálogo"
```

---

### Task 8: Cockpit — Vitrine → Medidas (tabela por categoria)

**Files:**
- Create: `apps/cockpit/components/medidas-editor.tsx`
- Modify: `apps/cockpit/app/(painel)/vitrine/page.tsx`

**Interfaces:**
- Grava `site_content.medidas` no formato da task 3. Lista categorias por `GET /api/taxonomy/categories` (task 5 já devolve `handle` e `parent_id`); a chave é o caminho `mae/filha`.

- [ ] **Step 1: Editor de medidas**

`apps/cockpit/components/medidas-editor.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

// Vitrine → Medidas. Uma tabela por categoria (chave = caminho de handle). Subcategoria
// sem tabela herda a da mãe na vitrine; acessórios podem ficar sem tabela.
type Cat = { id: string; name: string; handle: string; parent_id: string | null; rank: number }
type Table = { columns: string[]; rows: string[][] }

const PADRAO: Record<string, Table> = {
  tops: { columns: ["Busto", "Cintura"], rows: [["P", "82–88 cm", "62–68 cm"], ["M", "88–94 cm", "68–74 cm"], ["G", "94–100 cm", "74–80 cm"], ["GG", "100–108 cm", "80–88 cm"]] },
  shorts: { columns: ["Cintura", "Quadril"], rows: [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]] },
  leggings: { columns: ["Cintura", "Quadril"], rows: [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]] },
  macaquinhos: { columns: ["Busto", "Cintura", "Quadril"], rows: [["P", "82–88 cm", "62–68 cm", "88–94 cm"], ["M", "88–94 cm", "68–74 cm", "94–100 cm"], ["G", "94–100 cm", "74–80 cm", "100–106 cm"], ["GG", "100–108 cm", "80–88 cm", "106–114 cm"]] },
}

export default function MedidasEditor() {
  const [cats, setCats] = useState<Cat[]>([])
  const [map, setMap] = useState<Record<string, Table>>({})
  const [sel, setSel] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const carregar = useCallback(async () => {
    const [c, m] = await Promise.all([
      fetch("/api/taxonomy/categories", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/site-content/medidas", { cache: "no-store" }).then((r) => r.json()).catch(() => ({})),
    ])
    if (Array.isArray(c)) setCats(c)
    setMap(m && typeof m === "object" && !m.error ? m : {})
    setLoading(false)
  }, [])
  useEffect(() => {
    carregar()
  }, [carregar])

  // caminhos "mae/filha" na ordem da árvore
  const caminhos = useMemo(() => {
    const byId = new Map(cats.map((c) => [c.id, c]))
    const path = (c: Cat): string => (c.parent_id && byId.get(c.parent_id) ? `${path(byId.get(c.parent_id)!)}/${c.handle}` : c.handle)
    return [...cats]
      .sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name))
      .map((c) => ({ key: path(c), label: c.parent_id ? `↳ ${c.name}` : c.name, depth: c.parent_id ? 1 : 0 }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [cats])

  useEffect(() => {
    if (!sel && caminhos.length) setSel(caminhos[0].key)
  }, [caminhos, sel])

  const tabela = map[sel]
  function setTabela(t: Table | null) {
    const next = { ...map }
    if (t) next[sel] = t
    else delete next[sel]
    setMap(next)
  }
  function setCol(i: number, v: string) {
    if (!tabela) return
    setTabela({ ...tabela, columns: tabela.columns.map((c, j) => (j === i ? v : c)) })
  }
  function setCell(r: number, c: number, v: string) {
    if (!tabela) return
    setTabela({ ...tabela, rows: tabela.rows.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)) })
  }
  function addCol() {
    if (!tabela) return
    setTabela({ columns: [...tabela.columns, "Medida"], rows: tabela.rows.map((r) => [...r, ""]) })
  }
  function delCol(i: number) {
    if (!tabela) return
    setTabela({ columns: tabela.columns.filter((_, j) => j !== i), rows: tabela.rows.map((r) => r.filter((_, j) => j !== i + 1)) })
  }
  function addRow() {
    if (!tabela) return
    setTabela({ ...tabela, rows: [...tabela.rows, ["", ...tabela.columns.map(() => "")]] })
  }
  function delRow(i: number) {
    if (!tabela) return
    setTabela({ ...tabela, rows: tabela.rows.filter((_, j) => j !== i) })
  }
  function criar() {
    setTabela(PADRAO[sel] ?? { columns: ["Cintura", "Quadril"], rows: [["P", "", ""], ["M", "", ""], ["G", "", ""], ["GG", "", ""]] })
  }
  async function salvar() {
    setSaving(true)
    try {
      const r = await fetch("/api/site-content/medidas", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(map),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha ao salvar")
      alert("Medidas salvas! A vitrine atualiza em até ~30s.")
    } catch (e) {
      alert((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const inputCls =
    "w-full border border-eclat-pedra/50 rounded-md px-2 py-1 text-sm bg-white focus:outline-none focus:border-eclat-dourado"
  if (loading) return <p className="text-sm text-eclat-grafite/50">Carregando medidas…</p>

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <label className="text-xs uppercase tracking-wider text-eclat-grafite/60">Categoria</label>
        <select value={sel} onChange={(e) => setSel(e.target.value)} className={inputCls + " max-w-xs"}>
          {caminhos.map((c) => (
            <option key={c.key} value={c.key}>{c.depth ? "   " : ""}{c.label} ({c.key})</option>
          ))}
        </select>
        {map[sel] ? (
          <span className="text-xs text-green-700">tem tabela própria</span>
        ) : (
          <span className="text-xs text-eclat-grafite/50">sem tabela (herda da mãe, se houver)</span>
        )}
      </div>

      {!tabela ? (
        <button onClick={criar} className="self-start text-xs text-eclat-dourado underline">+ criar tabela para esta categoria</button>
      ) : (
        <div className="flex flex-col gap-2">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs uppercase tracking-wider text-eclat-grafite/60 px-1">Tamanho</th>
                {tabela.columns.map((c, i) => (
                  <th key={i} className="px-1">
                    <div className="flex items-center gap-1">
                      <input value={c} onChange={(e) => setCol(i, e.target.value)} className={inputCls} />
                      <button onClick={() => delCol(i)} className="text-eclat-grafite/40 hover:text-red-700" title="Remover coluna">✕</button>
                    </div>
                  </th>
                ))}
                <th><button onClick={addCol} className="text-xs text-eclat-dourado underline">+ coluna</button></th>
              </tr>
            </thead>
            <tbody>
              {tabela.rows.map((row, r) => (
                <tr key={r}>
                  {row.map((cell, c) => (
                    <td key={c} className="px-1 py-1">
                      <input value={cell} onChange={(e) => setCell(r, c, e.target.value)} className={inputCls} placeholder={c === 0 ? "P" : "62–68 cm"} />
                    </td>
                  ))}
                  <td><button onClick={() => delRow(r)} className="text-eclat-grafite/40 hover:text-red-700" title="Remover linha">✕</button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="flex gap-3">
            <button onClick={addRow} className="text-xs text-eclat-dourado underline">+ linha (tamanho)</button>
            <button onClick={() => setTabela(null)} className="text-xs text-red-700 underline">remover tabela desta categoria</button>
          </div>
        </div>
      )}

      <button
        onClick={salvar}
        disabled={saving}
        className="self-start bg-eclat-grafite text-eclat-luz uppercase tracking-widest text-xs px-5 py-2 rounded-md hover:bg-eclat-dourado hover:text-eclat-grafite transition-colors disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar medidas"}
      </button>
    </div>
  )
}
```

- [ ] **Step 2: Montar na página Vitrine**

Em `apps/cockpit/app/(painel)/vitrine/page.tsx`: `import MedidasEditor from "@/components/medidas-editor"` e, logo após a seção "Cores (catálogo)" da task 7:

```tsx
<section className={sectionA}>
  <h2 className="font-serif text-xl text-eclat-grafite">Guia de medidas por categoria</h2>
  <MedidasEditor />
</section>
```

- [ ] **Step 3: Validar no navegador**

Vitrine → Medidas: escolher `leggings` → "criar tabela" → aparece Cintura/Quadril com P–GG → Salvar. Escolher `masculino/bermudas` → "sem tabela (herda da mãe)". `GET /api/site-content/medidas` no formato da task 3. `tsc` limpo.

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/components/medidas-editor.tsx "apps/cockpit/app/(painel)/vitrine/page.tsx"
git commit -m "feat(cockpit): Vitrine → Medidas — tabela de medidas editável por categoria com herança da mãe"
```

---

### Task 9: Seed dos padrões de `cores` e `medidas`

**Files:**
- Create: `scripts/seed-site-content-catalogo.py`

**Interfaces:**
- Lê cores do Medusa (`/admin/products` → opção Cor) e grava em `site_content` (Supabase REST, service role) **sem sobrescrever** entradas já existentes. Semeia `medidas` com as 4 tabelas femininas padrão só para chaves ausentes.

- [ ] **Step 1: Escrever o script**

`scripts/seed-site-content-catalogo.py`:

```python
"""
Semeia site_content.cores (nomes vindos do catálogo, hex vazio p/ preencher no Cockpit)
e site_content.medidas (tabelas padrão femininas) SEM sobrescrever o que já existe.
Padrão = simulação; grave com --apply.
Requisitos: pip install requests
Credenciais: apps/cockpit/.env.local -> MEDUSA_ADMIN_EMAIL/PASSWORD, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
"""
import json, os, sys

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
APPLY = "--apply" in sys.argv

TAB_CQ = {"columns": ["Cintura", "Quadril"], "rows": [["P", "62–68 cm", "88–94 cm"], ["M", "68–74 cm", "94–100 cm"], ["G", "74–80 cm", "100–106 cm"], ["GG", "80–88 cm", "106–114 cm"]]}
MEDIDAS_PADRAO = {
    "tops": {"columns": ["Busto", "Cintura"], "rows": [["P", "82–88 cm", "62–68 cm"], ["M", "88–94 cm", "68–74 cm"], ["G", "94–100 cm", "74–80 cm"], ["GG", "100–108 cm", "80–88 cm"]]},
    "shorts": TAB_CQ,
    "leggings": TAB_CQ,
    "macaquinhos": {"columns": ["Busto", "Cintura", "Quadril"], "rows": [["P", "82–88 cm", "62–68 cm", "88–94 cm"], ["M", "88–94 cm", "68–74 cm", "94–100 cm"], ["G", "94–100 cm", "74–80 cm", "100–106 cm"], ["GG", "100–108 cm", "80–88 cm", "106–114 cm"]]},
}

def env_cockpit():
    env = {}
    with open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def sb_get(env, key):
    r = requests.get(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?key=eq." + key + "&select=value",
                     headers={"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"]}, timeout=30)
    r.raise_for_status()
    rows = r.json()
    return rows[0]["value"] if rows else {}

def sb_put(env, key, value):
    r = requests.post(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?on_conflict=key",
                      headers={"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"],
                               "Content-Type": "application/json", "Prefer": "resolution=merge-duplicates,return=minimal"},
                      json={"key": key, "value": value}, timeout=30)
    assert r.ok, "gravar %s falhou: %s" % (key, r.text)

def cores_do_catalogo(env):
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok, "login admin falhou"
    H = {"Authorization": "Bearer " + r.json()["token"]}
    r = requests.get(BASE + "/admin/products?limit=200&fields=options.title,options.values.value", headers=H, timeout=30)
    r.raise_for_status()
    cores = set()
    for p in r.json()["products"]:
        for o in p.get("options") or []:
            if (o.get("title") or "").strip().lower() == "cor":
                for v in o.get("values") or []:
                    if (v.get("value") or "").strip(): cores.add(v["value"].strip())
    return sorted(cores)

def main():
    env = env_cockpit()
    print("modo:", "APLICAR" if APPLY else "SIMULAÇÃO (use --apply para gravar)")

    cores = sb_get(env, "cores") or {}
    novas = [c for c in cores_do_catalogo(env) if c.lower() not in {k.lower() for k in cores}]
    for c in novas: cores[c] = {"hex": None, "swatch_url": None}
    print("cores: %d existentes, %d novas: %s" % (len(cores) - len(novas), len(novas), ", ".join(novas) or "-"))

    medidas = sb_get(env, "medidas") or {}
    faltam = [k for k in MEDIDAS_PADRAO if k not in medidas]
    for k in faltam: medidas[k] = MEDIDAS_PADRAO[k]
    print("medidas: chaves existentes %s; semeando %s" % (sorted(set(medidas) - set(faltam)) or "-", faltam or "-"))

    if APPLY:
        if novas: sb_put(env, "cores", cores)
        if faltam: sb_put(env, "medidas", medidas)
        print("gravado.")
    else:
        print(json.dumps({"cores": cores, "medidas": list(medidas)}, ensure_ascii=False, indent=1))

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Simular, aplicar, conferir**

```bash
python scripts/seed-site-content-catalogo.py
python scripts/seed-site-content-catalogo.py --apply
```

Esperado: as cores da Família Blackout entram com `hex: null`; as 4 tabelas femininas entram se ausentes. No Cockpit → Vitrine → Cores, as cores aparecem para receber o hex; → Medidas, `leggings` mostra "tem tabela própria".

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-site-content-catalogo.py
git commit -m "feat(catalogo): seed não destrutivo de cores (do catálogo) e medidas padrão em site_content"
```

---

### Task 10: Cockpit — "Fotos por cor" no editor de produto

**Files:**
- Create: `apps/cockpit/lib/color-images.ts`
- Create: `apps/cockpit/lib/color-images.test.ts`
- Create: `apps/cockpit/app/api/products/[id]/images/route.ts`
- Create: `apps/cockpit/app/api/products/[id]/images/[imageId]/route.ts`
- Create: `apps/cockpit/components/color-images.tsx`
- Modify: `apps/cockpit/lib/medusa.ts`
- Modify: `apps/cockpit/components/product-form.tsx`

**Interfaces:**
- Puro (`lib/color-images.ts`):
  ```ts
  export type RawImage = { id: string; url: string }
  export type RawVariant = { id: string; options?: { option_id: string; value: string }[]; images?: { id: string }[] }
  export type RawProductImages = { thumbnail: string | null; images: RawImage[]; options: { id: string; title: string }[]; variants: RawVariant[] }
  export type ColorGroup = { color: string; variant_ids: string[]; images: RawImage[] }
  export type GroupedImages = { thumbnail: string | null; groups: ColorGroup[]; unassigned: RawImage[] }
  export function groupImagesByColor(p: RawProductImages): GroupedImages
  ```
  Regra: imagem pertence à cor se está vinculada a **todas** as variantes daquela cor; senão fica em `unassigned`.
- Medusa (`lib/medusa.ts`):
  ```ts
  medusaGetProductImages(productId): Promise<RawProductImages>
  medusaAddProductImages(productId, urls: string[]): Promise<RawImage[]>   // devolve só as novas
  medusaRemoveProductImage(productId, imageId): Promise<void>
  medusaSetImageVariants(productId, imageId, add: string[], remove: string[]): Promise<void>
  medusaSetThumbnail(productId, url: string | null): Promise<void>
  ```
- Rotas:
  - `GET /api/products/:id/images` → `GroupedImages`
  - `POST /api/products/:id/images` body `{ urls: string[], color?: string }` → adiciona e, se `color`, vincula às variantes da cor. Devolve `GroupedImages`.
  - `PATCH /api/products/:id/images/:imageId` body `{ color: string | null }` → vincula à cor (remove de outras) ou desvincula de tudo (`null`). Devolve `GroupedImages`.
  - `DELETE /api/products/:id/images/:imageId` → remove a imagem do produto. Devolve `GroupedImages`.
  - `POST /api/products/:id/images` com body `{ thumbnail: string }` → define a capa.

- [ ] **Step 1: Teste do agrupamento (falha)**

`apps/cockpit/lib/color-images.test.ts`:

```ts
import { describe, expect, it } from "vitest"
import { groupImagesByColor } from "./color-images"

const P = {
  thumbnail: "u1",
  images: [{ id: "i1", url: "u1" }, { id: "i2", url: "u2" }, { id: "i3", url: "u3" }, { id: "i4", url: "u4" }],
  options: [{ id: "o_t", title: "Tamanho" }, { id: "o_c", title: "Cor" }],
  variants: [
    { id: "vP", options: [{ option_id: "o_t", value: "P" }, { option_id: "o_c", value: "Licor" }], images: [{ id: "i1" }, { id: "i3" }] },
    { id: "vM", options: [{ option_id: "o_t", value: "M" }, { option_id: "o_c", value: "Licor" }], images: [{ id: "i1" }] },
    { id: "vVP", options: [{ option_id: "o_t", value: "P" }, { option_id: "o_c", value: "Verde" }], images: [{ id: "i2" }] },
  ],
}

describe("groupImagesByColor", () => {
  const g = groupImagesByColor(P)
  it("uma entrada por cor, na ordem de aparição, com as variantes da cor", () => {
    expect(g.groups.map((x) => x.color)).toEqual(["Licor", "Verde"])
    expect(g.groups[0].variant_ids).toEqual(["vP", "vM"])
  })
  it("imagem só entra na cor se está em TODAS as variantes da cor", () => {
    expect(g.groups[0].images.map((i) => i.id)).toEqual(["i1"]) // i3 só em vP
    expect(g.groups[1].images.map((i) => i.id)).toEqual(["i2"])
  })
  it("imagens sem cor completa ficam em unassigned (ordem do produto)", () => {
    expect(g.unassigned.map((i) => i.id)).toEqual(["i3", "i4"])
  })
  it("produto sem opção Cor: tudo unassigned, sem grupos", () => {
    const r = groupImagesByColor({ ...P, options: [{ id: "o_t", title: "Tamanho" }] })
    expect(r.groups).toEqual([])
    expect(r.unassigned.length).toBe(4)
  })
  it("repassa a capa", () => {
    expect(g.thumbnail).toBe("u1")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar**

`npm test --workspace=apps/cockpit` → FAIL: `Cannot find module './color-images'`.

- [ ] **Step 3: Implementar o agrupamento**

`apps/cockpit/lib/color-images.ts`:

```ts
// Agrupa as imagens de um produto por COR (spec 4.5): uma imagem pertence à cor
// quando está vinculada a todas as variantes de tamanho daquela cor. Puro.

export type RawImage = { id: string; url: string }
export type RawVariant = {
  id: string
  options?: { option_id: string; value: string }[]
  images?: { id: string }[]
}
export type RawProductImages = {
  thumbnail: string | null
  images: RawImage[]
  options: { id: string; title: string }[]
  variants: RawVariant[]
}
export type ColorGroup = { color: string; variant_ids: string[]; images: RawImage[] }
export type GroupedImages = { thumbnail: string | null; groups: ColorGroup[]; unassigned: RawImage[] }

export function groupImagesByColor(p: RawProductImages): GroupedImages {
  const corOpt = p.options.find((o) => o.title.trim().toLowerCase() === "cor")
  if (!corOpt) return { thumbnail: p.thumbnail, groups: [], unassigned: [...p.images] }

  const byColor = new Map<string, RawVariant[]>()
  for (const v of p.variants) {
    const cor = (v.options ?? []).find((o) => o.option_id === corOpt.id)?.value
    if (!cor) continue
    if (!byColor.has(cor)) byColor.set(cor, [])
    byColor.get(cor)!.push(v)
  }

  const assigned = new Set<string>()
  const groups: ColorGroup[] = []
  for (const [color, vs] of byColor) {
    const images = p.images.filter((img) => vs.every((v) => (v.images ?? []).some((i) => i.id === img.id)))
    images.forEach((i) => assigned.add(i.id))
    groups.push({ color, variant_ids: vs.map((v) => v.id), images })
  }
  return { thumbnail: p.thumbnail, groups, unassigned: p.images.filter((i) => !assigned.has(i.id)) }
}
```

- [ ] **Step 4: Rodar e ver passar**

`npm test --workspace=apps/cockpit` → PASS.

- [ ] **Step 5: Funções Medusa**

Adicionar ao fim de `apps/cockpit/lib/medusa.ts`:

```ts
// ---- Fotos por cor (spec 4.5) ----
import type { RawImage, RawProductImages } from "./color-images"

export async function medusaGetProductImages(productId: string): Promise<RawProductImages> {
  const r = await medusaAdmin(
    `/admin/products/${productId}?fields=thumbnail,images.id,images.url,options.id,options.title,variants.id,variants.options.option_id,variants.options.value,variants.images.id`
  )
  if (!r.ok) throw new Error(`buscar imagens falhou (HTTP ${r.status})`)
  const { product } = (await r.json()) as { product: RawProductImages }
  return {
    thumbnail: product.thumbnail ?? null,
    images: product.images ?? [],
    options: product.options ?? [],
    variants: product.variants ?? [],
  }
}

// O Medusa substitui a lista inteira: reenviar as existentes (por id) + as novas (por url).
export async function medusaAddProductImages(productId: string, urls: string[]): Promise<RawImage[]> {
  const antes = await medusaGetProductImages(productId)
  const r = await medusaAdmin(`/admin/products/${productId}`, {
    method: "POST",
    body: JSON.stringify({
      images: [...antes.images.map((i) => ({ id: i.id, url: i.url })), ...urls.map((url) => ({ url }))],
    }),
  })
  if (!r.ok) throw new Error(`adicionar imagens falhou (HTTP ${r.status}): ${await r.text()}`)
  const depois = await medusaGetProductImages(productId)
  const ids = new Set(antes.images.map((i) => i.id))
  return depois.images.filter((i) => !ids.has(i.id))
}

export async function medusaRemoveProductImage(productId: string, imageId: string): Promise<void> {
  const antes = await medusaGetProductImages(productId)
  const r = await medusaAdmin(`/admin/products/${productId}`, {
    method: "POST",
    body: JSON.stringify({
      images: antes.images.filter((i) => i.id !== imageId).map((i) => ({ id: i.id, url: i.url })),
    }),
  })
  if (!r.ok) throw new Error(`remover imagem falhou (HTTP ${r.status}): ${await r.text()}`)
}

// Vincula/desvincula UMA imagem a variantes (endpoint nativo desde Medusa 2.11.2).
export async function medusaSetImageVariants(
  productId: string,
  imageId: string,
  add: string[],
  remove: string[]
): Promise<void> {
  if (!add.length && !remove.length) return
  const r = await medusaAdmin(`/admin/products/${productId}/images/${imageId}/variants/batch`, {
    method: "POST",
    body: JSON.stringify({ add, remove }),
  })
  if (!r.ok) throw new Error(`vincular imagem falhou (HTTP ${r.status}): ${await r.text()}`)
}

export async function medusaSetThumbnail(productId: string, url: string | null): Promise<void> {
  const r = await medusaAdmin(`/admin/products/${productId}`, {
    method: "POST",
    body: JSON.stringify({ thumbnail: url }),
  })
  if (!r.ok) throw new Error(`definir capa falhou (HTTP ${r.status}): ${await r.text()}`)
}
```

(Mover o `import type` para o topo do arquivo, junto dos outros imports, para respeitar o lint.)

- [ ] **Step 6: Rotas**

`apps/cockpit/app/api/products/[id]/images/route.ts`:

```ts
import { NextResponse } from "next/server"
import {
  medusaAddProductImages,
  medusaGetProductImages,
  medusaSetImageVariants,
  medusaSetThumbnail,
} from "@/lib/medusa"
import { groupImagesByColor } from "@/lib/color-images"

type Params = { params: Promise<{ id: string }> }

async function grouped(id: string) {
  return groupImagesByColor(await medusaGetProductImages(id))
}

// GET: imagens agrupadas por cor.
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params
  try {
    return NextResponse.json(await grouped(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

// POST { urls, color? }: adiciona imagens e vincula à cor. POST { thumbnail }: define a capa.
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const body = (await req.json()) as { urls?: string[]; color?: string; thumbnail?: string | null }
  try {
    if ("thumbnail" in body) {
      await medusaSetThumbnail(id, body.thumbnail ?? null)
      return NextResponse.json(await grouped(id))
    }
    const urls = (body.urls ?? []).filter((u) => typeof u === "string" && u.trim())
    if (!urls.length) return NextResponse.json({ error: "urls obrigatório" }, { status: 400 })
    const novas = await medusaAddProductImages(id, urls)
    if (body.color) {
      const g = await grouped(id)
      const grupo = g.groups.find((x) => x.color === body.color)
      if (!grupo) return NextResponse.json({ error: `cor "${body.color}" não existe neste produto` }, { status: 400 })
      for (const img of novas) await medusaSetImageVariants(id, img.id, grupo.variant_ids, [])
    }
    return NextResponse.json(await grouped(id))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

`apps/cockpit/app/api/products/[id]/images/[imageId]/route.ts`:

```ts
import { NextResponse } from "next/server"
import { medusaGetProductImages, medusaRemoveProductImage, medusaSetImageVariants } from "@/lib/medusa"
import { groupImagesByColor } from "@/lib/color-images"

type Params = { params: Promise<{ id: string; imageId: string }> }

// PATCH { color: string | null }: move a imagem para a cor (ou tira de todas).
export async function PATCH(req: Request, { params }: Params) {
  const { id, imageId } = await params
  const { color } = (await req.json()) as { color: string | null }
  try {
    const raw = await medusaGetProductImages(id)
    const g = groupImagesByColor(raw)
    const todasVariantes = raw.variants.map((v) => v.id)
    const alvo = color ? g.groups.find((x) => x.color === color) : null
    if (color && !alvo) return NextResponse.json({ error: `cor "${color}" não existe neste produto` }, { status: 400 })
    const add = alvo ? alvo.variant_ids : []
    const remove = todasVariantes.filter((vid) => !add.includes(vid))
    await medusaSetImageVariants(id, imageId, add, remove)
    return NextResponse.json(groupImagesByColor(await medusaGetProductImages(id)))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id, imageId } = await params
  try {
    await medusaRemoveProductImage(id, imageId)
    return NextResponse.json(groupImagesByColor(await medusaGetProductImages(id)))
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 })
  }
}
```

- [ ] **Step 7: Componente "Fotos por cor"**

`apps/cockpit/components/color-images.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useState } from "react"
import type { GroupedImages } from "@/lib/color-images"

// Editor de fotos por COR do produto (spec 4.5). Cada cor lista as fotos vinculadas a
// todas as suas variantes; "Sem cor" são fotos do produto ainda não atribuídas.
export default function ColorImages({ productId }: { productId: string }) {
  const [data, setData] = useState<GroupedImages | null>(null)
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    const r = await fetch(`/api/products/${productId}/images`, { cache: "no-store" })
    const d = await r.json()
    if (!r.ok) return setErro(d.error || "Falha ao carregar fotos")
    setData(d)
  }, [productId])
  useEffect(() => {
    carregar()
  }, [carregar])

  async function call(url: string, init: RequestInit) {
    setBusy(true)
    setErro(null)
    try {
      const r = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || "Falha na operação")
      setData(d)
    } catch (e) {
      setErro((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  async function upload(files: FileList, color: string | null) {
    setBusy(true)
    try {
      const urls: string[] = []
      for (const file of Array.from(files)) {
        const fd = new FormData()
        fd.append("file", file)
        const r = await fetch("/api/uploads", { method: "POST", body: fd })
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || "Falha no upload")
        urls.push(d.url)
      }
      await call(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify({ urls, color: color ?? undefined }) })
    } catch (e) {
      setErro((e as Error).message)
      setBusy(false)
    }
  }
  const mover = (imageId: string, color: string | null) =>
    call(`/api/products/${productId}/images/${imageId}`, { method: "PATCH", body: JSON.stringify({ color }) })
  const remover = (imageId: string) =>
    confirm("Remover esta foto do produto?") && call(`/api/products/${productId}/images/${imageId}`, { method: "DELETE" })
  const capa = (url: string) => call(`/api/products/${productId}/images`, { method: "POST", body: JSON.stringify({ thumbnail: url }) })

  if (erro && !data) return <p className="text-xs text-red-700">{erro}</p>
  if (!data) return <p className="text-xs text-eclat-grafite/50">Carregando fotos…</p>

  const cores = data.groups.map((g) => g.color)
  const Bloco = ({ titulo, color, images }: { titulo: string; color: string | null; images: { id: string; url: string }[] }) => (
    <div className="border border-eclat-pedra/40 rounded-md p-3 bg-white flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">{titulo} <span className="text-xs text-eclat-grafite/40">({images.length})</span></span>
        <label className="text-xs text-eclat-dourado underline cursor-pointer">
          + fotos
          <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files?.length && upload(e.target.files, color)} />
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        {images.map((img) => (
          <div key={img.id} className="w-24 flex flex-col gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" className={`w-24 h-24 object-cover rounded border ${data.thumbnail === img.url ? "border-eclat-dourado ring-2 ring-eclat-dourado/40" : "border-eclat-pedra/40"}`} />
            <select value={color ?? ""} onChange={(e) => mover(img.id, e.target.value || null)} className="text-[11px] border border-eclat-pedra/50 rounded px-1 py-0.5 bg-white">
              <option value="">Sem cor</option>
              {cores.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex justify-between text-[11px]">
              <button onClick={() => capa(img.url)} className="underline" title="Usar como capa do produto">{data.thumbnail === img.url ? "capa ✓" : "capa"}</button>
              <button onClick={() => remover(img.id)} className="text-red-700 underline">remover</button>
            </div>
          </div>
        ))}
        {!images.length && <p className="text-xs text-eclat-grafite/40">Nenhuma foto.</p>}
      </div>
    </div>
  )

  return (
    <div className={`flex flex-col gap-3 ${busy ? "opacity-60 pointer-events-none" : ""}`}>
      {erro && <p className="text-xs text-red-700">{erro}</p>}
      {!cores.length && <p className="text-xs text-amber-700">Este produto não tem a opção &quot;Cor&quot;; as fotos ficam sem agrupamento.</p>}
      {data.groups.map((g) => <Bloco key={g.color} titulo={g.color} color={g.color} images={g.images} />)}
      <Bloco titulo="Sem cor" color={null} images={data.unassigned} />
      <p className="text-xs text-eclat-grafite/50">
        A vitrine mostra as fotos da cor escolhida; a capa é a foto do card. Foto em &quot;Sem cor&quot; aparece em todas as cores.
      </p>
    </div>
  )
}
```

- [ ] **Step 8: Abrir a partir do editor de produto**

Em `apps/cockpit/components/product-form.tsx`: `import ColorImages from "@/components/color-images"` e, no modo `edit`, logo após o bloco "Imagem (capa)", renderizar:

```tsx
{mode === "edit" && productId && (
  <div>
    <label className={labelCls}>Fotos por cor</label>
    <ColorImages productId={productId} />
  </div>
)}
```

(O upload de "capa" antigo continua funcionando; a capa definida no bloco novo aparece refletida ao reabrir.)

- [ ] **Step 9: Validar no navegador**

Produtos → editar "Legging Vértice" → "Fotos por cor": blocos "Verde Exército", "Licor", … e "Sem cor" (com os renders atuais). Subir uma foto em "Licor" → aparece no bloco; trocar o select de uma foto para "Sem cor" → muda de bloco; "capa" marca a miniatura. Conferir na vitrine (dev, backend produção): `/br/products/legging-vertice?v_id=<variante Licor>` mostra só as fotos de Licor + as sem cor? — **não**: a PDP atual filtra por `variant.images` e, se a variante tem imagens, mostra só elas. Fotos "Sem cor" só aparecem quando a variante não tem nenhuma. Registrar isso na doc (task 12) e manter: é o comportamento da spec ("todas as variantes de uma cor apontam para o mesmo conjunto").

- [ ] **Step 10: Commit**

```bash
git add apps/cockpit/lib/color-images.ts apps/cockpit/lib/color-images.test.ts apps/cockpit/lib/medusa.ts "apps/cockpit/app/api/products/[id]/images/route.ts" "apps/cockpit/app/api/products/[id]/images/[imageId]/route.ts" apps/cockpit/components/color-images.tsx apps/cockpit/components/product-form.tsx
git commit -m "feat(cockpit): fotos por cor — agrupamento puro + vínculo imagem↔variantes via Admin API + editor no produto"
```

---

### Task 11: Cockpit — campo "Ordem em Destaques" (`destaque_rank`) no produto

**Files:**
- Modify: `apps/cockpit/components/product-form.tsx`

**Interfaces:**
- Grava `product.metadata.destaque_rank` como string numérica (ex.: `"10"`). Ausente = sem destaque. Consumido pela fase 2 (ordenação "Destaques").

- [ ] **Step 1: Campo dedicado, separado da lista livre de metadata**

Em `product-form.tsx`:

1. Estado: `const [destaqueRank, setDestaqueRank] = useState("")`.
2. No carregamento (modo edit), após montar `entries` do metadata:

```ts
const dr = entries.find(([k]) => k === "destaque_rank")
setDestaqueRank(dr ? String(dr[1]) : "")
const semDestaque = entries.filter(([k]) => k !== "destaque_rank")
setMeta(semDestaque.length ? semDestaque.map(([k, v]) => ({ k, v: String(v) })) : [{ k: "", v: "" }])
```
   (substituindo a linha atual que faz `setMeta(entries...)`).
3. Em `metadataObj()`, após o loop: `if (destaqueRank.trim() !== "") o.destaque_rank = String(Math.round(Number(destaqueRank)))` e, se `destaqueRank` estiver vazio, `delete o.destaque_rank`.
4. Em `salvar()`, antes de montar o body: `if (destaqueRank.trim() !== "" && !(Number(destaqueRank) >= 0)) return setErro("Ordem em Destaques deve ser um número ≥ 0.")`.
5. UI, logo acima do bloco "Ficha técnica (metadata)":

```tsx
<div>
  <label className={labelCls}>Ordem em &quot;Destaques&quot; (menor aparece primeiro; vazio = fora dos destaques)</label>
  <input value={destaqueRank} onChange={(e) => setDestaqueRank(e.target.value)} inputMode="numeric" className={inputCls + " max-w-[160px]"} />
</div>
```

- [ ] **Step 2: Validar**

Editar um produto → definir 5 → Salvar → reabrir: campo mostra 5 e a lista de metadata **não** mostra `destaque_rank` duplicado. Limpar → Salvar → reabrir: vazio. `tsc` limpo.

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/components/product-form.tsx
git commit -m "feat(cockpit): campo Ordem em Destaques (metadata.destaque_rank) no editor de produto"
```

---

### Task 12: Script de verificação do catálogo + documentação

**Files:**
- Create: `scripts/check-catalog-options.py`
- Modify: `architecture/catalog.md`
- Modify: `progress.md`

- [ ] **Step 1: Script de auditoria**

`scripts/check-catalog-options.py`:

```python
"""
Audita o catálogo contra a spec 4.2/4.5: opções Tamanho/Cor, tamanhos P/M/G/GG em vestuário,
cores fora do mapa (site_content.cores), fotos por cor ausentes. Só lê. Saída: relatório.
Requisitos: pip install requests · Credenciais: apps/cockpit/.env.local
"""
import os, sys, unicodedata

try:
    import requests
except ImportError:
    print("Rode antes: pip install requests"); sys.exit(1)

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.environ.get("MEDUSA_URL", "https://endearing-enthusiasm-production-775b.up.railway.app")
TAM = {"P", "M", "G", "GG"}

def norm(s):
    return "".join(c for c in unicodedata.normalize("NFD", s or "") if unicodedata.category(c) != "Mn").lower().strip()

def env_cockpit():
    env = {}
    with open(os.path.join(RAIZ, "apps", "cockpit", ".env.local"), encoding="utf-8") as f:
        for line in f:
            if "=" in line and not line.strip().startswith("#"):
                k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def main():
    env = env_cockpit()
    r = requests.post(BASE + "/auth/user/emailpass", json={"email": env["MEDUSA_ADMIN_EMAIL"], "password": env["MEDUSA_ADMIN_PASSWORD"]}, timeout=30)
    assert r.ok, "login admin falhou"
    H = {"Authorization": "Bearer " + r.json()["token"]}

    sbh = {"apikey": env["SUPABASE_SERVICE_ROLE_KEY"], "Authorization": "Bearer " + env["SUPABASE_SERVICE_ROLE_KEY"]}
    rr = requests.get(env["NEXT_PUBLIC_SUPABASE_URL"] + "/rest/v1/site_content?key=eq.cores&select=value", headers=sbh, timeout=30)
    cores_mapa = {norm(k) for k in ((rr.json() or [{}])[0].get("value") or {})} if rr.ok and rr.json() else set()

    fields = "id,title,handle,status,categories.handle,categories.parent_category.handle,options.id,options.title,options.values.value,variants.id,variants.options.option_id,variants.options.value,variants.images.id"
    r = requests.get(BASE + "/admin/products?limit=200&fields=" + fields, headers=H, timeout=60)
    r.raise_for_status()
    problemas = 0
    for p in r.json()["products"]:
        if p.get("status") != "published": continue
        cats = []
        for c in p.get("categories") or []:
            h = c.get("handle") or ""
            pai = (c.get("parent_category") or {}).get("handle")
            cats.append((pai + "/" + h) if pai else h)
        acessorio = bool(cats) and all(c.split("/")[0] == "acessorios" for c in cats)
        opts = {norm(o["title"]): o for o in (p.get("options") or [])}
        erros = []
        if "cor" not in opts: erros.append("sem opção Cor")
        if not acessorio and "tamanho" not in opts: erros.append("vestuário sem opção Tamanho")
        for t in opts:
            if t not in ("cor", "tamanho"): erros.append("opção não permitida: %s" % opts[t]["title"])
        if not acessorio and "tamanho" in opts:
            ruins = [v["value"] for v in opts["tamanho"].get("values") or [] if v["value"] not in TAM]
            if ruins: erros.append("tamanhos fora do padrão: %s" % ", ".join(ruins))
        if "cor" in opts:
            fora = [v["value"] for v in opts["cor"].get("values") or [] if norm(v["value"]) not in cores_mapa]
            if fora: erros.append("cores fora do mapa: %s" % ", ".join(fora))
            cor_id = opts["cor"]["id"]
            sem_foto = set()
            for v in p.get("variants") or []:
                cor = next((o["value"] for o in v.get("options") or [] if o["option_id"] == cor_id), None)
                if cor and not (v.get("images") or []): sem_foto.add(cor)
            if sem_foto: erros.append("sem foto por cor: %s" % ", ".join(sorted(sem_foto)))
        if not cats: erros.append("sem categoria")
        if erros:
            problemas += 1
            print("✗ %s (%s) [%s]" % (p["title"], p["handle"], ", ".join(cats) or "-"))
            for e in erros: print("    - " + e)
        else:
            print("✓ %s" % p["title"])
    print("\n%d produto(s) com pendências." % problemas)
    sys.exit(1 if problemas else 0)

if __name__ == "__main__":
    main()
```

Rodar: `python scripts/check-catalog-options.py`. Esperado hoje: os 8 produtos da Família Blackout com "sem foto por cor" (fotos ainda pendentes) e, se o hex não foi preenchido, nada de "cores fora do mapa" (o seed da task 9 já colocou os nomes). Qualquer "opção não permitida" ou "tamanhos fora do padrão" precisa ser corrigido no Cockpit antes do D0.

- [ ] **Step 2: Documentar em `architecture/catalog.md`**

Adicionar ao fim do arquivo:

```markdown
## Navegação por tipo de peça — dados (Fase 1, 2026-09)
- Árvore de categorias (handles fixos): tops · shorts · leggings · macaquinhos · conjuntos · acessorios{oculos,meias} · masculino{bermudas,camisetas-regatas}. Nome exibido é livre; handle NÃO muda (URL/feed/sitemap). Ordem = `rank`. Capa/descrição em `metadata.image_url` / `metadata.descricao_curta` (Cockpit → Categorias → editar). Script idempotente: `scripts/setup-categorias.py --apply`.
- Opções de variante: vestuário = `Tamanho` (P/M/G/GG) + `Cor`; acessórios = `Cor` (+ `Tamanho` livre, opcional). Regra em `apps/cockpit/lib/catalog-rules.ts`; a rota `/api/products/create` bloqueia erro (400) e devolve `warnings`. Auditoria: `scripts/check-catalog-options.py`.
- Mapa de cores: `site_content.cores` = `{ "<nome canônico>": { hex, swatch_url } }` (Cockpit → Vitrine → Cores). Vitrine: `lib/util/colors.ts` (`resolveColor`, fallback #C9C4BC) + `lib/data/colors.ts`.
- Guia de medidas: `site_content.medidas` = `{ "<handle ou mae/filha>": { columns, rows } }` (Cockpit → Vitrine → Medidas). Vitrine: `lib/util/measurements.ts` (`pickMeasurements` herda da mãe) + `lib/data/measurements.ts`. Seed: `scripts/seed-site-content-catalogo.py --apply` (não sobrescreve).
- Fotos por cor: vínculo nativo imagem↔variante (`POST /admin/products/{id}/images/{image_id}/variants/batch`, Medusa ≥ 2.11.2). Regra: uma foto pertence à cor quando está em TODAS as variantes da cor (`apps/cockpit/lib/color-images.ts`). Na PDP, variante com imagens mostra só as suas; sem imagens, cai nas fotos do produto ("Sem cor").
- Disponibilidade/novidade (fonte única p/ card, filtros e PDP): `apps/storefront/src/lib/util/availability.ts` — disponível = não gerencia estoque ∨ backorder ∨ qty>0; "últimas peças" = soma da cor ≤ 3; "novo" = created_at < 30 dias ∨ tag `novo`.
- Destaques: `product.metadata.destaque_rank` (string numérica; ausente = fora). Cockpit → editar produto.
- Testes de funções puras: `npm test --workspace=apps/storefront` e `--workspace=apps/cockpit` (Vitest).
```

- [ ] **Step 3: Registrar em `progress.md`**

Adicionar entrada datada (trocar `AAAA-MM-DD` pela data real e `<resultado>` pela última linha impressa pelo script de auditoria):

```markdown
## AAAA-MM-DD — Fase 1 (navegação por tipo de peça): dados + Cockpit ✅
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md · Plano: docs/superpowers/plans/2026-09-07-fase1-dados-catalogo-cockpit.md
- Árvore final de categorias aplicada em produção (setup-categorias.py). Nomes: Top/Short/Legging/Macaquinho / Macacão/Conjuntos/Acessórios/Masculino.
- Cockpit: categorias com ordem+capa+descrição; validação Tamanho/Cor na criação; Vitrine → Cores e → Medidas; Fotos por cor no editor; campo Ordem em Destaques.
- Vitrine: utilitários availability/colors/measurements (Vitest) + leitura de site_content.cores/medidas + metadata/rank nas categorias. Nada visível ainda (F2–F4).
- Seed de cores/medidas aplicado. check-catalog-options.py: <resultado>.
- PENDENTE (fora do código): hex das cores (Vitrine → Cores) e fotos reais por cor.
```

- [ ] **Step 4: Rodar tudo e commitar**

```bash
npm test --workspace=apps/storefront
npm test --workspace=apps/cockpit
npx tsc -p apps/storefront --noEmit
npx tsc -p apps/cockpit --noEmit
git add scripts/check-catalog-options.py architecture/catalog.md progress.md
git commit -m "docs(catalogo): SOP da fase 1 (categorias, opções, cores, medidas, fotos por cor) + auditoria do catálogo"
```

---

## Cobertura da spec (auto-revisão)

| Spec | Task |
|---|---|
| 4.1 categorias, rank, metadata (capa/descrição), handles fixos, Conjuntos oculta | 4, 5 (ocultação já é a regra atual da vitrine: sem produto → não aparece) |
| 4.2 opções padronizadas + validação + script | 6, 12 |
| 4.3 mapa de cores + tela Cockpit + leitura vitrine | 2, 7, 9 |
| 4.4 medidas por categoria + tela Cockpit + leitura vitrine (`size-guide` recebe `categoryHandle` na F3) | 3, 8, 9 |
| 4.5 fotos por cor (vínculo por variante, agrupamento no Cockpit) | 10 |
| 4.6 disponibilidade, "novo", "últimas peças" | 1 |
| 12 Cockpit: validação, fotos por cor, `destaque_rank`, categorias, Cores, Medidas | 5, 6, 7, 8, 10, 11 |
| `listCategories` com metadata/rank (base da F4) | 3 |

Fora deste plano (por design): componentes visuais da vitrine (F2–F5), `size-guide` consumindo `pickMeasurements` (F3), remoção de `main-menu`/resquícios de "linhas" (F4).
