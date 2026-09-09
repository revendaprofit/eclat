# Benefício Conjunto — F1 Backend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O backend Medusa passa a conhecer regras de Benefício Conjunto (padrão, exceções por coleção, pares permitidos, conjuntos curados), a formar conjuntos em todo carrinho pelo gancho oficial, a manter uma promoção automática por regra, a impedir que cupons alcancem unidades em conjunto, e a expor rotas Admin (Cockpit, F2) e Store (vitrine, F3/F4).

**Architecture:** Módulo customizado `beneficio-conjunto` (`apps/backend/src/modules/beneficio-conjunto`) com três modelos DML e um serviço gerado por `MedusaService`. A lógica de pareamento é uma função pura (`montarConjuntos`) testada por unidade; o gancho `updateCartPromotionsWorkflow.hooks.setPromotionContext` (provado na F0) só monta a entrada, chama a função e devolve o contexto com as unidades marcadas (`conjunto_desconto` = `regra_id` | `"conjunto"` | `"nenhum"`, linhas divididas por marcação). Cada regra ativa mantém uma promoção automática (`CONJUNTO-<regra_id>`, regra-alvo `items.conjunto_desconto eq <regra_id>`, `allocation: each`, `max_quantity: 1000`). Cupons são convertidos nos ganchos `promotionsCreated`/`promotionsUpdated` (pedido → itens `across`, mais a regra de exclusão `items.conjunto_desconto eq nenhum`). Rotas Store devolvem **estrutura + ids de produto**; preço, foto e disponibilidade são hidratados pela vitrine (F3) com o `listProducts` que ela já tem.

**Tech Stack:** Medusa 2.15.5 (DML, `MedusaService`, workflows/hooks, `query.graph`, zod nos validadores), Jest (unit + integração HTTP com o harness da F0: Docker Postgres 17 em `eclat-pg-test:55432`), Python 3 para o script de produção (padrão de `scripts/setup-categorias.py`).

**Spec:** `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §4 (dados), §5 (cálculo), §6 (carrinho, promoções, cupom, rotas), §10 F1, §11 itens 1–4 e 10, §12. Decisões da F0 já incorporadas em §6.2–§6.4.

## Global Constraints

- **Escrita em produção só na Task 8, só depois do "pode aplicar" do dono**, e só via script idempotente contra a Admin API (`scripts/setup-conjunto.py --apply`). Todas as outras tasks rodam contra o contêiner Docker `eclat-pg-test` (porta 55432). Nunca apontar `DATABASE_URL` de teste/dev para Railway nem para o Postgres nativo. Nunca editar `apps/backend/.env`.
- **Dinheiro:** no módulo, **centavos inteiros** (`valor` da regra; `preco_unitario` na função pura). Na fronteira com o Medusa (promoções, contexto do carrinho), unidades decimais da moeda: `centavos / 100` ao criar promoção; `Math.round(unit * 100)` ao ler `subtotal/quantity` do carrinho.
- **Contrato do motor (F0):** regra-alvo com atributo **`items.conjunto_desconto`**; `allocation: each` sempre com **`max_quantity: 1000`**; `allocation: across` **nunca** leva `max_quantity`; cupom de pedido não aceita `target_rules` (converter para itens).
- **Gancho nunca lança:** qualquer erro → `console.error("[conjunto]", e)` e `new StepResponse({})`. Sem regra padrão ativa e sem exceções ativas → contexto original.
- **Rotas Admin** sob `/admin/conjuntos/*` (autenticação padrão); **Store** sob `/store/conjuntos/*` (chave publicável). Respostas JSON com nomes em pt-BR como na spec (§6.5/§6.6). Store com `Cache-Control: public, s-maxage=300, stale-while-revalidate=600`, exceto `oportunidades` (`no-store`).
- **Comandos (Windows):** de `apps/backend`, prefixar `npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe"`. Suítes: `npm run test:unit` (`src/**/__tests__/*.unit.spec.ts`) e `npm run test:integration:http` (`integration-tests/http/*.spec.ts`). `npx tsc -p apps/backend --noEmit 2>&1 | grep -v cockpit/page.tsx` deve ficar vazio (21 erros pré-existentes em `src/admin/routes/cockpit/page.tsx` não são desta fase).
- **Migração e dev local:** `medusa db:generate` e `medusa develop` precisam de banco. Usar o banco `eclat_dev` dentro do contêiner de teste: `docker exec eclat-pg-test psql -U postgres -c "CREATE DATABASE eclat_dev"` (uma vez) e `DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa db:migrate` antes de `db:generate`. Variável inline vence o `.env` (dotenv não sobrescreve).
- **Copy pt-BR** em mensagens de erro, comentários e nomes de campos JSON. Commits pequenos com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- O gancho de PoC `src/workflows/hooks/conjunto-poc.ts` e o spec `integration-tests/http/conjunto-poc.spec.ts` são **removidos** na Task 4 (o módulo os substitui). O harness (`.env.test`, `setup.js`, `helpers/*`, `saude.spec.ts`) fica.

## Rulings do controller (não reabrir)

1. **Rotas Store devolvem estrutura + `product_ids`**, não produtos com preço: a vitrine hidrata com `listProducts({ id })` (preço, fotos, estoque, mesmo teto de 100). Corrige a spec §6.5 (Task 8). Motivo: uma fonte só de preço/disponibilidade; menos código no backend.
2. **Validação de curado no backend** exige produto existente e `status: published`; "sem variante disponível" é aviso do Cockpit (F2), não bloqueio do backend. Corrige §4.4.
3. **Conversão de cupom nos ganchos de workflow** (`promotionsCreated`/`promotionsUpdated` de `createPromotionsWorkflow`/`updatePromotionsWorkflow`), não em assinante de evento: a Admin API usa esses workflows; o módulo de promoção não emite eventos de domínio em 2.15.5. Idempotente: promoção já convertida é no-op.
4. **Marcação com três valores** em `conjunto_desconto`: `regra_id` (unidade que recebe desconto), `"conjunto"` (está num conjunto, sem desconto próprio — ex.: a peça mais cara em "menor peça"; o cupom também não a alcança), `"nenhum"` (livre). A regra-alvo do cupom é `eq nenhum`.
5. **Pareamento ótimo simples:** por coleção e par (A, B), pegar as *n* unidades mais caras de cada lado (n = mínimo) e parear em ordem decrescente de preço. Maximiza tanto a soma dos mínimos (tipos "menor peça") quanto o total pareado (tipos "total"). Empates por `item_id` + índice da unidade.
6. **Atualização de promoção sem recriar:** valor/tipo/status mudam via `updatePromotionsWorkflow`; a regra-alvo (`eq regra_id`) nunca muda. Promoção apagada à mão → `reconciliar` recria e grava o novo `promotion_id`.
7. **Seed de produção via Admin API** (`scripts/setup-conjunto.py`), não via `medusa exec` (não há shell no Railway no fluxo atual). Localmente o mesmo script roda contra `medusa develop`.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/backend/src/modules/beneficio-conjunto/models/{conjunto-regra,conjunto-par,conjunto-curado}.ts` | modelos DML |
| `apps/backend/src/modules/beneficio-conjunto/service.ts` | `BeneficioConjuntoService` (`MedusaService`) + métodos de leitura agregada |
| `apps/backend/src/modules/beneficio-conjunto/index.ts` | `Module(BENEFICIO_CONJUNTO_MODULE, { service })` |
| `apps/backend/src/modules/beneficio-conjunto/migrations/*` | geradas por `medusa db:generate` |
| `apps/backend/src/modules/beneficio-conjunto/utils/tipos.ts` | tipos compartilhados (Unidade, Regra, Par, Curado, ConjuntoFormado, Oportunidade, TipoDesconto) |
| `apps/backend/src/modules/beneficio-conjunto/utils/montar-conjuntos.ts` | função pura `montarConjuntos` + `descontoDoConjunto` + `regraEfetiva` |
| `apps/backend/src/modules/beneficio-conjunto/utils/categorias.ts` | `raizPorCategoria` (puro) |
| `apps/backend/src/modules/beneficio-conjunto/utils/promocao.ts` | `payloadPromocao(regra, nUnidades)` (puro), `CODIGO_PREFIXO = "CONJUNTO-"`, `REGRA_EXCLUSAO` |
| `apps/backend/src/modules/beneficio-conjunto/__tests__/*.unit.spec.ts` | testes unitários dos puros |
| `apps/backend/src/modules/beneficio-conjunto/avaliar-carrinho.ts` | `avaliarCarrinho(container, cart)` — I/O: carrega regras/pares/curados/categorias, chama `montarConjuntos` |
| `apps/backend/src/modules/beneficio-conjunto/sincronizar-promocao.ts` | `sincronizarPromocao(container, regraId)` e `converterCupom(container, promotion)` |
| `apps/backend/src/workflows/hooks/conjunto-marcar.ts` | gancho `setPromotionContext` real |
| `apps/backend/src/workflows/hooks/conjunto-cupom.ts` | ganchos `promotionsCreated`/`promotionsUpdated` |
| `apps/backend/src/api/middlewares.ts` | validadores zod das rotas admin |
| `apps/backend/src/api/admin/conjuntos/{regras,regras/[id],pares,curados,curados/[id],por-produto/[product_id],reconciliar}/route.ts` | rotas Admin |
| `apps/backend/src/api/store/conjuntos/{route,[handle]/route,por-produto/[product_id]/route,oportunidades/route}.ts` | rotas Store |
| `apps/backend/src/modules/beneficio-conjunto/catalogo-conjuntos.ts` | `listarConjuntos(container)`, `parceirasDoProduto(container, productId)` — I/O compartilhado por rotas admin/store |
| `apps/backend/integration-tests/helpers/catalogo.ts` | catálogo de teste ampliado (coleções, categorias raiz, 5 produtos) |
| `apps/backend/integration-tests/http/{conjunto-carrinho,conjunto-cupom,conjunto-admin,conjunto-store}.spec.ts` | integração |
| `apps/backend/medusa-config.ts` | registro do módulo |
| `scripts/setup-conjunto.py` | seed idempotente (regra padrão inativa + pares) e reconciliação, contra Admin API |
| `architecture/conjunto.md`, `progress.md`, spec | SOP e registro |

---

### Task 1: Módulo, modelos, migração e registro

**Files:**
- Create: `apps/backend/src/modules/beneficio-conjunto/models/conjunto-regra.ts`, `conjunto-par.ts`, `conjunto-curado.ts`
- Create: `apps/backend/src/modules/beneficio-conjunto/service.ts`, `index.ts`
- Create: `apps/backend/src/modules/beneficio-conjunto/utils/tipos.ts`
- Create (gerada): `apps/backend/src/modules/beneficio-conjunto/migrations/Migration2026….ts`
- Modify: `apps/backend/medusa-config.ts`
- Create: `apps/backend/integration-tests/http/conjunto-modulo.spec.ts`

**Interfaces:**
- Produces: `BENEFICIO_CONJUNTO_MODULE = "beneficioConjunto"`; serviço com métodos gerados `listConjuntoRegras/createConjuntoRegras/updateConjuntoRegras/retrieveConjuntoRegra/deleteConjuntoRegras`, idem `ConjuntoPares`, `ConjuntoCurados`; tipos em `utils/tipos.ts`.

- [ ] **Step 1: Tipos compartilhados** — `utils/tipos.ts`:

```ts
// Tipos do Benefício Conjunto (spec §4–§5). Dinheiro em centavos inteiros.
export const TIPOS_DESCONTO = ["menor_peca_percentual", "menor_peca_valor", "total_percentual", "total_valor"] as const
export type TipoDesconto = (typeof TIPOS_DESCONTO)[number]
export const ESCOPOS = ["padrao", "colecao", "curado"] as const
export type Escopo = (typeof ESCOPOS)[number]

export type Regra = { id: string; nome: string; escopo: Escopo; collection_id: string | null; tipo_desconto: TipoDesconto; valor: number; ativa: boolean; promotion_id: string | null }
export type Par = { id: string; categoria_a: string; categoria_b: string; ativo: boolean }
export type Curado = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; regra_id: string; ativo: boolean; ordem: number }

// Entrada do cálculo: uma LINHA do carrinho (quantidade pode ser > 1)
export type Linha = { item_id: string; product_id: string; collection_id: string | null; categoria_raiz: string | null; preco_unitario: number; quantidade: number }
export type UnidadeFormada = { item_id: string; product_id: string; preco_unitario: number; desconto_unitario: number }
export type ConjuntoFormado = { id: string; tipo: "curado" | "colecao"; regra_id: string; unidades: UnidadeFormada[] }
export type Oportunidade = { collection_id: string; categoria_faltante: string; a_partir_do_item_id: string }
export type ResultadoMontagem = { conjuntos: ConjuntoFormado[]; oportunidades: Oportunidade[] }
```

- [ ] **Step 2: Modelos DML**

`models/conjunto-regra.ts`:
```ts
import { model } from "@medusajs/framework/utils"
import { ESCOPOS, TIPOS_DESCONTO } from "../utils/tipos"

// Regra de benefício (spec §4.1). Exatamente uma linha `padrao`; `colecao` única por collection_id.
const ConjuntoRegra = model
  .define("conjunto_regra", {
    id: model.id({ prefix: "creg" }).primaryKey(),
    nome: model.text(),
    escopo: model.enum(ESCOPOS),
    collection_id: model.text().nullable(),
    tipo_desconto: model.enum(TIPOS_DESCONTO),
    valor: model.number(), // percentual inteiro (1–100) ou centavos (>= 1)
    ativa: model.boolean().default(true),
    promotion_id: model.text().nullable(),
  })
  .indexes([{ on: ["collection_id"], unique: true, where: "escopo = 'colecao' AND deleted_at IS NULL" }])

export default ConjuntoRegra
```
`models/conjunto-par.ts`:
```ts
import { model } from "@medusajs/framework/utils"

// Par de categorias raiz que forma conjunto (spec §4.2). Guardado ordenado (a < b) para unicidade.
const ConjuntoPar = model
  .define("conjunto_par", {
    id: model.id({ prefix: "cpar" }).primaryKey(),
    categoria_a: model.text(),
    categoria_b: model.text(),
    ativo: model.boolean().default(true),
  })
  .indexes([{ on: ["categoria_a", "categoria_b"], unique: true, where: "deleted_at IS NULL" }])

export default ConjuntoPar
```
`models/conjunto-curado.ts`:
```ts
import { model } from "@medusajs/framework/utils"

// Conjunto curado pelo admin (spec §4.3). regra_id aponta para uma conjunto_regra de escopo `curado`.
const ConjuntoCurado = model
  .define("conjunto_curado", {
    id: model.id({ prefix: "ccur" }).primaryKey(),
    nome: model.text(),
    handle: model.text(),
    capa_url: model.text().nullable(),
    product_ids: model.array(),
    regra_id: model.text(),
    ativo: model.boolean().default(true),
    ordem: model.number().default(0),
  })
  .indexes([{ on: ["handle"], unique: true, where: "deleted_at IS NULL" }])

export default ConjuntoCurado
```
Se `model.array()` não existir na versão, usar `model.json()` e tratar `product_ids` como `string[]` no serviço; registrar.

- [ ] **Step 3: Serviço e índice**

`service.ts`:
```ts
import { MedusaService } from "@medusajs/framework/utils"
import ConjuntoRegra from "./models/conjunto-regra"
import ConjuntoPar from "./models/conjunto-par"
import ConjuntoCurado from "./models/conjunto-curado"
import type { Curado, Par, Regra } from "./utils/tipos"

// Serviço do módulo: CRUD gerado pelo MedusaService + leituras agregadas usadas pelo gancho e pelas rotas.
class BeneficioConjuntoService extends MedusaService({ ConjuntoRegra, ConjuntoPar, ConjuntoCurado }) {
  async carregarAtivos(): Promise<{ regras: Regra[]; pares: Par[]; curados: Curado[] }> {
    const [regras, pares, curados] = await Promise.all([
      this.listConjuntoRegras({}),
      this.listConjuntoPares({ ativo: true }),
      this.listConjuntoCurados({ ativo: true }, { order: { ordem: "ASC" } }),
    ])
    return { regras: regras as unknown as Regra[], pares: pares as unknown as Par[], curados: curados as unknown as Curado[] }
  }
}
export default BeneficioConjuntoService
```
`index.ts`:
```ts
import { Module } from "@medusajs/framework/utils"
import BeneficioConjuntoService from "./service"

export const BENEFICIO_CONJUNTO_MODULE = "beneficioConjunto"
export default Module(BENEFICIO_CONJUNTO_MODULE, { service: BeneficioConjuntoService })
```

- [ ] **Step 4: Registrar no `medusa-config.ts`** — acrescentar ao `defineConfig`:
```ts
  modules: [{ resolve: "./src/modules/beneficio-conjunto" }],
```

- [ ] **Step 5: Gerar a migração** (banco dev no contêiner):
```bash
docker exec eclat-pg-test psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname='eclat_dev'" | grep -q 1 || docker exec eclat-pg-test psql -U postgres -c "CREATE DATABASE eclat_dev"
cd apps/backend && DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa db:migrate && DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa db:generate beneficio-conjunto
```
Expected: arquivo em `src/modules/beneficio-conjunto/migrations/` criando as três tabelas com índices. Abrir e conferir os índices parciais (`where`). Rodar `db:migrate` de novo para aplicar no `eclat_dev`.

- [ ] **Step 6: Teste de fumaça do módulo** — `integration-tests/http/conjunto-modulo.spec.ts`:
```ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ getContainer }) => {
    it("cria e lê regra, par e curado; índice único de coleção", async () => {
      const svc: any = getContainer().resolve(BENEFICIO_CONJUNTO_MODULE)
      const regra = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10, ativa: false })
      expect(regra.id).toMatch(/^creg_/)
      await svc.createConjuntoPares({ categoria_a: "leggings", categoria_b: "tops" })
      const cur = await svc.createConjuntoCurados({ nome: "Look Blackout", handle: "look-blackout", product_ids: ["p1", "p2"], regra_id: regra.id })
      expect(cur.product_ids).toEqual(["p1", "p2"])
      const excecao = await svc.createConjuntoRegras({ nome: "Col X", escopo: "colecao", collection_id: "col_x", tipo_desconto: "menor_peca_percentual", valor: 20 })
      await expect(svc.createConjuntoRegras({ nome: "Col X de novo", escopo: "colecao", collection_id: "col_x", tipo_desconto: "total_valor", valor: 1000 })).rejects.toBeTruthy()
      const ativos = await svc.carregarAtivos()
      expect(ativos.regras.map((r: any) => r.id).sort()).toEqual([regra.id, excecao.id].sort())
      expect(ativos.pares).toHaveLength(1)
      expect(ativos.curados).toHaveLength(1)
    })
  },
})
```
O runner migra os módulos do `medusa-config.ts` (inclusive este). Se a tabela não existir no teste, verificar se o runner carrega o `medusa-config.ts` do cwd (`inApp: true`) e registrar.

- [ ] **Step 7: Rodar** — `npm run test:integration:http` (com o prefixo) → `saude` + `conjunto-poc` + `conjunto-modulo` passando; `tsc` sem erros novos.

- [ ] **Step 8: Commit**
```bash
git add apps/backend/src/modules/beneficio-conjunto apps/backend/medusa-config.ts apps/backend/integration-tests/http/conjunto-modulo.spec.ts
git commit -m "feat(backend): módulo beneficio-conjunto (regra, par, curado) com migração e registro"
```

---

### Task 2: Função pura `montarConjuntos` (+ `raizPorCategoria`, `payloadPromocao`) com testes unitários

**Files:**
- Create: `apps/backend/src/modules/beneficio-conjunto/utils/montar-conjuntos.ts`, `utils/categorias.ts`, `utils/promocao.ts`
- Test: `apps/backend/src/modules/beneficio-conjunto/__tests__/montar-conjuntos.unit.spec.ts`, `categorias.unit.spec.ts`, `promocao.unit.spec.ts`

**Interfaces:**
- Produces: `montarConjuntos(linhas: Linha[], regras: Regra[], pares: Par[], curados: Curado[]): ResultadoMontagem`; `regraEfetiva(regras, collection_id): Regra | null`; `descontoDoConjunto(regra, precos: number[]): number[]`; `raizPorCategoria(cats: { id; handle; parent_category_id }[]): Map<string, string>`; `payloadPromocao(regra: Regra, nUnidades: number)`; `CODIGO_PREFIXO`, `REGRA_EXCLUSAO`, `nUnidadesDaRegra(regra, curados)`.

- [ ] **Step 1: Testes de `montarConjuntos` (falhando)** — `__tests__/montar-conjuntos.unit.spec.ts`:

```ts
import { descontoDoConjunto, montarConjuntos, regraEfetiva } from "../utils/montar-conjuntos"
import type { Curado, Linha, Par, Regra } from "../utils/tipos"

const R = (p: Partial<Regra> & Pick<Regra, "id" | "escopo">): Regra =>
  ({ nome: p.id, collection_id: null, tipo_desconto: "total_percentual", valor: 10, ativa: true, promotion_id: null, ...p })
const PADRAO = R({ id: "creg_padrao", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20 })
const PARES: Par[] = [{ id: "p1", categoria_a: "leggings", categoria_b: "tops", ativo: true }, { id: "p2", categoria_a: "shorts", categoria_b: "tops", ativo: true }]
const L = (item_id: string, product_id: string, categoria_raiz: string | null, preco: number, quantidade = 1, collection_id: string | null = "col_a"): Linha =>
  ({ item_id, product_id, collection_id, categoria_raiz, preco_unitario: preco, quantidade })

describe("regraEfetiva", () => {
  it("exceção da coleção vence o padrão; exceção inativa = sem benefício; sem padrão ativo = null", () => {
    const exc = R({ id: "creg_a", escopo: "colecao", collection_id: "col_a", valor: 15 })
    expect(regraEfetiva([PADRAO, exc], "col_a")?.id).toBe("creg_a")
    expect(regraEfetiva([PADRAO, exc], "col_b")?.id).toBe("creg_padrao")
    expect(regraEfetiva([PADRAO, { ...exc, ativa: false }], "col_a")).toBeNull()
    expect(regraEfetiva([{ ...PADRAO, ativa: false }], "col_b")).toBeNull()
    expect(regraEfetiva([PADRAO], null)).toBeNull()
  })
})

describe("descontoDoConjunto", () => {
  it("menor peça %: só a mais barata; empate → primeira", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_percentual", valor: 20 }, [18900, 25900])).toEqual([3780, 0])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_percentual", valor: 20 }, [25900, 18900, 18900])).toEqual([0, 3780, 0])
  })
  it("menor peça R$: limitado ao preço da unidade", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_valor", valor: 5000 }, [18900, 25900])).toEqual([5000, 0])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "menor_peca_valor", valor: 99900 }, [18900, 25900])).toEqual([18900, 0])
  })
  it("total %: em cada unidade; total R$: repartido em partes iguais, arredondado, limitado", () => {
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_percentual", valor: 10 }, [18900, 25900])).toEqual([1890, 2590])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 4500 }, [18900, 25900])).toEqual([2250, 2250])
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 4501 }, [18900, 25900])).toEqual([2251, 2251]) // round(2250.5)
    expect(descontoDoConjunto({ ...PADRAO, tipo_desconto: "total_valor", valor: 100000 }, [18900, 25900])).toEqual([18900, 25900])
  })
})

describe("montarConjuntos — pares de coleção", () => {
  it("1 top + 1 legging → 1 conjunto, desconto na menor peça", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_leg", "p_leg", "leggings", 25900)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(1)
    expect(r.conjuntos[0]).toMatchObject({ tipo: "colecao", regra_id: "creg_padrao" })
    expect(r.conjuntos[0].unidades).toEqual([
      { item_id: "i_leg", product_id: "p_leg", preco_unitario: 25900, desconto_unitario: 0 },
      { item_id: "i_top", product_id: "p_top", preco_unitario: 18900, desconto_unitario: 3780 },
    ])
    expect(r.oportunidades).toEqual([])
  })
  it("2 tops + 1 legging + 1 short → 2 conjuntos; nada sobra", () => {
    const r = montarConjuntos([L("i_t1", "p_t", "tops", 18900, 2), L("i_leg", "p_leg", "leggings", 25900), L("i_sh", "p_sh", "shorts", 15900)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(2)
    expect(r.oportunidades).toEqual([])
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(3780 + 3180) // menor de (top, legging) = top 189; menor de (top, short) = short 159
  })
  it("1 top + 2 leggings → 1 conjunto + oportunidade de top", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_leg", "p_leg", "leggings", 25900, 2)], [PADRAO], PARES, [])
    expect(r.conjuntos).toHaveLength(1)
    expect(r.oportunidades).toEqual([{ collection_id: "col_a", categoria_faltante: "tops", a_partir_do_item_id: "i_leg" }])
  })
  it("pareamento favorece a cliente: 2 tops (100, 300) + 2 leggings (200, 400), menor peça 10%", () => {
    const r = montarConjuntos([L("t1", "pt1", "tops", 10000), L("t2", "pt2", "tops", 30000), L("l1", "pl1", "leggings", 20000), L("l2", "pl2", "leggings", 40000)], [{ ...PADRAO, valor: 10 }], PARES, [])
    // (300,400) e (100,200): mínimos 300+100 = 400 → desconto 4000. Alternativa (300,200)+(100,400): 200+100 = 300 → 3000.
    const somaDesc = r.conjuntos.flatMap((c) => c.unidades).reduce((s, u) => s + u.desconto_unitario, 0)
    expect(somaDesc).toBe(4000)
  })
  it("coleções diferentes não pareiam; categoria fora dos pares não pareia; sem coleção não pareia", () => {
    expect(montarConjuntos([L("a", "pa", "tops", 100, 1, "col_a"), L("b", "pb", "leggings", 100, 1, "col_b")], [PADRAO], PARES, []).conjuntos).toEqual([])
    expect(montarConjuntos([L("a", "pa", "tops", 100), L("b", "pb", "macaquinhos", 100)], [PADRAO], PARES, []).conjuntos).toEqual([])
    expect(montarConjuntos([L("a", "pa", "tops", 100, 1, null), L("b", "pb", "leggings", 100, 1, null)], [PADRAO], PARES, []).conjuntos).toEqual([])
  })
  it("exceção inativa da coleção → nada e sem oportunidade", () => {
    const exc = R({ id: "creg_a", escopo: "colecao", collection_id: "col_a", ativa: false })
    const r = montarConjuntos([L("a", "pa", "tops", 100), L("b", "pb", "leggings", 100)], [PADRAO, exc], PARES, [])
    expect(r.conjuntos).toEqual([])
    expect(r.oportunidades).toEqual([])
  })
})

describe("montarConjuntos — curados", () => {
  const RC = R({ id: "creg_cur", escopo: "curado", tipo_desconto: "total_valor", valor: 5000 })
  const CUR: Curado = { id: "ccur_1", nome: "Look", handle: "look", capa_url: null, product_ids: ["p_top", "p_leg_b"], regra_id: "creg_cur", ativo: true, ordem: 0 }
  it("curado cruza coleções e consome unidades antes do par de coleção", () => {
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900), L("i_legb", "p_leg_b", "leggings", 25900, 1, "col_b"), L("i_lega", "p_leg_a", "leggings", 25900)], [PADRAO, RC], PARES, [CUR])
    expect(r.conjuntos.map((c) => c.tipo)).toEqual(["curado"])
    expect(r.conjuntos[0].unidades.map((u) => u.desconto_unitario)).toEqual([2500, 2500])
    expect(r.oportunidades).toEqual([{ collection_id: "col_a", categoria_faltante: "tops", a_partir_do_item_id: "i_lega" }])
  })
  it("curado precisa de todos os produtos; forma quantos couberem", () => {
    expect(montarConjuntos([L("i_top", "p_top", "tops", 18900, 2)], [RC], [], [CUR]).conjuntos).toEqual([])
    const r = montarConjuntos([L("i_top", "p_top", "tops", 18900, 2), L("i_legb", "p_leg_b", "leggings", 25900, 3, "col_b")], [RC], [], [CUR])
    expect(r.conjuntos).toHaveLength(2)
  })
  it("curado inativo ou com regra inativa é ignorado", () => {
    expect(montarConjuntos([L("i_top", "p_top", "tops", 1), L("i_legb", "p_leg_b", "leggings", 1, 1, "col_b")], [RC], [], [{ ...CUR, ativo: false }]).conjuntos).toEqual([])
    expect(montarConjuntos([L("i_top", "p_top", "tops", 1), L("i_legb", "p_leg_b", "leggings", 1, 1, "col_b")], [{ ...RC, ativa: false }], [], [CUR]).conjuntos).toEqual([])
  })
})
```

- [ ] **Step 2: Rodar e ver falhar** — `npm run test:unit` (com o prefixo) → FAIL (módulo inexistente).

- [ ] **Step 3: Implementar `montar-conjuntos.ts`**

```ts
// Núcleo do Benefício Conjunto (spec §5). Puro: sem I/O, sem Medusa. Centavos inteiros.
import type { ConjuntoFormado, Curado, Linha, Oportunidade, Par, Regra, ResultadoMontagem } from "./tipos"

type Unidade = { uid: string; item_id: string; product_id: string; collection_id: string | null; categoria_raiz: string | null; preco: number }

const porPrecoDesc = (a: Unidade, b: Unidade) => b.preco - a.preco || a.uid.localeCompare(b.uid)
const porPrecoAsc = (a: Unidade, b: Unidade) => a.preco - b.preco || a.uid.localeCompare(b.uid)

export function regraEfetiva(regras: Regra[], collection_id: string | null): Regra | null {
  if (!collection_id) return null
  const excecao = regras.find((r) => r.escopo === "colecao" && r.collection_id === collection_id)
  if (excecao) return excecao.ativa ? excecao : null
  const padrao = regras.find((r) => r.escopo === "padrao")
  return padrao?.ativa ? padrao : null
}

// Desconto por unidade de um conjunto, na ordem dos preços recebidos. Nunca passa do preço da unidade.
export function descontoDoConjunto(regra: Regra, precos: number[]): number[] {
  const n = precos.length
  const zeros = precos.map(() => 0)
  if (!n) return zeros
  const idxMin = precos.reduce((m, p, i) => (p < precos[m] ? i : m), 0)
  switch (regra.tipo_desconto) {
    case "menor_peca_percentual": {
      const d = zeros.slice(); d[idxMin] = Math.min(precos[idxMin], Math.round((precos[idxMin] * regra.valor) / 100)); return d
    }
    case "menor_peca_valor": {
      const d = zeros.slice(); d[idxMin] = Math.min(precos[idxMin], regra.valor); return d
    }
    case "total_percentual":
      return precos.map((p) => Math.min(p, Math.round((p * regra.valor) / 100)))
    case "total_valor": {
      const porUnidade = Math.round(regra.valor / n)
      return precos.map((p) => Math.min(p, porUnidade))
    }
  }
}

function expandir(linhas: Linha[]): Unidade[] {
  const out: Unidade[] = []
  for (const l of linhas) for (let i = 0; i < l.quantidade; i++) out.push({ uid: `${l.item_id}#${i}`, item_id: l.item_id, product_id: l.product_id, collection_id: l.collection_id, categoria_raiz: l.categoria_raiz, preco: l.preco_unitario })
  return out
}

function fechar(id: string, tipo: ConjuntoFormado["tipo"], regra: Regra, unidades: Unidade[]): ConjuntoFormado {
  const descontos = descontoDoConjunto(regra, unidades.map((u) => u.preco))
  return { id, tipo, regra_id: regra.id, unidades: unidades.map((u, i) => ({ item_id: u.item_id, product_id: u.product_id, preco_unitario: u.preco, desconto_unitario: descontos[i] })) }
}

export function montarConjuntos(linhas: Linha[], regras: Regra[], pares: Par[], curados: Curado[]): ResultadoMontagem {
  const livres = new Set(expandir(linhas).map((u) => [u.uid, u] as const).map(([, u]) => u))
  const conjuntos: ConjuntoFormado[] = []
  let seq = 0

  // 1) Curados primeiro, na ordem cadastrada; consomem as unidades mais baratas de cada produto.
  for (const cur of curados.filter((c) => c.ativo).sort((a, b) => a.ordem - b.ordem || a.id.localeCompare(b.id))) {
    const regra = regras.find((r) => r.id === cur.regra_id)
    if (!regra?.ativa) continue
    for (;;) {
      const escolhidas: Unidade[] = []
      for (const pid of cur.product_ids) {
        const cand = Array.from(livres).filter((u) => u.product_id === pid && !escolhidas.includes(u)).sort(porPrecoAsc)[0]
        if (!cand) break
        escolhidas.push(cand)
      }
      if (escolhidas.length < cur.product_ids.length) break
      escolhidas.forEach((u) => livres.delete(u))
      conjuntos.push(fechar(`${cur.id}#${seq++}`, "curado", regra, escolhidas))
    }
  }

  // 2) Pares de coleção: n unidades mais caras de cada lado, pareadas em ordem decrescente (ruling 5).
  const colecoes = Array.from(new Set(Array.from(livres).map((u) => u.collection_id).filter((c): c is string => !!c))).sort()
  const oportunidades: Oportunidade[] = []
  for (const col of colecoes) {
    const regra = regraEfetiva(regras, col)
    if (!regra) continue
    for (const par of pares.filter((p) => p.ativo)) {
      const ladoA = Array.from(livres).filter((u) => u.collection_id === col && u.categoria_raiz === par.categoria_a).sort(porPrecoDesc)
      const ladoB = Array.from(livres).filter((u) => u.collection_id === col && u.categoria_raiz === par.categoria_b).sort(porPrecoDesc)
      const n = Math.min(ladoA.length, ladoB.length)
      for (let i = 0; i < n; i++) {
        livres.delete(ladoA[i]); livres.delete(ladoB[i])
        conjuntos.push(fechar(`${col}:${par.categoria_a}+${par.categoria_b}#${seq++}`, "colecao", regra, [ladoA[i], ladoB[i]]))
      }
    }
    // 3) Oportunidades: unidade livre de um lado do par sem parceira do outro lado.
    for (const par of pares.filter((p) => p.ativo)) {
      for (const [de, falta] of [[par.categoria_a, par.categoria_b], [par.categoria_b, par.categoria_a]] as const) {
        const sobra = Array.from(livres).filter((u) => u.collection_id === col && u.categoria_raiz === de).sort(porPrecoAsc)[0]
        if (!sobra) continue
        if (oportunidades.some((o) => o.collection_id === col && o.categoria_faltante === falta)) continue
        oportunidades.push({ collection_id: col, categoria_faltante: falta, a_partir_do_item_id: sobra.item_id })
      }
    }
  }
  return { conjuntos, oportunidades }
}
```
Observação: a primeira linha de `montarConjuntos` pode ser simplesmente `const livres = new Set(expandir(linhas))`. No teste "1 top + 1 legging", a ordem das unidades no conjunto é `[ladoA[i], ladoB[i]]` = legging (categoria_a = `leggings`) depois top — por isso o `toEqual` do teste espera legging primeiro. Pares guardados ordenados alfabeticamente (`leggings` < `tops`) — a Task 6 normaliza na gravação.

- [ ] **Step 4: `categorias.ts` + teste**

```ts
// Mapa id de categoria → handle da categoria RAIZ (filha conta como a mãe; spec §4.2).
export type CategoriaMin = { id: string; handle: string; parent_category_id: string | null }
export function raizPorCategoria(cats: CategoriaMin[]): Map<string, string> {
  const porId = new Map(cats.map((c) => [c.id, c]))
  const out = new Map<string, string>()
  for (const c of cats) {
    let atual = c, guarda = 0
    while (atual.parent_category_id && porId.has(atual.parent_category_id) && guarda++ < 20) atual = porId.get(atual.parent_category_id)!
    out.set(c.id, atual.handle)
  }
  return out
}
```
Teste `categorias.unit.spec.ts`: raiz mapeia para si; filha `oculos` (pai `acessorios`) → `acessorios`; pai desconhecido → o próprio handle.

- [ ] **Step 5: `promocao.ts` + teste**

```ts
import type { Curado, Regra } from "./tipos"

export const CODIGO_PREFIXO = "CONJUNTO-"
export const ATRIBUTO = "items.conjunto_desconto"
export const MARCA_LIVRE = "nenhum"
export const MARCA_EM_CONJUNTO = "conjunto"
export const REGRA_EXCLUSAO = { attribute: ATRIBUTO, operator: "eq", values: [MARCA_LIVRE] } as const
export const MAX_QUANTITY = 1000

export const codigoDaRegra = (regraId: string) => `${CODIGO_PREFIXO}${regraId}`

// Quantas unidades tem um conjunto desta regra (para repartir `total_valor`): 2 no par; n produtos no curado.
export function nUnidadesDaRegra(regra: Regra, curados: Curado[]): number {
  if (regra.escopo !== "curado") return 2
  return Math.max(2, curados.find((c) => c.regra_id === regra.id)?.product_ids.length ?? 2)
}

// Payload da promoção automática (spec §6.2, contrato da F0). Valor em unidades da moeda.
export function payloadPromocao(regra: Regra, nUnidades: number) {
  const percentual = regra.tipo_desconto.endsWith("percentual")
  const valor = percentual ? regra.valor : regra.tipo_desconto === "total_valor" ? Math.round(regra.valor / nUnidades) / 100 : regra.valor / 100
  return {
    code: codigoDaRegra(regra.id),
    type: "standard" as const,
    is_automatic: true,
    status: regra.ativa ? ("active" as const) : ("inactive" as const),
    application_method: {
      type: percentual ? ("percentage" as const) : ("fixed" as const),
      target_type: "items" as const,
      allocation: "each" as const,
      max_quantity: MAX_QUANTITY,
      value: valor,
      currency_code: "brl",
      target_rules: [{ attribute: ATRIBUTO, operator: "eq" as const, values: [regra.id] }],
    },
  }
}
```
Teste `promocao.unit.spec.ts`: os quatro tipos (`menor_peca_valor` 5000 → `fixed` 50; `total_valor` 4500 n=2 → 22.5; percentuais → `percentage` com o inteiro); `status` inativo; `code` com prefixo; `nUnidadesDaRegra` de curado com 3 produtos = 3.

- [ ] **Step 6: Rodar** — `npm run test:unit` → todos passando (≈ 16 testes); `tsc` sem erros novos.

- [ ] **Step 7: Commit**
```bash
git add apps/backend/src/modules/beneficio-conjunto/utils apps/backend/src/modules/beneficio-conjunto/__tests__
git commit -m "feat(backend): montarConjuntos, raizPorCategoria e payloadPromocao (puros, testados)"
```

---

### Task 3: Sincronização das promoções automáticas

**Files:**
- Create: `apps/backend/src/modules/beneficio-conjunto/sincronizar-promocao.ts`
- Create: `apps/backend/integration-tests/http/conjunto-promocao.spec.ts`

**Interfaces:**
- Consumes: `payloadPromocao`, `nUnidadesDaRegra`, `codigoDaRegra`; `createPromotionsWorkflow`, `updatePromotionsWorkflow` (`@medusajs/medusa/core-flows`); `Modules.PROMOTION` service (`retrievePromotion`, `listPromotions`).
- Produces: `sincronizarPromocao(container, regraId): Promise<{ promotion_id: string }>`; `sincronizarTodas(container): Promise<number>`.

- [ ] **Step 1: Implementar**

```ts
import { Modules } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { createPromotionsWorkflow, updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { codigoDaRegra, nUnidadesDaRegra, payloadPromocao } from "./utils/promocao"
import type { Curado, Regra } from "./utils/tipos"

// Garante que a regra tem UMA promoção automática coerente (spec §6.2, ruling 6): cria se não existe
// (ou se foi apagada à mão), atualiza tipo/valor/status se existe. A regra-alvo (eq regra_id) nunca muda.
export async function sincronizarPromocao(container: MedusaContainer, regraId: string): Promise<{ promotion_id: string }> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const promo: any = container.resolve(Modules.PROMOTION)
  const regra = (await svc.retrieveConjuntoRegra(regraId)) as Regra
  const curados = (await svc.listConjuntoCurados({ regra_id: regraId })) as Curado[]
  const payload = payloadPromocao(regra, nUnidadesDaRegra(regra, curados))

  let existente: any = null
  if (regra.promotion_id) existente = await promo.retrievePromotion(regra.promotion_id, { relations: ["application_method"] }).catch(() => null)
  if (!existente) {
    const [porCodigo] = await promo.listPromotions({ code: codigoDaRegra(regra.id) }, { relations: ["application_method"] })
    existente = porCodigo ?? null
  }
  if (!existente) {
    const { result } = await createPromotionsWorkflow(container).run({ input: { promotionsData: [payload] } })
    const criada = result[0]
    await svc.updateConjuntoRegras({ id: regra.id, promotion_id: criada.id })
    return { promotion_id: criada.id }
  }
  await updatePromotionsWorkflow(container).run({
    input: { promotionsData: [{ id: existente.id, status: payload.status, application_method: { type: payload.application_method.type, value: payload.application_method.value, allocation: "each", max_quantity: payload.application_method.max_quantity, target_type: "items", currency_code: "brl" } }] },
  })
  if (regra.promotion_id !== existente.id) await svc.updateConjuntoRegras({ id: regra.id, promotion_id: existente.id })
  return { promotion_id: existente.id }
}

export async function sincronizarTodas(container: MedusaContainer): Promise<number> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const regras = (await svc.listConjuntoRegras({})) as Regra[]
  for (const r of regras) await sincronizarPromocao(container, r.id)
  return regras.length
}
```
Se `updatePromotionsWorkflow` rejeitar `application_method.type` na atualização (DTO restrito), remover `type` do update e, quando o tipo mudar (percentual ↔ fixo), desativar a promoção antiga (`status: inactive`, código renomeado para `CONJUNTO-<id>-old-<timestamp>`) e criar nova — registrar o que valeu. `createPromotionsWorkflow` pode exigir `application_method.currency_code`/`allocation` exatamente como na F0 (já está).

- [ ] **Step 2: Teste de integração** — `conjunto-promocao.spec.ts` (usa `criarAdmin` para nada; só container):
```ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { Modules } from "@medusajs/framework/utils"
import { BENEFICIO_CONJUNTO_MODULE } from "../../src/modules/beneficio-conjunto"
import { sincronizarPromocao } from "../../src/modules/beneficio-conjunto/sincronizar-promocao"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true, env: {}, disableAutoTeardown: true,
  testSuite: ({ getContainer }) => {
    it("cria a promoção automática da regra, atualiza valor/status e recria se apagada", async () => {
      const c = getContainer(); const svc: any = c.resolve(BENEFICIO_CONJUNTO_MODULE); const promo: any = c.resolve(Modules.PROMOTION)
      const regra = await svc.createConjuntoRegras({ nome: "Padrão", escopo: "padrao", tipo_desconto: "menor_peca_percentual", valor: 20, ativa: true })
      const { promotion_id } = await sincronizarPromocao(c, regra.id)
      let p = await promo.retrievePromotion(promotion_id, { relations: ["application_method", "application_method.target_rules"] })
      expect(p.code).toBe(`CONJUNTO-${regra.id}`); expect(p.is_automatic).toBe(true); expect(p.status).toBe("active")
      expect(p.application_method).toMatchObject({ type: "percentage", target_type: "items", allocation: "each", max_quantity: 1000 })
      expect(Number(p.application_method.value)).toBe(20)
      expect(p.application_method.target_rules[0]).toMatchObject({ attribute: "items.conjunto_desconto", operator: "eq" })
      await svc.updateConjuntoRegras({ id: regra.id, valor: 15, ativa: false })
      await sincronizarPromocao(c, regra.id)
      p = await promo.retrievePromotion(promotion_id, { relations: ["application_method"] })
      expect(Number(p.application_method.value)).toBe(15); expect(p.status).toBe("inactive")
      await promo.deletePromotions([promotion_id])
      const { promotion_id: novo } = await sincronizarPromocao(c, regra.id)
      expect(novo).not.toBe(promotion_id)
      expect((await svc.retrieveConjuntoRegra(regra.id)).promotion_id).toBe(novo)
    })
    it("total_valor reparte por unidade: 45,00 num par vira fixed 22,50", async () => {
      const c = getContainer(); const svc: any = c.resolve(BENEFICIO_CONJUNTO_MODULE); const promo: any = c.resolve(Modules.PROMOTION)
      const regra = await svc.createConjuntoRegras({ nome: "Col", escopo: "colecao", collection_id: "col_t", tipo_desconto: "total_valor", valor: 4500, ativa: true })
      const { promotion_id } = await sincronizarPromocao(c, regra.id)
      const p = await promo.retrievePromotion(promotion_id, { relations: ["application_method"] })
      expect(p.application_method.type).toBe("fixed"); expect(Number(p.application_method.value)).toBeCloseTo(22.5, 2)
    })
  },
})
```
Se `deletePromotions` soft-deletar e `listPromotions({ code })` ainda devolver a apagada, filtrar `deleted_at` (ou usar `deletePromotionsWorkflow`) — registrar.

- [ ] **Step 3: Rodar** — integração toda passando; `tsc` limpo (sem erros novos).

- [ ] **Step 4: Commit**
```bash
git add apps/backend/src/modules/beneficio-conjunto/sincronizar-promocao.ts apps/backend/integration-tests/http/conjunto-promocao.spec.ts
git commit -m "feat(backend): sincronização da promoção automática por regra de conjunto"
```

---

### Task 4: Gancho real do carrinho (`avaliarCarrinho` + `conjunto-marcar`) e testes de carrinho

**Files:**
- Create: `apps/backend/src/modules/beneficio-conjunto/avaliar-carrinho.ts`
- Create: `apps/backend/src/workflows/hooks/conjunto-marcar.ts`
- Delete: `apps/backend/src/workflows/hooks/conjunto-poc.ts`, `apps/backend/integration-tests/http/conjunto-poc.spec.ts`
- Modify: `apps/backend/integration-tests/helpers/catalogo.ts` (catálogo ampliado)
- Create: `apps/backend/integration-tests/http/conjunto-carrinho.spec.ts`

**Interfaces:**
- Consumes: serviço (`carregarAtivos`), `raizPorCategoria`, `montarConjuntos`, `query.graph` (`ContainerRegistrationKeys.QUERY`), constantes de `promocao.ts`.
- Produces: `avaliarCarrinho(container, cart): Promise<{ resultado: ResultadoMontagem; linhas: Linha[] }>`; `marcarContexto(items, resultado)` (puro, no mesmo arquivo, exportado para teste); gancho registrado.
- Catálogo de teste: `criarCatalogoBase` passa a criar coleções `Blackout` (`col_black`) e `Lumière` (`col_lum`), categorias raiz `tops`, `leggings`, `shorts`, `macaquinhos` (+ filha `oculos` de `acessorios`), produtos: `top` (189, Blackout, tops), `legging` (259, Blackout, leggings), `short` (159, Blackout, shorts), `topLum` (199, Lumière, tops), `macaquinho` (299, Blackout, macaquinhos); devolve também `collections: { black, lum }` e `categorias: { tops, leggings, shorts, macaquinhos }` (ids).

- [ ] **Step 1: Ampliar `helpers/catalogo.ts`** — `POST /admin/collections { title, handle }`, `POST /admin/product-categories { name, handle, is_active: true, parent_category_id? }`, produtos com `collection_id` e `categories: [{ id }]`. Manter `top`/`legging` com os preços da F0. Exportar tipo `CatalogoBase` ampliado.

- [ ] **Step 2: `avaliar-carrinho.ts`**

```ts
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { MedusaContainer } from "@medusajs/framework/types"
import { BENEFICIO_CONJUNTO_MODULE } from "./index"
import { raizPorCategoria, type CategoriaMin } from "./utils/categorias"
import { montarConjuntos } from "./utils/montar-conjuntos"
import { MARCA_EM_CONJUNTO, MARCA_LIVRE } from "./utils/promocao"
import type { Linha, ResultadoMontagem } from "./utils/tipos"

type ItemCtx = Record<string, any> & { id: string; quantity: number | string; subtotal: number | string; product?: { id?: string; collection_id?: string | null; categories?: { id: string }[] | null } | null }

// Cache curto da árvore de categorias (muda raramente; o gancho roda a cada mudança de carrinho).
let cacheCats: { em: number; mapa: Map<string, string> } | null = null
async function mapaRaizes(container: MedusaContainer): Promise<Map<string, string>> {
  if (cacheCats && Date.now() - cacheCats.em < 60_000) return cacheCats.mapa
  const query: any = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "product_category", fields: ["id", "handle", "parent_category_id"] })
  const mapa = raizPorCategoria(data as CategoriaMin[])
  cacheCats = { em: Date.now(), mapa }
  return mapa
}

export function linhasDoCarrinho(items: ItemCtx[], raizes: Map<string, string>): Linha[] {
  return items.map((it) => {
    const q = Math.max(1, Number(it.quantity))
    const unit = Number(it.subtotal) / q
    const cat = (it.product?.categories ?? []).map((c) => raizes.get(c.id)).find((h): h is string => !!h) ?? null
    return { item_id: it.id, product_id: it.product?.id ?? "", collection_id: it.product?.collection_id ?? null, categoria_raiz: cat, preco_unitario: Math.round(unit * 100), quantidade: q }
  })
}

export async function avaliarCarrinho(container: MedusaContainer, cart: { items?: ItemCtx[] | null }): Promise<{ resultado: ResultadoMontagem; linhas: Linha[] }> {
  const svc: any = container.resolve(BENEFICIO_CONJUNTO_MODULE)
  const [{ regras, pares, curados }, raizes] = await Promise.all([svc.carregarAtivos(), mapaRaizes(container)])
  const linhas = linhasDoCarrinho(cart.items ?? [], raizes)
  return { resultado: montarConjuntos(linhas, regras, pares, curados), linhas }
}

// Contexto para o motor de promoções (spec §6.1, ruling 4): cada linha vira até 3 entradas com o mesmo id —
// unidades com desconto (conjunto_desconto = regra_id), em conjunto sem desconto ("conjunto") e livres ("nenhum").
export function marcarContexto(items: ItemCtx[], resultado: ResultadoMontagem): ItemCtx[] {
  const porItem = new Map<string, Map<string, number>>() // item_id → marca → unidades
  const conjuntoPorItem = new Map<string, string>()
  for (const c of resultado.conjuntos) for (const u of c.unidades) {
    const marca = u.desconto_unitario > 0 ? c.regra_id : MARCA_EM_CONJUNTO
    const m = porItem.get(u.item_id) ?? new Map<string, number>()
    m.set(marca, (m.get(marca) ?? 0) + 1)
    porItem.set(u.item_id, m)
    conjuntoPorItem.set(u.item_id, c.id)
  }
  const saida: ItemCtx[] = []
  for (const it of items) {
    const q = Math.max(1, Number(it.quantity)); const unit = Number(it.subtotal) / q
    const marcas = porItem.get(it.id)
    if (!marcas) { saida.push({ ...it, conjunto_desconto: MARCA_LIVRE }); continue }
    let usadas = 0
    for (const [marca, n] of Array.from(marcas.entries())) {
      saida.push({ ...it, quantity: n, subtotal: unit * n, conjunto_desconto: marca, conjunto_id: conjuntoPorItem.get(it.id) })
      usadas += n
    }
    if (usadas < q) saida.push({ ...it, quantity: q - usadas, subtotal: unit * (q - usadas), conjunto_desconto: MARCA_LIVRE })
  }
  return saida
}
```

- [ ] **Step 3: Gancho `conjunto-marcar.ts`** (e apagar `conjunto-poc.ts`):
```ts
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { avaliarCarrinho, marcarContexto } from "../../modules/beneficio-conjunto/avaliar-carrinho"

// Benefício Conjunto (spec §6.1): marca as unidades do carrinho antes de o motor de promoções avaliar.
// Nunca lança — carrinho sem benefício é melhor que carrinho quebrado.
updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }, { container }) => {
  try {
    const items = ((cart as any)?.items ?? []) as any[]
    if (!items.length) return new StepResponse({})
    const { resultado } = await avaliarCarrinho(container, cart as any)
    return new StepResponse({ items: marcarContexto(items, resultado) })
  } catch (e) {
    console.error("[conjunto] gancho", e)
    return new StepResponse({})
  }
})
```

- [ ] **Step 4: Testes de carrinho** — `conjunto-carrinho.spec.ts` (substitui o PoC; mesmo esqueleto: `criarAdmin(api, getContainer())`, `criarCatalogoBase`, `disableAutoTeardown: true`, helper `novoCarrinho`). Em `beforeAll`, criar via serviço: regra padrão `menor_peca_percentual` 20 ativa + `sincronizarPromocao`; pares `leggings+tops`, `shorts+tops`. Casos (valores em R$):
  1. **Par simples, menor peça 20%**: top 189 + legging 259 → `CONJUNTO-<id>` = 37,80 no top; legging sem ajuste; `discount_total` 37,80.
  2. **Troca de tipo**: atualizar regra para `total_percentual` 10 + sincronizar → novo carrinho igual → 18,90 + 25,90 = 44,80. Depois `total_valor` 4500 → 22,50 + 22,50 = 45,00. Depois `menor_peca_valor` 5000 → 50,00 no top. (Um carrinho novo por tipo.)
  3. **Máximo de pares**: top ×2 + legging + short (regra `menor_peca_percentual` 20) → desconto = 20% de 189 + 20% de 159 = 37,80 + 31,80 = 69,60; `discount_total` 69,60.
  4. **Sobra**: top ×1 + legging ×2 → 37,80 (só um conjunto).
  5. **Coleções diferentes**: top (Blackout) + topLum (Lumière) → 0; top + legging + macaquinho → 37,80 (macaquinho fora).
  6. **Exceção inativa**: criar regra `colecao` para `col_black` inativa → top + legging → 0; depois ativar com `total_percentual` 10 e sincronizar → 44,80.
  7. **Curado antes do par**: curado `{ top, topLum }` com regra `total_valor` 4000 (20,00 cada) → carrinho top + topLum + legging → curado formado (40,00) e legging sem par (regra padrão não fecha porque o top foi consumido) → `discount_total` 40,00.
  8. **Cupom**: com CUPOM10 (itens, `each`, `max_quantity` 1000, regra `items.conjunto_desconto eq nenhum`): top + legging + macaquinho → conjunto 37,80 no top; cupom só no macaquinho 29,90; **legging (em conjunto, sem desconto próprio) não recebe cupom**; total 67,70.
  Asserções com `toBeCloseTo(x, 2)`; ler `?fields=*items,*items.adjustments`.

- [ ] **Step 5: Rodar** — unit + integração passando; `tsc` sem erros novos. Se o caso 8 mostrar cupom na legging, a marca `"conjunto"` não chegou ao motor: conferir `marcarContexto`.

- [ ] **Step 6: Commit**
```bash
git rm -q apps/backend/src/workflows/hooks/conjunto-poc.ts apps/backend/integration-tests/http/conjunto-poc.spec.ts
git add apps/backend/src/modules/beneficio-conjunto/avaliar-carrinho.ts apps/backend/src/workflows/hooks/conjunto-marcar.ts apps/backend/integration-tests
git commit -m "feat(backend): gancho real do Benefício Conjunto no carrinho (substitui a PoC) + testes dos 4 tipos, pares, curado e cupom"
```

---

### Task 5: Conversão de cupons (ganchos de promoção) e reconciliação

**Files:**
- Modify: `apps/backend/src/modules/beneficio-conjunto/sincronizar-promocao.ts` (acrescenta `converterCupom`, `converterTodosCupons`, `reconciliar`)
- Create: `apps/backend/src/workflows/hooks/conjunto-cupom.ts`
- Create: `apps/backend/integration-tests/http/conjunto-cupom.spec.ts`

**Interfaces:**
- Consumes: `createPromotionsWorkflow.hooks.promotionsCreated` / `updatePromotionsWorkflow.hooks.promotionsUpdated` (input `{ promotions }` já criadas/atualizadas); `Modules.PROMOTION` (`retrievePromotion`, `updatePromotions`, `addPromotionTargetRules`).
- Produces: `converterCupom(container, promotionId): Promise<"convertido" | "ja_ok" | "ignorado">`; `reconciliar(container): Promise<{ regras: number; cupons: number }>`.

- [ ] **Step 1: `converterCupom`** (em `sincronizar-promocao.ts`):
```ts
// Cupom nunca alcança unidade em conjunto (spec §6.4, F0 D/D2/D3): cupom de PEDIDO vira cupom de ITENS
// `across` (sem max_quantity) e todo cupom não-conjunto ganha a regra-alvo `items.conjunto_desconto eq nenhum`.
export async function converterCupom(container: MedusaContainer, promotionId: string): Promise<"convertido" | "ja_ok" | "ignorado"> {
  const promo: any = container.resolve(Modules.PROMOTION)
  const p = await promo.retrievePromotion(promotionId, { relations: ["application_method", "application_method.target_rules"] })
  if (!p?.code || p.code.startsWith(CODIGO_PREFIXO) || !p.application_method) return "ignorado"
  let mudou = false
  if (p.application_method.target_type === "order") {
    await promo.updatePromotions([{ id: p.id, application_method: { id: p.application_method.id, target_type: "items", allocation: "across", max_quantity: null } }])
    mudou = true
  }
  const temExclusao = (p.application_method.target_rules ?? []).some((r: any) => r.attribute === ATRIBUTO && r.operator === "eq" && (r.values ?? []).some((v: any) => (v.value ?? v) === MARCA_LIVRE))
  if (!temExclusao) {
    await promo.addPromotionTargetRules(p.id, [{ attribute: ATRIBUTO, operator: "eq", values: [MARCA_LIVRE] }])
    mudou = true
  }
  return mudou ? "convertido" : "ja_ok"
}
export async function converterTodosCupons(container: MedusaContainer): Promise<number> { /* listPromotions({}) paginado, chama converterCupom, conta "convertido" */ }
export async function reconciliar(container: MedusaContainer) { return { regras: await sincronizarTodas(container), cupons: await converterTodosCupons(container) } }
```
Se `updatePromotions` do serviço não aceitar `application_method.id`/`max_quantity: null`, usar `updatePromotionsWorkflow` com o mesmo payload; se a troca de `target_type` for rejeitada em atualização, registrar e adotar: desativar o cupom de pedido (`status: inactive`) e criar um cupom de itens com o mesmo código sufixado — **e reportar**, porque muda a experiência do admin.

- [ ] **Step 2: Ganchos** — `conjunto-cupom.ts`:
```ts
import { createPromotionsWorkflow, updatePromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { converterCupom } from "../../modules/beneficio-conjunto/sincronizar-promocao"

// Toda promoção criada/editada pela Admin API (Cockpit, admin do Medusa) passa aqui (ruling 3). Idempotente;
// promoções CONJUNTO-* são ignoradas; erro só loga (a promoção existe de qualquer forma).
async function converter(promotions: { id: string }[], container: any) {
  for (const p of promotions) {
    try { await converterCupom(container, p.id) } catch (e) { console.error("[conjunto] conversão de cupom", p.id, e) }
  }
}
createPromotionsWorkflow.hooks.promotionsCreated(async ({ promotions }, { container }) => { await converter(promotions as any[], container); return new StepResponse(undefined) })
updatePromotionsWorkflow.hooks.promotionsUpdated(async ({ promotions }, { container }) => { await converter(promotions as any[], container); return new StepResponse(undefined) })
```
Conferir o nome/forma do input dos ganchos em `node_modules/@medusajs/core-flows/dist/promotion/workflows/{create,update}-promotions.js` (linhas com `createHook`).

- [ ] **Step 3: Teste** — `conjunto-cupom.spec.ts`: (a) `POST /admin/promotions` de um cupom de pedido `PEDIDO10` sem regras → reler: `target_type: items`, `allocation: across`, `max_quantity` nulo, regra `items.conjunto_desconto eq nenhum` presente; (b) cupom de itens `ITENS10` sem regras → ganha a regra; (c) editar `ITENS10` (`PUT /admin/promotions/:id { status: "active" }`) → continua com UMA regra de exclusão (idempotência); (d) carrinho top + legging + macaquinho com regra padrão ativa e `PEDIDO10` aplicado → conjunto no top, cupom só no macaquinho (29,90), legging intocada; (e) `reconciliar(container)` devolve contagens e não duplica regras.

- [ ] **Step 4: Rodar** — passando; `tsc` sem erros novos.

- [ ] **Step 5: Commit**
```bash
git add apps/backend/src/modules/beneficio-conjunto/sincronizar-promocao.ts apps/backend/src/workflows/hooks/conjunto-cupom.ts apps/backend/integration-tests/http/conjunto-cupom.spec.ts
git commit -m "feat(backend): cupons nunca alcançam unidades em conjunto (conversão nos ganchos de promoção) + reconciliação"
```

---

### Task 6: Rotas Admin (`/admin/conjuntos/*`) com validação

**Files:**
- Create: `apps/backend/src/modules/beneficio-conjunto/catalogo-conjuntos.ts` (`parceirasDoProduto`, `listarConjuntos` — usado por admin e store)
- Modify: `apps/backend/src/api/middlewares.ts` (criar se não existir)
- Create: rotas em `apps/backend/src/api/admin/conjuntos/…` (ver File Structure)
- Create: `apps/backend/integration-tests/http/conjunto-admin.spec.ts`

**Interfaces:**
- Produces (JSON):
  - `GET /admin/conjuntos/regras` → `{ regras: Regra[] }` (todas, inclusive inativas; sem as de escopo `curado`)
  - `POST /admin/conjuntos/regras` body `{ nome, escopo: "padrao"|"colecao", collection_id?, tipo_desconto, valor, ativa? }` → `{ regra }` (400 se já existe `padrao`; 400 se `colecao` sem `collection_id`; 409 se coleção já tem exceção)
  - `PUT /admin/conjuntos/regras/:id` body parcial `{ nome?, tipo_desconto?, valor?, ativa? }` → `{ regra }`; sincroniza promoção
  - `GET /admin/conjuntos/pares` → `{ pares }`; `PUT /admin/conjuntos/pares` body `{ pares: [{ categoria_a, categoria_b, ativo? }] }` → lista inteira substituída (pares ausentes são apagados); normaliza `a < b`; 400 se `a === b`
  - `GET /admin/conjuntos/curados` → `{ curados: (Curado & { regra: Regra })[] }`; `POST` body `{ nome, handle?, capa_url?, product_ids, tipo_desconto, valor, ativo?, ordem? }` → cria regra `curado` + curado + promoção (400 se `< 2` ids distintos, se produto inexistente ou não `published`, se handle já existe); `PUT /:id` (mesmos campos, `handle` imutável); `DELETE /:id` → apaga curado, regra e promoção (`deletePromotionsWorkflow`) → `{ id, deleted: true }`
  - `GET /admin/conjuntos/por-produto/:product_id` → `{ parceiras: [{ product_id, categoria_raiz, collection_id }], curados: Curado[] }`
  - `POST /admin/conjuntos/reconciliar` → `{ regras, cupons }`
- Validação com zod em `middlewares.ts` via `defineMiddlewares` + `validateAndTransformBody`. Valores: `valor` inteiro ≥ 1; percentual ≤ 100 quando `tipo_desconto` termina em `percentual`. Erros em pt-BR (`MedusaError.Types.INVALID_DATA`).

- [ ] **Step 1: `catalogo-conjuntos.ts`** — com `query.graph` em `product` (`fields: ["id","handle","title","thumbnail","status","collection_id","categories.id"]`, `filters: { status: "published" }`), `mapaRaizes` (exportar de `avaliar-carrinho.ts`), e o serviço:
  - `listarConjuntos(container)` → `{ curados: [...com regra], colecoes: [{ collection_id, regra: { tipo_desconto, valor }, pares: [{ handle: `${a.handle}--${b.handle}`, categoria_a, categoria_b, product_ids: [a.id, b.id] }] }] }` — só coleções com regra efetiva ativa; só pares ativos; curados ativos cujos produtos estão todos publicados.
  - `parceirasDoProduto(container, productId)` → parceiras: produtos publicados da mesma coleção cuja raiz forma par com a raiz do produto (se a coleção tem regra efetiva ativa); curados ativos que contêm o produto.
  - `conjuntoPorHandle(container, handle)` → curado por handle, ou par `a--b` validado (mesma coleção, par ativo, regra ativa) → `{ tipo, nome, product_ids, regra }` ou `null`.

- [ ] **Step 2: Rotas + middlewares** — seguir o padrão de `src/api/admin/custom/route.ts` (`MedusaRequest`/`MedusaResponse`, `req.scope.resolve`). Cada mutação chama `sincronizarPromocao`. Exemplo do `POST /admin/conjuntos/regras`:
```ts
export const POST = async (req: AuthenticatedMedusaRequest<CriarRegraBody>, res: MedusaResponse) => {
  const svc: any = req.scope.resolve(BENEFICIO_CONJUNTO_MODULE)
  const b = req.validatedBody
  if (b.escopo === "padrao" && (await svc.listConjuntoRegras({ escopo: "padrao" })).length) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Já existe a regra padrão; edite-a.")
  if (b.escopo === "colecao" && !b.collection_id) throw new MedusaError(MedusaError.Types.INVALID_DATA, "Exceção por coleção exige collection_id.")
  const regra = await svc.createConjuntoRegras({ ...b, collection_id: b.escopo === "colecao" ? b.collection_id : null, ativa: b.ativa ?? true })
  await sincronizarPromocao(req.scope, regra.id)
  res.json({ regra: await svc.retrieveConjuntoRegra(regra.id) })
}
```

- [ ] **Step 3: Teste** — `conjunto-admin.spec.ts` com `criarAdmin`: fluxo completo — criar padrão (segunda vez → 400), editar valor (promoção atualizada), PUT pares (normalização e remoção), criar curado com 2 produtos do catálogo (regra + promoção criadas; `handle` gerado), produto inexistente → 400, DELETE curado (promoção some), `por-produto` do top devolve legging e short como parceiras, `reconciliar` devolve contagens. Validação: `valor: 0` → 400; `tipo_desconto` inválido → 400.

- [ ] **Step 4: Rodar; commit**
```bash
git add apps/backend/src/api apps/backend/src/modules/beneficio-conjunto/catalogo-conjuntos.ts apps/backend/integration-tests/http/conjunto-admin.spec.ts
git commit -m "feat(backend): rotas admin do Benefício Conjunto (regras, pares, curados, por-produto, reconciliar)"
```

---

### Task 7: Rotas Store (`/store/conjuntos/*`)

**Files:**
- Create: `apps/backend/src/api/store/conjuntos/route.ts`, `[handle]/route.ts`, `por-produto/[product_id]/route.ts`, `oportunidades/route.ts`
- Create: `apps/backend/integration-tests/http/conjunto-store.spec.ts`

**Interfaces (ruling 1 — estrutura + ids; a vitrine hidrata):**
- `GET /store/conjuntos` → `{ curados: [{ id, nome, handle, capa_url, product_ids, regra: { tipo_desconto, valor } }], colecoes: [{ collection_id, regra, pares: [{ handle, categoria_a, categoria_b, product_ids }] }] }` · cache 300 s
- `GET /store/conjuntos/:handle` → `{ conjunto: { tipo: "curado"|"colecao", nome, handle, capa_url?, product_ids, regra } }` ou 404 · cache 300 s
- `GET /store/conjuntos/por-produto/:product_id` → `{ parceiras: [{ product_id, categoria_raiz }], curados: [{ id, nome, handle, capa_url, product_ids, regra }] }` · cache 300 s
- `GET /store/conjuntos/oportunidades?cart_id=` → `{ conjuntos: ConjuntoFormado[], oportunidades: [{ collection_id, categoria_faltante, a_partir_do_item_id, candidatos: string[] /* até 3 product_ids publicados da coleção e categoria */ }] }` · `Cache-Control: no-store`; 404 se o carrinho não existe. Busca o carrinho com `query.graph` (`entity: "cart"`, fields `items.*`, `items.product.id`, `items.product.collection_id`, `items.product.categories.id`) e chama `avaliarCarrinho`.

- [ ] **Step 1: Implementar** as quatro rotas reutilizando `catalogo-conjuntos.ts` e `avaliar-carrinho.ts`; headers de cache.
- [ ] **Step 2: Teste** — `conjunto-store.spec.ts`: com regra padrão ativa e pares: `/store/conjuntos` lista a coleção Blackout com pares `top-aura--legging-vertice` e `top-aura--short-…` e não lista Lumière (só tem top); `/store/conjuntos/top-aura--legging-vertice` → 200 com 2 ids; handle inválido → 404; `por-produto/<top>` → parceiras legging e short; carrinho top ×1 + legging ×2 → `oportunidades` com `categoria_faltante: "tops"` e `candidatos` contendo o top; headers `Cache-Control` corretos.
- [ ] **Step 3: Rodar; commit**
```bash
git add apps/backend/src/api/store/conjuntos apps/backend/integration-tests/http/conjunto-store.spec.ts
git commit -m "feat(backend): rotas store do Benefício Conjunto (vitrine, página do conjunto, parceiras, oportunidades)"
```

---

### Task 8: Script de produção, SOP, spec e checklist de deploy (Halt para o dono)

**Files:**
- Create: `scripts/setup-conjunto.py`
- Create: `architecture/conjunto.md`
- Modify: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§4.4 ruling 2; §6.5 ruling 1; §6.4 ruling 3; §6.6 sem DELETE em regras)
- Modify: `progress.md`, `CLAUDE.md` (linha "Estado atual": Benefício Conjunto F1)

- [ ] **Step 1: `scripts/setup-conjunto.py`** — mesmo padrão de `scripts/setup-categorias.py` (credenciais de `apps/cockpit/.env.local`, base Railway; `--apply` para escrever; sem `--apply` só imprime o plano; stdout utf-8). Ações idempotentes: (1) `GET /admin/conjuntos/regras`: se não há `padrao`, `POST` `{ nome: "Padrão da marca", escopo: "padrao", tipo_desconto: "total_percentual", valor: 10, ativa: false }`; (2) `PUT /admin/conjuntos/pares` com `leggings+tops`, `shorts+tops` (preservando outros existentes); (3) `POST /admin/conjuntos/reconciliar` e imprimir contagens; (4) `GET /admin/promotions` e listar os cupons convertidos. Também aceita `--base http://localhost:9000` para o dev local.
- [ ] **Step 2: `architecture/conjunto.md`** — SOP: o que é, modelo de dados, contrato do motor (F0), como rodar testes (Docker, prefixo Windows), como gerar migração, rotas, script de produção, riscos (§12), o que a F2/F3/F4 consomem.
- [ ] **Step 3: Spec** — aplicar os rulings 1–3 e 6 nos parágrafos citados; marcar F1 como "implementada, aguardando deploy".
- [ ] **Step 4: `progress.md`** — entrada "F1 Backend: código concluído; deploy e seed pendentes de autorização". `CLAUDE.md` — uma linha no "Estado atual".
- [ ] **Step 5: Checklist de deploy (para o controller/dono, NÃO executar nesta task):** (1) dono faz push de `main`; (2) Railway builda e roda `medusa db:migrate` no `predeploy` (cria as 3 tabelas); (3) com "pode aplicar": `python scripts/setup-conjunto.py --apply` (regra padrão inativa, pares, reconciliação dos cupons existentes); (4) validar `GET /store/conjuntos` em produção (vazio até haver regra ativa) e um carrinho de teste na vitrine em dev contra produção; (5) o dono ativa a regra padrão no Cockpit (F2) ou via `PUT /admin/conjuntos/regras/:id { ativa: true }` quando quiser ligar o benefício.
- [ ] **Step 6: Commit**
```bash
git add scripts/setup-conjunto.py architecture/conjunto.md docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md progress.md CLAUDE.md
git commit -m "docs(conjunto): SOP do backend, script de seed/reconciliação e checklist de deploy da F1"
```

---

## Self-review

- **Cobertura da spec (F1):** §4 (T1), §5 (T2), §6.1 (T4), §6.2 (T2/T3), §6.3 (T4 — divisão de contexto herdada da F0, agora com 3 marcas), §6.4 (T5), §6.5 (T7, com ruling 1), §6.6 (T6), §10 F1 deploy/seed (T8), §11 itens 1–4 e 10 (T4/T5 cobrem no backend; aceite no navegador fica para F4 quando a vitrine existir), §12 riscos (T8 docs). Itens 5–9 do §11 são F2–F4.
- **Placeholders:** `converterTodosCupons` tem só a descrição do laço (paginação de `listPromotions`) — o implementador escreve o laço; nenhum "TBD".
- **Consistência de tipos:** `Regra/Par/Curado/Linha/ResultadoMontagem` definidos uma vez em `utils/tipos.ts` e usados em T2–T7; `montarConjuntos(linhas, regras, pares, curados)` mesma ordem de parâmetros nos testes e em `avaliarCarrinho`; `payloadPromocao(regra, n)` usada em T3; marcas `MARCA_LIVRE/MARCA_EM_CONJUNTO/ATRIBUTO` em T4/T5/T6; `criarAdmin(api, container)` (assinatura da F0) em todos os specs.
- **Riscos assumidos e onde caem:** DML `model.array()` (T1, fallback `json`); `updatePromotionsWorkflow` aceitar `application_method.type` (T3, fallback documentado); atualização de `target_type` em cupom existente (T5, fallback documentado e reportado); o runner migrar módulo customizado (T1). Todos com instrução de registrar no relatório.
