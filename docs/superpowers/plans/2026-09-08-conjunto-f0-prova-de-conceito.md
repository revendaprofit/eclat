# Benefício Conjunto — F0 Prova de Conceito — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar, num banco de teste descartável, que o gancho `setPromotionContext` do Medusa 2.15.5 consegue (1) restringir uma promoção automática a unidades marcadas por nós, (2) descontar só K de N unidades da mesma linha e (3) impedir que um cupom alcance unidades marcadas — e registrar na spec a decisão dos §6.3 e §6.4.

**Architecture:** Nada de módulo ainda. Um gancho descartável (`src/workflows/hooks/conjunto-poc.ts`, ligado só com `CONJUNTO_POC=1`) marca a unidade mais barata do carrinho com `conjunto_desconto: "poc"` e todas as outras com `"nenhum"`, dividindo linhas com quantidade > 1 em duas entradas de contexto. Uma promoção automática alvo `conjunto_desconto eq poc` e dois cupons (item e pedido) são criados pela Admin API dentro do teste. Testes de integração HTTP do Medusa (`medusaIntegrationTestRunner`, banco criado e destruído por execução) num Postgres 17 em contêiner Docker na porta 55432 — o Postgres nativo local tem senha desconhecida e produção nunca é tocada. A infraestrutura de teste (Docker, `.env.test`, helpers) fica para a F1; o gancho de PoC é substituído pelo módulo na F1.

**Tech Stack:** Medusa 2.15.5 (`@medusajs/test-utils`, Jest 29 + swc), Docker Desktop (já instalado), Postgres 17, Admin/Store HTTP API.

**Spec:** `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` — §5 (cálculo), §6.1–6.4 (gancho, promoções, quantidade > 1, cupom), §10 (F0), §12.

## Global Constraints

- **Nenhuma escrita em produção** (Railway/Medusa, Supabase). Todo teste roda contra o Postgres do contêiner `eclat-pg-test` (porta 55432). Nunca apontar `DB_HOST`/`DATABASE_URL` de teste para produção nem para o Postgres nativo de `apps/backend/.env`. Nunca editar `apps/backend/.env`.
- **Dinheiro:** no Medusa 2 os preços da API são em unidades da moeda (R$ 189,00 = `189`), não em centavos. Asserções de totais em número decimal; `toBeCloseTo(x, 2)`.
- **Gancho sempre desligado por padrão:** `process.env.CONJUNTO_POC !== "1"` → devolve `new StepResponse({})`. O runner de teste liga via `env: { CONJUNTO_POC: "1" }`. Produção nunca define a variável.
- **Comandos:** do diretório `apps/backend`: `npm run test:integration:http` (Jest lê `.env.test` e depois `.env`; `.env.test` vence porque é carregado primeiro). Antes: `npm run test:db:up`; depois: `npm run test:db:down` (contêiner descartável). Se `docker` não estiver acessível pelo Bash, usar o PowerShell para os comandos Docker.
- **Copy e comentários em pt-BR.** Commits pequenos com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **F0 é uma prova, não produto:** payloads da Admin API podem precisar de ajuste contra o 2.15.5 (erros 400 mostram o campo); ajustar e registrar no relatório. O que NÃO pode mudar: a semântica testada (marcação por unidade, K de N, exclusão do cupom) e as asserções numéricas.
- A cada task: `npx tsc -p apps/backend --noEmit` limpo (o backend já compila hoje; `integration-tests/**/*.ts` entra no `tsconfig` se ele incluir `integration-tests`; se não incluir, deixar como está e registrar).

## Rulings do controller (não reabrir)

1. Banco de teste em **Docker**, porta 55432, credenciais `postgres/postgres` só do contêiner — commitadas em `.env.test` (não são segredo). `.env.test.local` (gitignored) pode sobrescrever.
2. A PoC marca sempre a **unidade mais barata do carrinho inteiro** (regra fictícia, suficiente para provar o mecanismo). A regra real (§5) é F1.
3. Resultado da F0 vira texto na spec (§6.3 e §6.4, linhas "Decisão F0") **antes** de escrever o plano da F1.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/backend/package.json` | scripts `test:db:up`, `test:db:down` |
| `apps/backend/.env.test` (novo, commitado) | env de teste: DB do contêiner, CORS, segredos de teste |
| `apps/backend/integration-tests/setup.js` (novo) | setup do Jest exigido pelo `jest.config.js` |
| `apps/backend/integration-tests/helpers/admin.ts` (novo) | `criarAdmin(api)` → headers autenticados |
| `apps/backend/integration-tests/helpers/catalogo.ts` (novo) | `criarCatalogoBase(api, adminHeaders)` → região BRL, canal, chave publicável, produtos Top/Legging |
| `apps/backend/integration-tests/http/saude.spec.ts` (novo) | smoke: `/health` e `/admin/users/me` |
| `apps/backend/src/workflows/hooks/conjunto-poc.ts` (novo, descartável) | gancho `setPromotionContext` gated por `CONJUNTO_POC` |
| `apps/backend/integration-tests/http/conjunto-poc.spec.ts` (novo) | casos A–D |
| `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` | "Decisão F0" em §6.3 e §6.4 |
| `findings.md`, `progress.md` | registro |

---

### Task 1: Infraestrutura de testes de integração (Docker + harness + smoke)

**Files:**
- Modify: `apps/backend/package.json` (scripts)
- Create: `apps/backend/.env.test`
- Create: `apps/backend/integration-tests/setup.js`
- Create: `apps/backend/integration-tests/helpers/admin.ts`
- Create: `apps/backend/integration-tests/helpers/catalogo.ts`
- Create: `apps/backend/integration-tests/http/saude.spec.ts`

**Interfaces:**
- Produces: `criarAdmin(api): Promise<{ headers: Record<string,string> }>`; `criarCatalogoBase(api, adminHeaders): Promise<{ regionId, salesChannelId, publishableKey, storeHeaders, top: { productId, variantId, preco: 189 }, legging: { productId, variantId, preco: 259 } }>`.

- [ ] **Step 1: Scripts Docker no `package.json` do backend**

Em `"scripts"`:
```json
"test:db:up": "docker run -d --name eclat-pg-test -e POSTGRES_PASSWORD=postgres -e POSTGRES_USER=postgres -p 55432:5432 postgres:17-alpine && node -e \"setTimeout(()=>{},4000)\"",
"test:db:down": "docker rm -f eclat-pg-test"
```
(Se o contêiner já existir, `test:db:up` falha com "name already in use": rodar `test:db:down` antes. A pausa de 4 s dá tempo ao Postgres subir; se o teste falhar com `ECONNREFUSED`, esperar e repetir.)

- [ ] **Step 2: `.env.test`**

```env
# Ambiente de TESTE (Jest/medusaIntegrationTestRunner). Banco = contêiner Docker eclat-pg-test (npm run test:db:up).
# Nunca aponte para produção nem para o Postgres nativo de desenvolvimento.
DB_HOST=localhost
DB_PORT=55432
DB_USERNAME=postgres
DB_PASSWORD=postgres
DATABASE_URL=postgres://postgres:postgres@localhost:55432/postgres
STORE_CORS=http://localhost:8000
ADMIN_CORS=http://localhost:7001
AUTH_CORS=http://localhost:8000,http://localhost:7001
JWT_SECRET=teste-jwt
COOKIE_SECRET=teste-cookie
DISABLE_ADMIN=true
```

- [ ] **Step 3: `integration-tests/setup.js`**

```js
// Exigido pelo jest.config.js (setupFiles). Limpa o registro de metadados do MikroORM entre suítes.
const { MetadataStorage } = require("@medusajs/framework/mikro-orm/core")
MetadataStorage.clear()
```
Se `@medusajs/framework/mikro-orm/core` não resolver, usar `require("@mikro-orm/core")` e registrar no relatório.

- [ ] **Step 4: `helpers/admin.ts`**

```ts
// Cria o primeiro usuário admin pelo fluxo público do Medusa (register → token → POST /admin/users)
// e devolve os headers autenticados. Só para testes.
import type { AxiosInstance } from "axios"

export const ADMIN_EMAIL = "admin@eclat.test"
export const ADMIN_SENHA = "senha-teste-123"

export async function criarAdmin(api: AxiosInstance): Promise<{ headers: Record<string, string> }> {
  const reg = await api.post("/auth/user/emailpass/register", { email: ADMIN_EMAIL, password: ADMIN_SENHA })
  const tokenRegistro = reg.data.token as string
  await api.post("/admin/users", { email: ADMIN_EMAIL, first_name: "Admin", last_name: "Teste" }, { headers: { Authorization: `Bearer ${tokenRegistro}` } })
  const login = await api.post("/auth/user/emailpass", { email: ADMIN_EMAIL, password: ADMIN_SENHA })
  return { headers: { Authorization: `Bearer ${login.data.token as string}` } }
}
```
Se `POST /admin/users` responder 401 com o token de registro, fallback: assinar um JWT manualmente com `jsonwebtoken` (`{ actor_id, actor_type: "user", auth_identity_id, app_metadata: { user_id } }`, segredo `JWT_SECRET`) após criar o usuário via `container.resolve(Modules.USER).createUsers(...)` e a identidade via `Modules.AUTH`. Registrar qual caminho ficou.

- [ ] **Step 5: `helpers/catalogo.ts`**

```ts
// Catálogo mínimo para os testes de conjunto: região BRL, canal de vendas + chave publicável,
// dois produtos publicados (Top R$ 189, Legging R$ 259), sem controle de estoque.
import type { AxiosInstance } from "axios"

export type Peca = { productId: string; variantId: string; preco: number }
export type CatalogoBase = {
  regionId: string
  salesChannelId: string
  publishableKey: string
  storeHeaders: Record<string, string>
  top: Peca
  legging: Peca
}

async function criarProduto(api: AxiosInstance, headers: Record<string, string>, salesChannelId: string, titulo: string, handle: string, preco: number): Promise<Peca> {
  const res = await api.post(
    "/admin/products",
    {
      title: titulo,
      handle,
      status: "published",
      options: [{ title: "Tamanho", values: ["M"] }],
      variants: [{ title: "M", sku: `${handle}-m`, manage_inventory: false, options: { Tamanho: "M" }, prices: [{ amount: preco, currency_code: "brl" }] }],
      sales_channels: [{ id: salesChannelId }],
    },
    { headers }
  )
  const p = res.data.product
  return { productId: p.id, variantId: p.variants[0].id, preco }
}

export async function criarCatalogoBase(api: AxiosInstance, headers: Record<string, string>): Promise<CatalogoBase> {
  const region = (await api.post("/admin/regions", { name: "Brasil", currency_code: "brl", countries: ["br"] }, { headers })).data.region
  const sc = (await api.post("/admin/sales-channels", { name: "Loja teste" }, { headers })).data.sales_channel
  const key = (await api.post("/admin/api-keys", { title: "pk teste", type: "publishable" }, { headers })).data.api_key
  await api.post(`/admin/api-keys/${key.id}/sales-channels`, { add: [sc.id] }, { headers })
  const top = await criarProduto(api, headers, sc.id, "Top Aura", "top-aura", 189)
  const legging = await criarProduto(api, headers, sc.id, "Legging Vértice", "legging-vertice", 259)
  return {
    regionId: region.id,
    salesChannelId: sc.id,
    publishableKey: key.token,
    storeHeaders: { "x-publishable-api-key": key.token },
    top,
    legging,
  }
}
```
Se `countries: ["br"]` falhar por país já vinculado a outra região (banco novo não deve ter), trocar por região sem país e criar o carrinho com `region_id` direto — os testes não dependem de país.

- [ ] **Step 6: Smoke test `http/saude.spec.ts`**

```ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api }) => {
    describe("saúde do harness", () => {
      it("GET /health responde 200", async () => {
        const res = await api.get("/health")
        expect(res.status).toBe(200)
      })
      it("admin autenticado lê /admin/users/me", async () => {
        const { headers } = await criarAdmin(api)
        const me = await api.get("/admin/users/me", { headers })
        expect(me.status).toBe(200)
        expect(me.data.user.email).toBe("admin@eclat.test")
      })
    })
  },
})
```

- [ ] **Step 7: Rodar**

```bash
cd apps/backend && npm run test:db:down; npm run test:db:up && npm run test:integration:http
```
Expected: 2 testes passando; log do runner mostra "Creating database medusa-…" e a migração. Se falhar com `password authentication failed`, o Jest não leu `.env.test` (conferir que roda de `apps/backend`). Rodar `npx tsc -p apps/backend --noEmit` (limpo, ou registrar que `integration-tests` está fora do `include`).

- [ ] **Step 8: Commit**

```bash
git add apps/backend/package.json apps/backend/.env.test apps/backend/integration-tests
git commit -m "test(backend): harness de integração HTTP com Postgres em Docker (F0 Benefício Conjunto)"
```

---

### Task 2: Gancho de PoC + promoção automática — casos A (par simples) e B (K de N unidades)

**Files:**
- Create: `apps/backend/src/workflows/hooks/conjunto-poc.ts`
- Create: `apps/backend/integration-tests/http/conjunto-poc.spec.ts`

**Interfaces:**
- Consumes: `criarAdmin`, `criarCatalogoBase` (Task 1); `updateCartPromotionsWorkflow.hooks.setPromotionContext` (`@medusajs/medusa/core-flows`), cujo input é `{ cart, action, promo_codes }` e cujo resultado é mesclado **por cima** do contexto do carrinho (`{ ...cart, ...resultado }`), logo devolver `{ items }` substitui a lista de itens que as promoções avaliam.
- Produces: atributos de contexto `conjunto_desconto: "poc" | "nenhum"` por entrada de item; promoção `CONJUNTO-POC`.

- [ ] **Step 1: O gancho**

```ts
// PROVA DE CONCEITO (F0 do Benefício Conjunto) — descartável, substituído pelo módulo na F1.
// Só atua com CONJUNTO_POC=1 (runner de teste). Marca a unidade mais barata do carrinho com
// conjunto_desconto="poc" e todas as outras com "nenhum"; uma linha com N unidades vira duas
// entradas de contexto (1 marcada, N-1 não) para provar o §6.3 da spec.
import { updateCartPromotionsWorkflow } from "@medusajs/medusa/core-flows"
import { StepResponse } from "@medusajs/framework/workflows-sdk"

type Item = Record<string, any> & { id: string; quantity: number | string; subtotal: number | string }

const unitario = (i: Item) => Number(i.subtotal) / Number(i.quantity)

export function marcarUnidades(items: Item[]): Item[] {
  if (!items.length) return items
  const maisBarata = items.slice().sort((a, b) => unitario(a) - unitario(b) || a.id.localeCompare(b.id))[0]
  const saida: Item[] = []
  for (const it of items) {
    if (it.id !== maisBarata.id) {
      saida.push({ ...it, conjunto_desconto: "nenhum" })
      continue
    }
    const q = Number(it.quantity)
    if (q <= 1) {
      saida.push({ ...it, conjunto_desconto: "poc" })
      continue
    }
    const u = unitario(it)
    saida.push({ ...it, quantity: 1, subtotal: u, conjunto_desconto: "poc" })
    saida.push({ ...it, quantity: q - 1, subtotal: u * (q - 1), conjunto_desconto: "nenhum" })
  }
  return saida
}

updateCartPromotionsWorkflow.hooks.setPromotionContext(async ({ cart }) => {
  if (process.env.CONJUNTO_POC !== "1") return new StepResponse({})
  try {
    const items = ((cart as any)?.items ?? []) as Item[]
    return new StepResponse({ items: marcarUnidades(items) })
  } catch (e) {
    console.error("[conjunto-poc]", e)
    return new StepResponse({})
  }
})
```
Se o import `@medusajs/medusa/core-flows` não expuser `updateCartPromotionsWorkflow`, usar `@medusajs/core-flows` (ambos existem em 2.15) e registrar.

- [ ] **Step 2: O teste — casos A e B**

`integration-tests/http/conjunto-poc.spec.ts`:
```ts
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { criarAdmin } from "../helpers/admin"
import { criarCatalogoBase, type CatalogoBase } from "../helpers/catalogo"

jest.setTimeout(180 * 1000)

const ajustes = (item: any) => (item.adjustments ?? []) as { code: string; amount: number }[]
const somaPorCodigo = (cart: any, code: string) =>
  cart.items.flatMap(ajustes).filter((a: any) => a.code === code).reduce((s: number, a: any) => s + Number(a.amount), 0)

medusaIntegrationTestRunner({
  inApp: true,
  env: { CONJUNTO_POC: "1" },
  testSuite: ({ api }) => {
    let admin: Record<string, string>
    let cat: CatalogoBase

    beforeAll(async () => {
      admin = (await criarAdmin(api)).headers
      cat = await criarCatalogoBase(api, admin)
      // Promoção automática do "conjunto": 10% em cada unidade marcada com conjunto_desconto = poc
      await api.post(
        "/admin/promotions",
        {
          code: "CONJUNTO-POC",
          type: "standard",
          is_automatic: true,
          status: "active",
          application_method: {
            type: "percentage",
            target_type: "items",
            allocation: "each",
            value: 10,
            currency_code: "brl",
            target_rules: [{ attribute: "conjunto_desconto", operator: "eq", values: ["poc"] }],
          },
        },
        { headers: admin }
      )
    })

    async function novoCarrinho(linhas: { variantId: string; quantity: number }[]) {
      const cart = (await api.post("/store/carts", { region_id: cat.regionId, sales_channel_id: cat.salesChannelId }, { headers: cat.storeHeaders })).data.cart
      for (const l of linhas) {
        await api.post(`/store/carts/${cart.id}/line-items`, { variant_id: l.variantId, quantity: l.quantity }, { headers: cat.storeHeaders })
      }
      return (await api.get(`/store/carts/${cart.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
    }

    describe("A — top + legging, 1 unidade cada", () => {
      it("desconta só a unidade marcada (a mais barata: Top R$ 189 → R$ 18,90)", async () => {
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        const legging = cart.items.find((i: any) => i.variant_id === cat.legging.variantId)
        expect(somaPorCodigo({ items: [top] }, "CONJUNTO-POC")).toBeCloseTo(18.9, 2)
        expect(ajustes(legging)).toHaveLength(0)
        expect(Number(cart.discount_total)).toBeCloseTo(18.9, 2)
      })
    })

    describe("B — linha com 2 unidades, só 1 em conjunto (§6.3)", () => {
      it("desconta uma unidade só (Top ×2 = R$ 378 → desconto R$ 18,90, não R$ 37,80)", async () => {
        const cart = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 2 }, { variantId: cat.legging.variantId, quantity: 1 }])
        const top = cart.items.find((i: any) => i.variant_id === cat.top.variantId)
        expect(Number(top.quantity)).toBe(2)
        expect(Number(cart.discount_total)).toBeCloseTo(18.9, 2)
      })
    })
  },
})
```
Se o `POST /admin/promotions` rejeitar `attribute: "conjunto_desconto"` (400 de validação de atributo), criar a promoção pelo serviço: `getContainer().resolve(Modules.PROMOTION).createPromotions({...mesmo payload...})` e registrar — na F1 isso define se o módulo cria promoções pela API ou pelo serviço.

- [ ] **Step 3: Rodar**

```bash
cd apps/backend && npm run test:integration:http
```
Expected: A passa. B é a **pergunta da F0**: pode passar (desconto 18,90) ou falhar (37,80 = motor ignorou a divisão; ou 0 / erro = motor rejeitou ids duplicados). **Qualquer dos três resultados é informação, não bug do teste**: registrar no relatório o valor observado e a lista de `adjustments` do item. Se B falhar, NÃO alterar a asserção; deixar o teste marcado com `it.failing` (Jest 29 suporta) e o motivo no comentário, para o controller decidir o fallback (§6.3).

- [ ] **Step 4: Commit**

```bash
git add apps/backend/src/workflows/hooks/conjunto-poc.ts apps/backend/integration-tests/http/conjunto-poc.spec.ts
git commit -m "test(backend): F0 Benefício Conjunto — gancho de PoC, promoção-alvo e casos A/B"
```

---

### Task 3: Exclusividade do cupom — casos C (cupom de itens) e D (cupom de pedido)

**Files:**
- Modify: `apps/backend/integration-tests/http/conjunto-poc.spec.ts`

**Interfaces:**
- Consumes: tudo da Task 2.

- [ ] **Step 1: Criar os dois cupons no `beforeAll`** (após a promoção automática):

```ts
      // Cupom de ITENS com a regra de exclusão do §6.4: só alcança unidades marcadas "nenhum"
      await api.post("/admin/promotions", {
        code: "CUPOM10", type: "standard", is_automatic: false, status: "active",
        application_method: {
          type: "percentage", target_type: "items", allocation: "each", value: 10, currency_code: "brl",
          target_rules: [{ attribute: "conjunto_desconto", operator: "eq", values: ["nenhum"] }],
        },
      }, { headers: admin })
      // Cupom de PEDIDO inteiro (não aceita target_rules por item): observar o que acontece
      await api.post("/admin/promotions", {
        code: "PEDIDO10", type: "standard", is_automatic: false, status: "active",
        application_method: { type: "percentage", target_type: "order", value: 10, currency_code: "brl" },
      }, { headers: admin })
```

- [ ] **Step 2: Casos C e D**

```ts
    describe("C — cupom de itens com exclusão (§6.4)", () => {
      it("cupom desconta só a legging (fora do conjunto); o conjunto continua no top", async () => {
        const cart0 = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["CUPOM10"] }, { headers: cat.storeHeaders })
        const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        expect(somaPorCodigo(cart, "CONJUNTO-POC")).toBeCloseTo(18.9, 2)  // 10% do top
        expect(somaPorCodigo(cart, "CUPOM10")).toBeCloseTo(25.9, 2)       // 10% da legging, nada no top
        expect(Number(cart.discount_total)).toBeCloseTo(44.8, 2)
      })
    })

    describe("D — cupom de pedido inteiro (sem regra por item)", () => {
      it("registra o comportamento: desconto do pedido alcança ou não a unidade em conjunto?", async () => {
        const cart0 = await novoCarrinho([{ variantId: cat.top.variantId, quantity: 1 }, { variantId: cat.legging.variantId, quantity: 1 }])
        await api.post(`/store/carts/${cart0.id}/promotions`, { promo_codes: ["PEDIDO10"] }, { headers: cat.storeHeaders })
        const cart = (await api.get(`/store/carts/${cart0.id}?fields=*items,*items.adjustments`, { headers: cat.storeHeaders })).data.cart
        const pedido = somaPorCodigo(cart, "PEDIDO10")
        // eslint-disable-next-line no-console
        console.log("[F0-D] PEDIDO10 total =", pedido, "ajustes:", JSON.stringify(cart.items.map((i: any) => ({ v: i.variant_id, adj: i.adjustments }))))
        expect(pedido).toBeGreaterThan(0) // só garante que o cupom foi aplicado; o VALOR vai para o relatório
      })
    })
```

- [ ] **Step 3: Rodar e registrar**

```bash
cd apps/backend && npm run test:integration:http
```
Expected: C passa (se falhar, registrar os `adjustments` reais — é o segundo resultado da F0). D imprime o valor: `44,80` significa que o desconto de pedido alcançou também o top marcado (esperado: promoções de pedido não olham atributo de item); `25,90` significaria que o motor respeitou a marcação. Registrar no relatório.

- [ ] **Step 4: Commit**

```bash
git add apps/backend/integration-tests/http/conjunto-poc.spec.ts
git commit -m "test(backend): F0 Benefício Conjunto — casos C/D de exclusividade do cupom"
```

---

### Task 4: Registrar a decisão da F0 (spec, findings, progress)

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§6.3 e §6.4)
- Modify: `findings.md`, `progress.md`
- Modify (talvez): `apps/backend/integration-tests/http/conjunto-poc.spec.ts` (só comentários de resultado)

- [ ] **Step 1: Ler os relatórios das Tasks 2 e 3** (caminhos passados pelo controller) e o resultado real de A–D.

- [ ] **Step 2: Spec §6.3** — acrescentar ao fim da seção um parágrafo iniciado por `**Decisão F0 (2026-09-0x):**` com UMA das três frases, conforme B:
- B passou: "O motor aplica a promoção só à entrada de contexto marcada; linhas com N unidades são divididas em duas entradas com o mesmo `id` (K marcadas, N−K não). Fallbacks (a) e (b) não são necessários."
- B deu 37,80: "O motor ignora a divisão por entrada; fica o fallback (a): peças elegíveis entram sempre em linhas separadas (metadata `conjunto_slot`) — a F1 implementa no `addToCart` da vitrine e o gancho marca linhas inteiras."
- B deu erro/0: "Entradas duplicadas quebram o motor; fica o fallback (a) como acima."

- [ ] **Step 3: Spec §6.4** — acrescentar `**Decisão F0:**`: se C passou, "a regra-alvo `conjunto_desconto eq nenhum` exclui unidades em conjunto de cupons de itens"; e para D, conforme o valor: "cupons de pedido inteiro (`target_type: order`) ignoram a marcação — o assinante do módulo converte cupons de pedido em cupons de itens com `allocation: across` ao criar/atualizar, e o Cockpit só oferece cupom de itens" OU "cupons de pedido respeitam a marcação; nada a fazer". Se C falhou, registrar o observado e marcar §6.4 como **PENDENTE de redesenho** (o controller decide antes da F1).

- [ ] **Step 4: `findings.md`** — seção "2026-09-0x — F0 Benefício Conjunto": os quatro resultados com números, o caminho de admin que funcionou (register ou JWT manual), se a Admin API aceitou `attribute` customizado ou foi preciso o serviço, e o comando completo para rodar os testes de integração (Docker + `.env.test`).

- [ ] **Step 5: `progress.md`** — entrada "F0 Benefício Conjunto: CONCLUÍDA — vai/não vai: <resultado>", com o link da spec e a nota de que o gancho de PoC fica gated por `CONJUNTO_POC` até a F1 substituí-lo.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md findings.md progress.md apps/backend/integration-tests/http/conjunto-poc.spec.ts
git commit -m "docs(conjunto): decisão da F0 (quantidade > 1 e exclusividade do cupom) na spec, findings e progress"
```

---

## Self-review

- **Cobertura da spec (F0):** §6.3 (caso B), §6.4 (casos C e D), §6.1 (gancho devolve `items` mesclados — casos A–D), §10 F0 "vai/não vai" (Task 4). §6.2 (mapa dos quatro tipos) fica para a F1, mas o caso A prova o mecanismo `percentage/each` com regra-alvo.
- **Placeholders:** nenhum "TBD"; cada passo traz o código ou o comando.
- **Consistência de tipos:** `criarAdmin(api)` e `criarCatalogoBase(api, headers)` têm a mesma assinatura em `saude.spec.ts` e `conjunto-poc.spec.ts`; `CatalogoBase.top/legging` com `variantId`/`preco` usados nos casos; `somaPorCodigo` aceita `{ items }` parcial no caso A por design.
- **Riscos assumidos e onde caem:** validação de `attribute` customizado na Admin API (fallback pelo serviço, Task 2 Step 2); fluxo de criação do admin (fallback JWT, Task 1 Step 4); `countries` na região (fallback sem país, Task 1 Step 5). Todos registrados no relatório e reaproveitados na F1.
