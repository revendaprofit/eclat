# Benefício Conjunto — F2 Cockpit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O dono passa a controlar o Benefício Conjunto pelo Cockpit: regra padrão, exceções por coleção, pares permitidos, conjuntos curados (com capa, produtos, ordem) e um painel só-leitura na ficha do produto — tudo pelas rotas Admin que a F1 pôs no backend.

**Architecture:** Mesmo padrão do Cockpit: helpers server-side em `lib/medusa.ts` (login programático + `medusaAdmin(path)`), rotas Next em `app/api/conjuntos/*` como proxies finos que preservam status e mensagem do backend, páginas/componentes client (`"use client"`, `fetch("/api/…")`, classes Tailwind da paleta ÉCLAT). Regras de formulário, conversão de dinheiro e prévia do benefício ficam em um módulo puro `lib/conjunto.ts` testado com Vitest. Nada no Supabase: comércio é do Medusa (invariante 2).

**Tech Stack:** Next 15.5 (App Router, rotas `app/api`), React client components, Tailwind, Vitest 3 (`lib/**/*.test.ts`), Medusa Admin API da F1 (`/admin/conjuntos/*`).

**Spec:** `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §8 (Cockpit), §4 (dados), §6.6 (rotas admin, como amendado na F1: 422 para duplicidade, sem DELETE em regras). SOP do backend: `architecture/conjunto.md`.

## Global Constraints

- **Comércio só pelo Medusa Admin API** (`/admin/conjuntos/*`), via `lib/medusa.ts`. Nada de tabela nova no Supabase. Nunca duplicar dado de regra/curado no Cockpit.
- **Dinheiro em centavos inteiros** nos payloads (`valor` da regra em centavos quando o tipo é `*_valor`; percentual inteiro 1–100 quando `*_percentual`). Na tela o dono digita R$ com vírgula ou %; a conversão é do módulo puro.
- **Copy pt-BR**, rótulos exatos dos quatro tipos: `% na peça de menor valor` · `R$ na peça de menor valor` · `% sobre o total do conjunto` · `R$ sobre o total do conjunto`. Sem "promoção" na interface: é "Benefício Conjunto" / "condição".
- **Erros do backend chegam ao dono**: a rota Next repassa o `status` e o `message` do Medusa (400/404/422) em `{ error }`; a tela mostra inline (nunca `alert`).
- **Validação no navegador exige login do dono no Cockpit** (senha fora do repo). Agentes validam: Vitest, `npx tsc -p apps/cockpit --noEmit`, e os helpers de `lib/medusa.ts` contra um **backend local** (`medusa develop` com o banco `eclat_dev` do contêiner Docker `eclat-pg-test`, porta 55432 — ver `architecture/conjunto.md` §8/§9) usando `MEDUSA_ADMIN_URL=http://localhost:9000` e credenciais de um admin criado nesse banco local. **Nunca gravar em produção** (o `.env.local` do Cockpit aponta para o Railway: qualquer teste de escrita precisa do override para o backend local). Nunca editar `.env.local`.
- Suítes existentes: cockpit 19 testes (`npm test --workspace=apps/cockpit`), storefront 122, backend 68/30 — inalteradas.
- Commits pequenos com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Rulings do controller (não reabrir)

1. **Rotas Next são proxies finos**: sem lógica de negócio; só validação de presença mínima, repasse de status/mensagem e `cache: "no-store"`. A regra de negócio mora no backend (F1) e a de formulário no módulo puro.
2. **Produtos do curado** vêm de `GET /api/products?q=` (já existe, devolve `CockpitProduct` com `status`, `collection`, `categories`, `variants[].stock`). O aviso "estoque baixo" usa `variants[].stock` (soma ≤ 3 → aviso; sem variante com estoque > 0 → aviso forte "sem estoque"). O backend só bloqueia rascunho/inexistente (ruling 2 da F1).
3. **Ordem dos curados** por arrastar (drag nativo, mesmo padrão do Kanban de leads), persistida com `PUT /admin/conjuntos/curados/:id { ordem }` para cada item cuja posição mudou.
4. **Prévia ao vivo** usa exemplo fixo (top R$ 189,00 + legging R$ 259,00) e a mesma regra de arredondamento do backend (`round(valor/n)` por unidade no `R$ sobre o total`; `menor peça` desconta a de R$ 189,00).
5. **Sem tela de cupons nesta fase.** A conversão de cupons é automática no backend; a spec §8 não pede tela. O botão "Reconciliar" fica em Regras, com confirmação e resultado (`regras`, `cupons`).

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/cockpit/lib/conjunto.ts` (novo) | tipos, `TIPOS_DESCONTO` com rótulos, `valorParaEntrada/entradaParaValor` (R$/% ↔ centavos/inteiro), `validarRegra`, `validarCurado`, `previaBeneficio`, `alertaEstoque`, `slugConjunto` — puro |
| `apps/cockpit/lib/conjunto.test.ts` (novo) | Vitest |
| `apps/cockpit/lib/medusa.ts` | helpers `conjunto*` (regras, pares, curados, por-produto, reconciliar) |
| `apps/cockpit/app/api/conjuntos/{regras,regras/[id],pares,curados,curados/[id],por-produto/[id],reconciliar}/route.ts` (novos) | proxies |
| `apps/cockpit/components/sidebar.tsx` | item "Conjuntos" |
| `apps/cockpit/app/(painel)/conjuntos/page.tsx` (novo) | página com abas Regras / Curados |
| `apps/cockpit/components/conjunto-regras.tsx` (novo) | benefício padrão, exceções por coleção, pares, reconciliar, prévia |
| `apps/cockpit/components/conjunto-curados.tsx` (novo) | lista ordenável + formulário (busca de produtos, capa, regra) + prévia do card |
| `apps/cockpit/components/conjunto-produto-panel.tsx` (novo) | painel só-leitura na ficha do produto |
| `apps/cockpit/components/product-form.tsx` | monta o painel no modo `edit` |
| `architecture/cockpit.md`, `architecture/conjunto.md`, `progress.md` | docs |

---

### Task 1: Módulo puro `lib/conjunto.ts` com testes

**Files:**
- Create: `apps/cockpit/lib/conjunto.ts`
- Test: `apps/cockpit/lib/conjunto.test.ts`

**Interfaces (produces):**
```ts
export type TipoDesconto = "menor_peca_percentual" | "menor_peca_valor" | "total_percentual" | "total_valor"
export const TIPOS_DESCONTO: { value: TipoDesconto; label: string; unidade: "%" | "R$" }[]
export type Regra = { id: string; nome: string; escopo: "padrao" | "colecao" | "curado"; collection_id: string | null; tipo_desconto: TipoDesconto; valor: number; ativa: boolean; promotion_id: string | null }
export type Par = { id: string; categoria_a: string; categoria_b: string; ativo: boolean }
export type Curado = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; ativo: boolean; ordem: number; regra: Regra }
export function unidadeDoTipo(t: TipoDesconto): "%" | "R$"
export function entradaParaValor(t: TipoDesconto, texto: string): number | null   // "15" → 15 ; "45,90" → 4590 ; inválido → null
export function valorParaEntrada(t: TipoDesconto, valor: number): string          // 15 → "15" ; 4590 → "45,90"
export function formatarReais(centavos: number): string                            // 4590 → "R$ 45,90"
export function validarRegra(d: { nome: string; tipo_desconto: TipoDesconto; valorTexto: string }): string | null
export function validarCurado(d: { nome: string; product_ids: string[]; tipo_desconto: TipoDesconto; valorTexto: string }): string | null
export function previaBeneficio(t: TipoDesconto, valor: number, precos: number[]): { descontos: number[]; total: number; economia: number; final: number }
export function alertaEstoque(p: { status: string; variants: { stock: number | null }[] }): "rascunho" | "sem_estoque" | "estoque_baixo" | null
export function slugConjunto(nome: string): string
```

- [ ] **Step 1: Testes (falhando)** — `lib/conjunto.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { alertaEstoque, entradaParaValor, formatarReais, previaBeneficio, slugConjunto, validarCurado, validarRegra, valorParaEntrada } from "./conjunto"

describe("conversão de entrada", () => {
  it("percentual: inteiro 1–100", () => {
    expect(entradaParaValor("total_percentual", "15")).toBe(15)
    expect(entradaParaValor("total_percentual", "15,5")).toBeNull()
    expect(entradaParaValor("total_percentual", "0")).toBeNull()
    expect(entradaParaValor("total_percentual", "101")).toBeNull()
    expect(valorParaEntrada("menor_peca_percentual", 20)).toBe("20")
  })
  it("valor: reais com vírgula ou ponto → centavos", () => {
    expect(entradaParaValor("total_valor", "45,90")).toBe(4590)
    expect(entradaParaValor("menor_peca_valor", "45.9")).toBe(4590)
    expect(entradaParaValor("total_valor", "R$ 1.234,56")).toBe(123456)
    expect(entradaParaValor("total_valor", "0")).toBeNull()
    expect(entradaParaValor("total_valor", "abc")).toBeNull()
    expect(valorParaEntrada("total_valor", 4590)).toBe("45,90")
    expect(formatarReais(123456)).toBe("R$ 1.234,56")
  })
})

describe("validação", () => {
  it("regra: nome, valor", () => {
    expect(validarRegra({ nome: "", tipo_desconto: "total_percentual", valorTexto: "10" })).toMatch(/nome/i)
    expect(validarRegra({ nome: "Padrão", tipo_desconto: "total_percentual", valorTexto: "x" })).toMatch(/valor/i)
    expect(validarRegra({ nome: "Padrão", tipo_desconto: "total_percentual", valorTexto: "10" })).toBeNull()
  })
  it("curado: nome, ≥2 produtos distintos, valor", () => {
    expect(validarCurado({ nome: "Look", product_ids: ["a"], tipo_desconto: "total_valor", valorTexto: "40" })).toMatch(/2 produtos/i)
    expect(validarCurado({ nome: "Look", product_ids: ["a", "a"], tipo_desconto: "total_valor", valorTexto: "40" })).toMatch(/2 produtos/i)
    expect(validarCurado({ nome: "Look", product_ids: ["a", "b"], tipo_desconto: "total_valor", valorTexto: "40" })).toBeNull()
  })
})

describe("previaBeneficio (mesma regra do backend)", () => {
  const P = [18900, 25900]
  it("menor peça % / R$", () => {
    expect(previaBeneficio("menor_peca_percentual", 20, P)).toEqual({ descontos: [3780, 0], total: 44800, economia: 3780, final: 41020 })
    expect(previaBeneficio("menor_peca_valor", 5000, P).descontos).toEqual([5000, 0])
    expect(previaBeneficio("menor_peca_valor", 99900, P).descontos).toEqual([18900, 0])
  })
  it("total % / R$ (repartido e arredondado por unidade)", () => {
    expect(previaBeneficio("total_percentual", 10, P).descontos).toEqual([1890, 2590])
    expect(previaBeneficio("total_valor", 4500, P).descontos).toEqual([2250, 2250])
    expect(previaBeneficio("total_valor", 4501, P).descontos).toEqual([2251, 2251])
  })
})

describe("alertaEstoque / slug", () => {
  it("rascunho, sem estoque, baixo, ok", () => {
    expect(alertaEstoque({ status: "draft", variants: [{ stock: 10 }] })).toBe("rascunho")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 0 }, { stock: null }] })).toBe("sem_estoque")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 2 }, { stock: 1 }] })).toBe("estoque_baixo")
    expect(alertaEstoque({ status: "published", variants: [{ stock: 4 }] })).toBeNull()
  })
  it("slug sem acento, minúsculo, hífens", () => {
    expect(slugConjunto("Look Blackout — Verão")).toBe("look-blackout-verao")
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npm test --workspace=apps/cockpit` → FAIL.

- [ ] **Step 3: Implementar `lib/conjunto.ts`**
```ts
// Benefício Conjunto no Cockpit — regras de formulário, dinheiro e prévia. Puro (sem fetch, sem React).
// Espelha a matemática do backend (apps/backend/src/modules/beneficio-conjunto/utils/montar-conjuntos.ts).
export type TipoDesconto = "menor_peca_percentual" | "menor_peca_valor" | "total_percentual" | "total_valor"
export const TIPOS_DESCONTO: { value: TipoDesconto; label: string; unidade: "%" | "R$" }[] = [
  { value: "menor_peca_percentual", label: "% na peça de menor valor", unidade: "%" },
  { value: "menor_peca_valor", label: "R$ na peça de menor valor", unidade: "R$" },
  { value: "total_percentual", label: "% sobre o total do conjunto", unidade: "%" },
  { value: "total_valor", label: "R$ sobre o total do conjunto", unidade: "R$" },
]
export type Regra = { id: string; nome: string; escopo: "padrao" | "colecao" | "curado"; collection_id: string | null; tipo_desconto: TipoDesconto; valor: number; ativa: boolean; promotion_id: string | null }
export type Par = { id: string; categoria_a: string; categoria_b: string; ativo: boolean }
export type Curado = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; ativo: boolean; ordem: number; regra: Regra }

export const unidadeDoTipo = (t: TipoDesconto): "%" | "R$" => (t.endsWith("percentual") ? "%" : "R$")

export function entradaParaValor(t: TipoDesconto, texto: string): number | null {
  const s = texto.replace(/R\$|\s|%/g, "")
  if (!s) return null
  if (unidadeDoTipo(t) === "%") {
    if (!/^\d+$/.test(s)) return null
    const n = Number(s)
    return n >= 1 && n <= 100 ? n : null
  }
  const norm = s.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".")
  if (!/^\d+(\.\d{1,2})?$/.test(norm)) return null
  const centavos = Math.round(Number(norm) * 100)
  return centavos >= 1 ? centavos : null
}
export function valorParaEntrada(t: TipoDesconto, valor: number): string {
  return unidadeDoTipo(t) === "%" ? String(valor) : (valor / 100).toFixed(2).replace(".", ",")
}
export function formatarReais(centavos: number): string {
  const [int, dec] = (centavos / 100).toFixed(2).split(".")
  return `R$ ${int.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${dec}`
}
export function validarRegra(d: { nome: string; tipo_desconto: TipoDesconto; valorTexto: string }): string | null {
  if (!d.nome.trim()) return "Informe o nome da regra."
  if (entradaParaValor(d.tipo_desconto, d.valorTexto) === null) return unidadeDoTipo(d.tipo_desconto) === "%" ? "Valor inválido: use um percentual inteiro de 1 a 100." : "Valor inválido: use reais, ex.: 45,90."
  return null
}
export function validarCurado(d: { nome: string; product_ids: string[]; tipo_desconto: TipoDesconto; valorTexto: string }): string | null {
  if (!d.nome.trim()) return "Informe o nome do conjunto."
  if (new Set(d.product_ids).size < 2) return "Escolha pelo menos 2 produtos diferentes."
  return validarRegra({ nome: d.nome, tipo_desconto: d.tipo_desconto, valorTexto: d.valorTexto })
}
export function previaBeneficio(t: TipoDesconto, valor: number, precos: number[]) {
  const n = precos.length
  const idxMin = precos.reduce((m, p, i) => (p < precos[m] ? i : m), 0)
  let descontos = precos.map(() => 0)
  if (t === "menor_peca_percentual") descontos[idxMin] = Math.min(precos[idxMin], Math.round((precos[idxMin] * valor) / 100))
  else if (t === "menor_peca_valor") descontos[idxMin] = Math.min(precos[idxMin], valor)
  else if (t === "total_percentual") descontos = precos.map((p) => Math.min(p, Math.round((p * valor) / 100)))
  else descontos = precos.map((p) => Math.min(p, Math.round(valor / n)))
  const total = precos.reduce((s, p) => s + p, 0)
  const economia = descontos.reduce((s, d) => s + d, 0)
  return { descontos, total, economia, final: total - economia }
}
export function alertaEstoque(p: { status: string; variants: { stock: number | null }[] }): "rascunho" | "sem_estoque" | "estoque_baixo" | null {
  if (p.status !== "published") return "rascunho"
  const soma = p.variants.reduce((s, v) => s + Math.max(0, v.stock ?? 0), 0)
  if (soma <= 0) return "sem_estoque"
  if (soma <= 3) return "estoque_baixo"
  return null
}
export const slugConjunto = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
```

- [ ] **Step 4: Rodar e ver passar** — 19 + 9 = 28 testes. `npx tsc -p apps/cockpit --noEmit` limpo.
- [ ] **Step 5: Commit** — `feat(cockpit): módulo puro do Benefício Conjunto (conversão, validação, prévia)`.

---

### Task 2: Helpers `lib/medusa.ts` + rotas `app/api/conjuntos/*`

**Files:**
- Modify: `apps/cockpit/lib/medusa.ts`
- Create: `apps/cockpit/app/api/conjuntos/regras/route.ts`, `regras/[id]/route.ts`, `pares/route.ts`, `curados/route.ts`, `curados/[id]/route.ts`, `por-produto/[id]/route.ts`, `reconciliar/route.ts`

**Interfaces (produces):**
```ts
// lib/medusa.ts — todos lançam MedusaHttpError { status, message } quando o backend responde erro
export class MedusaHttpError extends Error { status: number }
export async function conjuntoListRegras(): Promise<Regra[]>
export async function conjuntoCreateRegra(input: { nome: string; escopo: "padrao" | "colecao"; collection_id?: string; tipo_desconto: TipoDesconto; valor: number; ativa?: boolean }): Promise<Regra>
export async function conjuntoUpdateRegra(id: string, input: Partial<{ nome: string; tipo_desconto: TipoDesconto; valor: number; ativa: boolean }>): Promise<Regra>
export async function conjuntoGetPares(): Promise<Par[]>
export async function conjuntoSetPares(pares: { categoria_a: string; categoria_b: string; ativo?: boolean }[]): Promise<Par[]>
export async function conjuntoListCurados(): Promise<Curado[]>
export async function conjuntoCreateCurado(input: { nome: string; handle?: string; capa_url?: string | null; product_ids: string[]; tipo_desconto: TipoDesconto; valor: number; ativo?: boolean; ordem?: number }): Promise<Curado>
export async function conjuntoUpdateCurado(id: string, input: Partial<{ nome: string; capa_url: string | null; product_ids: string[]; tipo_desconto: TipoDesconto; valor: number; ativo: boolean; ordem: number }>): Promise<Curado>
export async function conjuntoDeleteCurado(id: string): Promise<void>
export async function conjuntoPorProduto(productId: string): Promise<{ parceiras: { product_id: string; categoria_raiz: string; collection_id: string }[]; curados: Curado[] }>
export async function conjuntoReconciliar(): Promise<{ regras: number; cupons: number }>
```
Rotas Next (todas `cache: "no-store"`): `GET/POST /api/conjuntos/regras`, `PUT /api/conjuntos/regras/[id]`, `GET/PUT /api/conjuntos/pares`, `GET/POST /api/conjuntos/curados`, `PUT/DELETE /api/conjuntos/curados/[id]`, `GET /api/conjuntos/por-produto/[id]`, `POST /api/conjuntos/reconciliar`. Resposta de erro: `{ error: message }` com o status do backend (`MedusaHttpError.status`), 502 para falha de rede.

- [ ] **Step 1: Helper genérico de erro** em `lib/medusa.ts` (após `medusaAdmin`):
```ts
export class MedusaHttpError extends Error {
  constructor(public status: number, message: string) { super(message) }
}
// Chama a Admin API e devolve o JSON; erro do Medusa vira MedusaHttpError com a mensagem do backend (pt-BR nas rotas de conjunto).
async function medusaJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  const r = await medusaAdmin(path, init)
  if (!r.ok) {
    let msg = `HTTP ${r.status}`
    try { const j = await r.json(); msg = j.message || j.error || msg } catch {}
    throw new MedusaHttpError(r.status, msg)
  }
  return (await r.json()) as T
}
```
- [ ] **Step 2: Helpers `conjunto*`** com `medusaJson` (bodies como na F1: regras `{ nome, escopo, collection_id, tipo_desconto, valor, ativa }`; pares `{ pares }`; curados `{ nome, handle, capa_url, product_ids, tipo_desconto, valor, ativo, ordem }`). Respostas: `{ regras }`, `{ regra }`, `{ pares }`, `{ curados }`, `{ curado }`, `{ parceiras, curados }`, `{ regras, cupons }`, DELETE `{ id, deleted }`.
- [ ] **Step 3: Rotas** — padrão de `app/api/taxonomy/categories/route.ts`; função comum `respostaErro(e)`:
```ts
import { MedusaHttpError } from "@/lib/medusa"
export function respostaErro(e: unknown) {
  if (e instanceof MedusaHttpError) return NextResponse.json({ error: e.message }, { status: e.status })
  return NextResponse.json({ error: (e as Error).message }, { status: 502 })
}
```
(colocar em `apps/cockpit/lib/api-erro.ts`). Cada rota lê o body com `await req.json()` e repassa.
- [ ] **Step 4: Validação contra backend LOCAL** (script descartável, não commitado, em `apps/cockpit/scripts-tmp/` ou no scratchpad): subir `medusa develop` em `apps/backend` com `DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev` (criar admin local: `DATABASE_URL=… npx medusa user -e admin@local.test -p senha-local-123`), depois rodar um script `tsx` que importa `lib/medusa.ts` com `MEDUSA_ADMIN_URL=http://localhost:9000 MEDUSA_ADMIN_EMAIL=admin@local.test MEDUSA_ADMIN_PASSWORD=senha-local-123` e exercita: list regras (vazio ou padrão), create padrão, update valor, pares set/get, curado create (precisa de 2 produtos publicados no banco local — criar via Admin API no script), update ordem, por-produto, reconciliar, delete curado, e um erro 422 (segunda regra padrão) mostrando `MedusaHttpError.status === 422`. Registrar a saída no relatório. Parar o `medusa develop` ao final.
- [ ] **Step 5: `npx tsc -p apps/cockpit --noEmit`** limpo; testes 28. Commit — `feat(cockpit): helpers e rotas /api/conjuntos (proxies da Admin API do Benefício Conjunto)`.

---

### Task 3: Página `/conjuntos` + aba Regras (`conjunto-regras.tsx`)

**Files:**
- Modify: `apps/cockpit/components/sidebar.tsx` (item `{ href: "/conjuntos", label: "Conjuntos (benefício)" }` após "Produtos & Estoque")
- Create: `apps/cockpit/app/(painel)/conjuntos/page.tsx` (abas "Regras" | "Conjuntos curados", estado da aba na URL `?aba=curados`)
- Create: `apps/cockpit/components/conjunto-regras.tsx`

**Comportamento (spec §8.1):**
- Carrega `GET /api/conjuntos/regras`, `GET /api/conjuntos/pares`, `GET /api/taxonomy/collections` (para nomes das coleções) e `GET /api/taxonomy/categories` (raízes ativas para os pares).
- **Benefício padrão**: card com `tipo_desconto` (select com `TIPOS_DESCONTO`), campo de valor com sufixo `%`/`R$` conforme o tipo, toggle "Ativo", botão "Salvar". Se não existe regra padrão (backend novo), o card oferece "Criar benefício padrão" (`POST` com `escopo: "padrao"`). Prévia ao vivo: "Exemplo: Top R$ 189,00 + Legging R$ 259,00 → cliente paga **R$ X** (economia R$ Y)" com `previaBeneficio`. Aviso quando inativo: "Benefício desligado: a vitrine não mostra conjuntos nem aplica desconto."
- **Exceções por coleção**: tabela coleção · tipo · valor · ativo · ações. Coleções sem exceção aparecem em cinza com "padrão" e botão "Criar exceção"; com exceção: editar inline (mesmos campos) e "Usar padrão" (que no backend é `PUT { ativa: false }`? NÃO — "usar padrão" exige remover a exceção, mas regras não têm DELETE (spec). **Ruling:** o botão "Usar padrão" não existe nesta fase; a exceção tem o toggle "Ativa" e o texto explica: "Exceção inativa = esta coleção fica SEM benefício (não volta ao padrão)". Documentar como pendência de backend (DELETE de exceção) na Task 6.
- **Pares permitidos**: chips `Top + Legging` (nomes das categorias raiz, handles por baixo), remover com ×, adicionar com dois selects de categorias raiz ativas + "Adicionar par". Salvar envia a lista inteira (`PUT /api/conjuntos/pares`).
- **Reconciliar**: botão secundário "Reconciliar promoções e cupons" com confirmação (`confirm()` é aceitável aqui? **não**: usar um mini-diálogo inline "Confirmar") → mostra "Regras sincronizadas: n · Cupons convertidos: m".
- Erros inline em vermelho (`{ error }` da rota); estados `carregando`/`salvando`; sem `alert`.

- [ ] **Step 1: Sidebar + página com abas** (client; `useSearchParams` para a aba).
- [ ] **Step 2: `conjunto-regras.tsx`** conforme acima, reutilizando as classes `input`/`label`/`btn` de `vitrine/page.tsx` (copiar as três constantes para o componente).
- [ ] **Step 3: `tsc` limpo; testes 28.** Validação visual fica para o dono (Task 6 lista o roteiro); o implementador confere pelo menos que a página compila e que `next build --workspace=apps/cockpit` não é exigido (só `tsc`).
- [ ] **Step 4: Commit** — `feat(cockpit): tela Conjuntos › Regras (padrão, exceções, pares, reconciliar, prévia)`.

---

### Task 4: Aba Conjuntos curados (`conjunto-curados.tsx`)

**Files:**
- Create: `apps/cockpit/components/conjunto-curados.tsx`
- Modify: `apps/cockpit/app/(painel)/conjuntos/page.tsx` (monta a aba)

**Comportamento (spec §8.2):**
- Lista: capa (miniatura 48px ou placeholder com inicial), nome, handle, peças (títulos + miniaturas, via `GET /api/products` uma vez, mapa por id), regra (rótulo + valor formatado), toggle ativo, "Editar", "Excluir" (confirmação inline), e **ordem por arrastar** (drag nativo como no Kanban: `draggable`, `onDragStart`, `onDragOver`, `onDrop`; ao soltar, reordena localmente e envia `PUT /api/conjuntos/curados/:id { ordem }` para cada item cuja posição mudou — ruling 3).
- Formulário (drawer lateral, mesmo estilo do `ProductForm`): nome (gera handle com `slugConjunto`; handle editável só na criação, com o regex `^[a-z0-9]+(?:-[a-z0-9]+)*$`), capa (upload via `POST /api/site-upload`, reaproveitar o `UploadImagem` de `vitrine/page.tsx` extraindo-o para `components/upload-imagem.tsx`), busca de produtos (campo com debounce 300 ms → `GET /api/products?q=`; resultados mostram título, coleção, estoque somado e o `alertaEstoque` como selo: "Rascunho" (não selecionável), "Sem estoque" (selecionável com aviso forte), "Estoque baixo" (selecionável, selo âmbar "bom para queimar estoque")), lista dos escolhidos (mínimo 2, remover com ×), tipo e valor (mesmos campos da regra), ativo. Prévia do card: capa, nome, "a partir de" = `previaBeneficio(tipo, valor, precosMinDosProdutos)` usando o menor `variants[].price` de cada produto (em centavos: `Math.round(price*100)`).
- Salvar: `validarCurado` antes; `POST`/`PUT`; erro do backend inline (422 handle duplicado, 400 produto rascunho).

- [ ] **Step 1: Extrair `UploadImagem`** para `components/upload-imagem.tsx` e usar em `vitrine/page.tsx` (sem mudar comportamento).
- [ ] **Step 2: `conjunto-curados.tsx`** conforme acima.
- [ ] **Step 3: `tsc` limpo; testes 28.** Commit — `feat(cockpit): tela Conjuntos › Curados (lista ordenável, formulário com busca de produtos, capa e prévia)`.

---

### Task 5: Painel "Conjuntos" na ficha do produto

**Files:**
- Create: `apps/cockpit/components/conjunto-produto-panel.tsx`
- Modify: `apps/cockpit/components/product-form.tsx` (modo `edit`, abaixo do bloco `ColorImages`)

**Comportamento (spec §8.3):** só leitura. Carrega `GET /api/conjuntos/por-produto/:id` + `GET /api/products` (mapa id → título/miniatura). Mostra: "Forma par com" (lista de parceiras com categoria raiz), "Está nos conjuntos curados" (nome + link para `/conjuntos?aba=curados`), e o motivo quando vazio: sem coleção → "Produto sem coleção: não forma conjunto de coleção"; coleção sem benefício ativo → "Coleção sem benefício ativo"; categoria fora dos pares → "Categoria não participa dos pares permitidos". (O backend não devolve o motivo; o painel infere com os dados do produto + regras + pares já carregados: chamar também `GET /api/conjuntos/regras` e `/pares`.)

- [ ] **Step 1: Componente + montagem no `ProductForm`** (só quando `mode === "edit"` e `productId`).
- [ ] **Step 2: `tsc` limpo; testes 28.** Commit — `feat(cockpit): painel só-leitura de conjuntos na ficha do produto`.

---

### Task 6: Docs, roteiro de validação do dono e pendências

**Files:**
- Modify: `architecture/cockpit.md` (seção "Conjuntos (benefício)"), `architecture/conjunto.md` (§ "O que a F2 consome" → "entregue"), `progress.md`, `CLAUDE.md` (linha do Cockpit)
- Modify: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §8 (ruling "Usar padrão" ausente; F2 implementada, validação visual pendente do dono)

- [ ] **Step 1: `architecture/cockpit.md`** — telas, rotas `/api/conjuntos/*`, módulo puro, como validar (backend local + roteiro).
- [ ] **Step 2: Roteiro de validação para o dono** (em `progress.md`, entrada "F2 Cockpit"): (1) abrir Cockpit → Conjuntos; (2) na aba Regras conferir o benefício padrão vindo de produção (10% sobre o total, inativo), editar para "% na peça de menor valor" 20 e **salvar sem ativar**; conferir a prévia (economia R$ 37,80); (3) pares Top + Legging e Top + Short listados; adicionar e remover um par de teste; (4) aba Curados: criar "Look teste" com 2 produtos publicados, capa, `R$ sobre o total` 40,00; ver na lista; arrastar para reordenar; excluir; (5) ficha do produto Top: painel mostra parceiras; (6) só então, se quiser ligar o benefício: ativar a regra padrão. Registrar resultados em `progress.md`.
- [ ] **Step 3: Pendências de backend** anotadas na spec/SOP: `DELETE /admin/conjuntos/regras/:id` para exceções (hoje só desativa); `capa` nas coleções para o card (F3).
- [ ] **Step 4: Commit** — `docs(cockpit): F2 Benefício Conjunto — telas, rotas, roteiro de validação do dono`.

---

## Self-review

- **Cobertura da spec §8:** 8.1 (Task 3), 8.2 (Task 4), 8.3 (Task 5); §6.6 consumido por Task 2; validação de curado por ruling 2 (Task 4); dinheiro em centavos (Task 1).
- **Placeholders:** nenhum; Tasks 3–5 descrevem comportamento e reutilizam padrões existentes nomeados (Kanban drag, `UploadImagem`, `ProductForm`, `taxonomy` routes) — o código de UI é do implementador, com as regras puras já escritas na Task 1.
- **Consistência de tipos:** `Regra/Par/Curado/TipoDesconto` definidos em `lib/conjunto.ts` (Task 1) e usados por `lib/medusa.ts` (Task 2) e componentes; `MedusaHttpError` (Task 2) usado por `api-erro.ts`; `previaBeneficio` (Task 1) usado nas Tasks 3 e 4; `alertaEstoque` na Task 4.
- **Riscos:** validação visual só pelo dono (login); backend local para testar os helpers (Task 2) exige `medusa develop` + admin local — descrito passo a passo; `GET /api/products` limita a 100 produtos (mesmo teto das outras telas).
