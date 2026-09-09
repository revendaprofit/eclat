# Benefício Conjunto — F3 Vitrine — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A cliente vê e compra conjuntos: a página Conjuntos (curados + pares gerados por coleção), a página de um conjunto (cor e tamanho por peça, total com benefício, "Adicionar o conjunto"), o bloco "Complete o conjunto" na PDP e o selo "Forma conjunto" no card.

**Architecture:** Mesmo padrão da vitrine: módulos **puros** em `src/lib/util/conjuntos.ts` (montagem dos cards, preço "a partir de", desconto espelhando o backend, elegibilidade, cor parceira) testados com Vitest; leitor de servidor `src/lib/data/conjuntos.ts` que chama as rotas Store da F1 (`/store/conjuntos*`, estrutura + ids) e **hidrata** com o `listProducts` existente (preço, fotos, estoque, mesmo teto de 100, em lotes). A página do conjunto usa um `ProductSelectionProvider` **por peça** (já existe, com `key`) e um componente cliente `ConjuntoBuilder` que agrega as seleções, calcula o total e adiciona as variantes em sequência — cada uma em **linha separada** (`metadata.conjunto_slot`, decisão F1 §6.3). Sem produto novo no Medusa; nada de preço calculado no cliente além da prévia (o carrinho é a verdade).

**Tech Stack:** Next 15.5 App Router, Medusa Store API (rotas F1), Vitest 3, Tailwind, componentes existentes (`ProductSelectionProvider`, `ColorSelect`, `SizeSelect`, `VariantGallery`, `ProductCard`, `Breadcrumb`, JSON-LD, `Track`).

**Spec:** `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §7.1–7.4, §7.6, §7.7, §6.3 ("Decisão F1": linhas separadas), §6.5 (rotas Store como amendadas: estrutura + ids), §11 itens 5–8, §12. Backend SOP: `architecture/conjunto.md` (handle canônico `<A>--<B>`, `capa_url`, oportunidades).

## Global Constraints

- **Preço/estoque só do `listProducts`** (Store API com `calculated_price`, `inventory_quantity`, imagens). As rotas `/store/conjuntos*` dão estrutura e ids. Regra de disponibilidade = `isVariantAvailable` de `lib/util/availability.ts`. Dinheiro: `calculated_amount` é decimal (R$); converter para **centavos** (`Math.round(x*100)`) antes de qualquer conta; exibir com o formatador já usado nos cards.
- **Desconto na vitrine é prévia** que espelha `descontoDoConjunto` do backend (menor peça = índice do menor preço; `total_valor` = `round(valor/n)` por unidade; nunca acima do preço da unidade). O valor cobrado é o do carrinho.
- **Handle canônico** do par gerado: `<handle do produto de categoria_a>--<handle do produto de categoria_b>` (ex.: `legging-vertice--top-aura`); a vitrine nunca inventa outra ordem. Curado: `handle` do cadastro.
- **Linhas separadas no carrinho**: cada peça adicionada pela página do conjunto ou pelo "Complete o conjunto" vai com `metadata: { conjunto_slot: "<conjunto>#<i>#<timestamp>" }` para o Medusa não fundir com uma linha igual já existente. `addToCart` ganha `metadata?` opcional (default sem metadata → comportamento atual).
- **Copy pt-BR**; "Benefício Conjunto" (nunca "promoção"); URLs sem query; canonical sem query; `noindex` não se aplica (páginas de conjunto são indexáveis, spec §7.6).
- **Tracking (spec §7.7)**: `view_item_list` (`item_list_name: "Conjuntos"` e `"Conjuntos: <coleção>"`), `select_item`, `view_item` na página do conjunto (items = as peças), `add_to_cart` com `item_list_name: "Conjunto: <nome>"` via `pushEcommerceEvent`.
- **Teto de 100 produtos**: hidratação em lotes de 100 ids; conjuntos com peça fora do catálogo publicado somem.
- **Validação no navegador** com `mcp__plugin_chrome-devtools-mcp` (painel padrão não hidrata Turbopack). Backend: **produção tem a regra padrão inativa** → `/store/conjuntos` vem vazio. Para validar sem escrever em produção, usar o **backend local** (`medusa develop` com `eclat_dev` do contêiner Docker) semeado pelo script da Task 1, e o storefront com `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000` + a chave publicável do banco local. Nunca editar `.env.local`; nunca escrever em produção.
- Suítes: storefront 122 (`npm test --workspace=apps/storefront`), backend 70/30, cockpit 36 — inalteradas salvo os testes novos do storefront. `npx tsc -p apps/storefront --noEmit` limpo. Commits pequenos com trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Rulings do controller (não reabrir)

1. **Página Conjuntos substitui a listagem** na categoria `conjuntos` (mesma URL `/categories/conjuntos`, mesmo canonical); sem filtros/ordenação; breadcrumb "Início › Conjuntos".
2. **Card do par** mostra as duas fotos lado a lado (thumbnail de cada peça), nome `"<Título A> + <Título B>"`, "a partir de R$ X" (soma dos menores preços disponíveis de cada peça menos o desconto) com o preço cheio riscado. Curado: capa (se houver) ou as fotos das peças; nome do cadastro.
3. **Limite por coleção na vitrine**: 12 pares por coleção, botão "Ver todos os conjuntos da coleção" expande na mesma página (client state). Curados sem limite.
4. **Página do conjunto**: cada peça tem galeria por cor, seletor de cor e de tamanho (componentes da PDP dentro de um `ProductSelectionProvider` por peça); rodapé fixo com preço cheio riscado, total com benefício e a frase da regra; botão "Adicionar o conjunto" habilita só com todas as peças completas e disponíveis; adiciona em sequência e abre o mini-cart (mesmo comportamento do `QuickAdd`). Tamanho nunca pré-selecionado (decisão da F3 da spec 1); cor pré-selecionada = primeira disponível.
5. **"Complete o conjunto" na PDP**: até 6 parceiras (mesma coleção, par ativo) com foto, nome, preço, seletor de tamanho inline e "Adicionar as duas" (usa a variante selecionada na página + a escolhida na parceira; desabilitado até a página ter tamanho escolhido). Cor da parceira: a mesma cor da seleção atual se a parceira a tiver disponível, senão a primeira disponível. Curados que incluem a peça: cards com link para a página do conjunto. Bloco fica dentro do `ProductSelectionProvider`, abaixo da grade principal.
6. **Selo "Forma conjunto"** no card: elegibilidade = coleção com regra efetiva ativa e categoria raiz em algum par ativo (dados de `/store/conjuntos` + categorias; cache 5 min). Sem chamada por card.
7. **Seed local** (`medusa exec`) só roda com `DATABASE_URL` em `localhost`/`127.0.0.1`; recusa qualquer outro host.

## File Structure

| Arquivo | Responsabilidade |
|---|---|
| `apps/backend/src/scripts/seed-dev-conjunto.ts` (novo) | seed do banco LOCAL: região BRL, canal + chave publicável, categorias raiz, coleção Blackout, 4 produtos (top, legging, short, macaquinho) com preços/estoque, regra padrão ATIVA (menor peça 20%), pares; imprime a chave publicável |
| `apps/storefront/src/lib/util/conjuntos.ts` (novo) | tipos da resposta Store, `descontoConjunto`, `precoMinDisponivel`, `precosConjunto`, `montarCardPar`, `montarCardCurado`, `conjuntoDisponivel`, `corParceira`, `elegibilidade`, `descricaoRegra`, `slotMetadata` — puro |
| `apps/storefront/src/lib/util/conjuntos.test.ts` (novo) | Vitest |
| `apps/storefront/src/lib/data/conjuntos.ts` (novo) | `getVitrineConjuntos(countryCode)`, `getConjunto(handle, countryCode)`, `getConjuntosDoProduto(productId, countryCode)`, `getElegibilidade()` — `server-only`, nunca lança |
| `apps/storefront/src/lib/data/products.ts` | `listProductsByIds(ids, countryCode)` (lotes de 100) |
| `apps/storefront/src/lib/data/cart.ts` | `addToCart({ …, metadata? })` |
| `apps/storefront/src/modules/conjuntos/templates/vitrine.tsx` (novo) | página Conjuntos |
| `apps/storefront/src/modules/conjuntos/components/card-conjunto.tsx` (novo) | card (client, `select_item`) |
| `apps/storefront/src/modules/conjuntos/components/grade-colecao.tsx` (novo) | grade por coleção com "Ver todos" |
| `apps/storefront/src/modules/conjuntos/templates/conjunto.tsx` (novo) | página do conjunto (server) |
| `apps/storefront/src/modules/conjuntos/components/conjunto-builder.tsx` (novo) | client: providers por peça, rodapé, adicionar tudo |
| `apps/storefront/src/modules/conjuntos/components/peca-do-conjunto.tsx` (novo) | client: galeria + cor + tamanho de uma peça, reporta a variante |
| `apps/storefront/src/modules/conjuntos/components/rodape-conjunto.tsx` (novo) | client: total, economia, botão |
| `apps/storefront/src/app/[countryCode]/(main)/conjuntos/[handle]/page.tsx` (novo) | rota + metadata + 404 |
| `apps/storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx` | desvio para `VitrineConjuntos` quando handle = `conjuntos` |
| `apps/storefront/src/modules/products/components/complete-set/index.tsx` (novo) + `parceira.tsx` | bloco na PDP |
| `apps/storefront/src/modules/products/templates/index.tsx` | monta o bloco |
| `apps/storefront/src/lib/util/product-card-data.ts`, `modules/products/components/product-card/{index,badge}.tsx`, `product-preview/index.tsx`, `store/templates/product-listing.tsx` | selo "Forma conjunto" |
| `apps/storefront/src/modules/seo/jsonld.tsx` | `ConjuntoJsonLd` |
| `architecture/catalog.md`, `architecture/conjunto.md`, `progress.md`, spec §7 | docs |

---

### Task 1: Seed local do backend + módulo puro `lib/util/conjuntos.ts` com testes

**Files:**
- Create: `apps/backend/src/scripts/seed-dev-conjunto.ts`
- Create: `apps/storefront/src/lib/util/conjuntos.ts`, `apps/storefront/src/lib/util/conjuntos.test.ts`

**Interfaces (produces):**
```ts
// Resposta das rotas Store (F1)
export type RegraStore = { tipo_desconto: "menor_peca_percentual" | "menor_peca_valor" | "total_percentual" | "total_valor"; valor: number }
export type ParStore = { handle: string; categoria_a: string; categoria_b: string; product_ids: string[] }
export type ColecaoStore = { collection_id: string; regra: RegraStore; pares: ParStore[] }
export type CuradoStore = { id: string; nome: string; handle: string; capa_url: string | null; product_ids: string[]; regra: RegraStore }
export type VitrineStore = { curados: CuradoStore[]; colecoes: ColecaoStore[] }

export type PecaCard = { id: string; handle: string; title: string; thumbnail: string | null; precoMin: number | null /* centavos, só variantes disponíveis */ }
export type CardConjunto = { tipo: "curado" | "colecao"; handle: string; nome: string; capa: string | null; pecas: PecaCard[]; precoCheio: number; precoComBeneficio: number; economia: number; regra: RegraStore; collection_id: string | null }

export function descontoConjunto(regra: RegraStore, precos: number[]): number[]           // espelho do backend, centavos
export function precoMinDisponivel(p: HttpTypes.StoreProduct): number | null            // menor calculated_amount entre variantes disponíveis, centavos
export function precosConjunto(regra: RegraStore, precos: number[]): { cheio: number; comBeneficio: number; economia: number }
export function conjuntoDisponivel(pecas: PecaCard[]): boolean                            // todas com precoMin !== null
export function montarCardPar(par: ParStore, colecaoId: string, regra: RegraStore, produtos: Map<string, HttpTypes.StoreProduct>): CardConjunto | null
export function montarCardCurado(c: CuradoStore, produtos: Map<string, HttpTypes.StoreProduct>): CardConjunto | null
export function descricaoRegra(regra: RegraStore, n: number): string                     // "20% na peça de menor valor" · "R$ 45,00 no conjunto (R$ 22,50 por peça)" …
export function corParceira(parceira: HttpTypes.StoreProduct, corAtual: string | null): string | null // normalizeColorName; senão 1ª cor com variante disponível
export function elegibilidade(vitrine: VitrineStore, raizes: Map<string, string>): (collection_id: string | null, categoryIds: string[]) => boolean
export function slotMetadata(conjuntoHandle: string, i: number, agora = Date.now()): { conjunto_slot: string }
export function formatarReais(centavos: number): string                                  // "R$ 1.234,56"
```

- [ ] **Step 1: Testes (falhando)** — cobrir: `descontoConjunto` nos 4 tipos (18900/25900: menor peça 20% → [3780,0]; menor peça R$ 5000 → [5000,0]; total 10% → [1890,2590]; total R$ 4500 → [2250,2250]; limite ao preço da unidade); `precoMinDisponivel` (ignora variante esgotada; `manage_inventory: false` conta; sem preço → null); `precosConjunto` (cheio 44800, benefício 41020, economia 3780); `montarCardPar` (nome "Top Aura + Legging Vértice", fotos, preços; peça esgotada → null; produto ausente → null); `montarCardCurado` (capa do cadastro; sem capa → capa null e fotos das peças); `descricaoRegra` para os 4 tipos (n=2 e n=3); `corParceira` ("Verde Exercito" atual × parceira com "Verde Exército" disponível → canônica da parceira; parceira sem a cor → primeira disponível; nenhuma → null); `elegibilidade` (coleção com regra + raiz em par → true; raiz fora → false; sem coleção → false); `slotMetadata` formato `"<handle>#<i>#<ts>"`.
- [ ] **Step 2: Rodar e ver falhar.**
- [ ] **Step 3: Implementar** (usar `isVariantAvailable`, `optionValue`, `normalizeColorName`, `resolveColor` existentes; nomes das peças = `product.title`; `precoCheio` = soma dos `precoMin`; `comBeneficio` = cheio − soma de `descontoConjunto(regra, precos)`).
- [ ] **Step 4: Seed local** `seed-dev-conjunto.ts` (padrão de `apps/backend/src/scripts/seed-eclat.ts`; `medusa exec ./src/scripts/seed-dev-conjunto.ts`): recusa se `process.env.DATABASE_URL` não contiver `localhost`/`127.0.0.1`; idempotente (procura por handle); cria região "Brasil" BRL/`br`, canal "Loja", chave publicável (imprime `pk_…`), categorias raiz `tops/shorts/leggings/macaquinhos` (+ `conjuntos`), coleção `Família Blackout` (`familia-blackout`), produtos publicados com opção Tamanho (P/M/G) × Cor (Verde Exército, Licor), preços 189/259/159/299, `manage_inventory: false`; regra padrão `menor_peca_percentual` 20 **ativa** + `sincronizarPromocao`; pares `leggings+tops`, `shorts+tops`; um curado "Look Blackout" (top + legging) `total_valor` 4500. Rodar contra `eclat_dev` (contêiner) e registrar a saída.
- [ ] **Step 5: `npm test --workspace=apps/storefront`** (122 → ~140), `tsc` storefront e backend limpos. Commit — `feat(vitrine): módulo puro de conjuntos + seed local do backend para validação`.

---

### Task 2: Camada de dados do storefront

**Files:**
- Create: `apps/storefront/src/lib/data/conjuntos.ts`
- Modify: `apps/storefront/src/lib/data/products.ts` (`listProductsByIds`), `apps/storefront/src/lib/data/cart.ts` (`metadata`)

**Interfaces (produces):**
```ts
export async function getVitrineConjuntos(countryCode: string): Promise<{ curados: CardConjunto[]; colecoes: { collection_id: string; titulo: string; handle: string; cards: CardConjunto[] }[] }>
export async function getConjunto(handle: string, countryCode: string): Promise<{ card: CardConjunto; produtos: HttpTypes.StoreProduct[] } | null>
export async function getConjuntosDoProduto(productId: string, countryCode: string): Promise<{ parceiras: HttpTypes.StoreProduct[]; regra: RegraStore | null; curados: CardConjunto[] }>
export async function getElegibilidade(): Promise<(collection_id: string | null, categoryIds: string[]) => boolean>
export async function listProductsByIds(ids: string[], countryCode: string): Promise<HttpTypes.StoreProduct[]>   // lotes de 100, mesmos fields do listProducts
export async function addToCart({ variantId, quantity, countryCode, metadata }: { …; metadata?: Record<string, unknown> })
```
- `sdk.client.fetch` nas rotas `/store/conjuntos`, `/store/conjuntos/${handle}`, `/store/conjuntos/por-produto/${id}` com `cache: "force-cache"`, `next: { revalidate: 300 }`; falha → estruturas vazias + `console.error("[conjuntos]")`.
- Títulos das coleções via `listCollections`; raízes de categoria via `listCategories` + `buildChain`/lógica de raiz (`lib/util/category-chain.ts`).

- [ ] **Step 1: Implementar** (`server-only`).
- [ ] **Step 2: `addToCart` com `metadata`** repassado em `createLineItem`.
- [ ] **Step 3: Verificação contra o backend local** (Task 1 seed rodado; `medusa develop` em `apps/backend` com `DATABASE_URL` do contêiner e `DISABLE_ADMIN=true`): script `tsx` no scratchpad importando os leitores com `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000 NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=<pk do seed>` → imprime a vitrine (1 coleção, pares `legging-vertice--top-aura` e `short-…--top-aura`, 1 curado), o conjunto por handle, as parceiras do top. Parar o `medusa develop` ao final. `tsc` limpo; testes inalterados.
- [ ] **Step 4: Commit** — `feat(vitrine): leitores de conjuntos (Store API + hidratação por ids) e addToCart com metadata`.

---

### Task 3: Página Conjuntos (`/categories/conjuntos`)

**Files:**
- Create: `apps/storefront/src/modules/conjuntos/templates/vitrine.tsx`, `components/card-conjunto.tsx`, `components/grade-colecao.tsx`
- Modify: `apps/storefront/src/app/[countryCode]/(main)/categories/[...category]/page.tsx` (`if (params.category.join("/") === "conjuntos") return <VitrineConjuntos countryCode=… category=… />`)
- Modify: `apps/storefront/src/modules/seo/jsonld.tsx` (`ItemListJsonLd` já serve; nada novo aqui)

**Comportamento (spec §7.1, rulings 1–3):** cabeçalho (nome da categoria + `descricao_curta` do metadata, mesmo `CategoryHeader` se couber), breadcrumb, seção "Escolhidos pela ÉCLAT" (curados, ordem do backend), uma seção por coleção ("Conjuntos <Título da coleção>") com `GradeColecao` (12 + "Ver todos os conjuntos da coleção", estado local), `ItemListJsonLd` com os cards, `Track view_item_list` ("Conjuntos") e por coleção ("Conjuntos: <título>"). Card: duas fotos lado a lado (ou capa), nome, `precoComBeneficio` com `precoCheio` riscado, selo "Benefício Conjunto", link `/conjuntos/<handle>`, `select_item` no clique (`item_list_name` da seção). Estado vazio (nenhum conjunto): texto "Em breve: conjuntos da coleção" + link para `/store`.

- [ ] **Step 1: Implementar.** - [ ] **Step 2: `tsc`; testes.** - [ ] **Step 3: Validar no navegador** (storefront dev com `NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000` + pk local + `COMING_SOON_BYPASS=1`): `/br/categories/conjuntos` mostra "Escolhidos" com o Look Blackout e a coleção Blackout com 2 pares; preços conferem com a conta (top 189 + legging 259, menor peça 20% → 41020 = R$ 410,20, cheio R$ 448,00); canonical sem query; `dataLayer` com `view_item_list`. - [ ] **Step 4: Commit** — `feat(vitrine): página Conjuntos (curados + pares gerados por coleção)`.

---

### Task 4: Página do conjunto (`/conjuntos/[handle]`)

**Files:**
- Create: `apps/storefront/src/app/[countryCode]/(main)/conjuntos/[handle]/page.tsx`, `apps/storefront/src/modules/conjuntos/templates/conjunto.tsx`, `components/conjunto-builder.tsx`, `components/peca-do-conjunto.tsx`, `components/rodape-conjunto.tsx`
- Modify: `apps/storefront/src/modules/seo/jsonld.tsx` (`ConjuntoJsonLd({ nome, url, imagem, precoTotal, moeda, pecas })` → `Product` com `offers.price` = total com benefício e `isRelatedTo` das peças)

**Comportamento (spec §7.2, ruling 4):**
- `page.tsx`: `getConjunto(handle)` → 404 se null; `generateMetadata` (título "Conjunto <nome>", description com as peças, canonical `/${cc}/conjuntos/${handle}`).
- `conjunto.tsx` (server): breadcrumb "Início › Conjuntos › <nome>", `Track view_item` (items = peças), `ConjuntoJsonLd`, `ConjuntoBuilder` com `produtos`, `regra`, `colorMap`, `countryCode`, `nome`, `handle`.
- `conjunto-builder.tsx` (client): estado `selecoes: Record<productId, { variant: StoreProductVariant | null; completa: boolean }>`; renderiza uma `PecaDoConjunto` por produto, cada uma dentro de `<ProductSelectionProvider key={p.id} product={p} initialColor={primeira cor disponível}>` com uma ponte (`useProductSelection` → `useEffect` que chama `onChange(selectedVariant, isComplete)`); galeria (`VariantGallery` com `ssrImages` da cor inicial), `ColorSelect`, `SizeSelect`; total via `precosConjunto(regra, precosDasVariantesEscolhidas || precoMin)`; `RodapeConjunto` fixo (mobile) / lateral (desktop) com preço cheio riscado, total, `descricaoRegra`, botão "Adicionar o conjunto" (desabilitado até todas completas e disponíveis); ao clicar: `addToCart` em sequência com `slotMetadata(handle, i)`, `pushEcommerceEvent("add_to_cart", …, item_list_name "Conjunto: <nome>")`, depois abre o mini-cart (mesmo mecanismo do `QuickAdd`: verificar como ele abre — `?cart-open` / evento) e mostra o toast no mobile. Erros inline.
- Guia de medidas: reaproveitar `SizeGuide` por tipo de peça de cada produto, se simples; senão link "Guia de medidas" para a PDP da peça (registrar a escolha).

- [ ] **Step 1: Implementar.** - [ ] **Step 2: `tsc`; testes.** - [ ] **Step 3: Validar no navegador** (backend local): `/br/conjuntos/legging-vertice--top-aura` — trocar cor e tamanho de cada peça, rodapé atualiza, botão só habilita com as duas completas, "Adicionar o conjunto" cria **duas linhas** no carrinho (conferir `GET /store/carts/:id`: 2 itens com `metadata.conjunto_slot` distintos e ajuste `CONJUNTO-…` na peça mais barata); repetir a adição → 4 linhas (não fundiu); handle invertido → 404; `/br/conjuntos/look-blackout` (curado) funciona; JSON-LD presente. Se o Medusa **fundir** linhas apesar do metadata, registrar e aplicar o fallback (b) da spec §6.3 no relatório (o gancho marca a linha inteira) — decisão do controller. - [ ] **Step 4: Commit** — `feat(vitrine): página do conjunto (cor/tamanho por peça, total com benefício, adicionar em linhas separadas)`.

---

### Task 5: "Complete o conjunto" na PDP + selo "Forma conjunto" no card

**Files:**
- Create: `apps/storefront/src/modules/products/components/complete-set/index.tsx` (server) e `parceira.tsx` (client)
- Modify: `apps/storefront/src/modules/products/templates/index.tsx` (bloco dentro do provider, abaixo da grade)
- Modify: `apps/storefront/src/lib/util/product-card-data.ts` (`formaConjunto?: boolean` no `ProductCardData`, parâmetro opcional em `buildProductCardData`), `product-card/index.tsx` (selo discreto "Forma conjunto", sem colidir com o `badge`), `product-preview/index.tsx` (recebe `formaConjunto`), `store/templates/product-listing.tsx` (chama `getElegibilidade()` uma vez e passa por card)

**Comportamento (spec §7.3, §7.4, rulings 5–6):** `CompleteSet` chama `getConjuntosDoProduto(product.id)`; sem parceiras e sem curados → `null`. Parceiras (até 6): card com foto (cor via `corParceira`), nome, preço, `SizeSelect` inline próprio (variantes da parceira na cor escolhida; `sizeAvailability`), "Adicionar as duas": pega `selectedVariant` da página via `useProductSelection` (desabilitado sem tamanho na página ou na parceira), `addToCart` ×2 com `slotMetadata(`${a}--${b}`, i)`, evento `add_to_cart` (`item_list_name: "Complete o conjunto"`), mini-cart. Texto acima: `descricaoRegra` ("Leve as duas com 20% na peça de menor valor"). Curados: cards `CardConjunto` com link. Selo no card: "Forma conjunto" (texto pequeno, dourado) quando `formaConjunto`.

- [ ] **Step 1: Implementar.** - [ ] **Step 2: `tsc`; testes (`buildProductCardData` ganha 1 teste para `formaConjunto`).** - [ ] **Step 3: Validar no navegador** (backend local): PDP do Top mostra "Complete o conjunto" com legging e short; escolher tamanho no top e na legging → "Adicionar as duas" cria 2 linhas com metadata; `/br/store` mostra o selo nos 3 produtos elegíveis e não no macaquinho. - [ ] **Step 4: Commit** — `feat(vitrine): "Complete o conjunto" na PDP e selo "Forma conjunto" no card`.

---

### Task 6: Aceite, docs e registro

**Files:**
- Modify: `architecture/catalog.md` (seção "Conjuntos na vitrine (Fase F3)"), `architecture/conjunto.md` ("O que a F3 consome" → entregue; nota sobre linhas separadas e o resultado do teste de fusão), `progress.md`, `CLAUDE.md` (linha da vitrine), spec §7 (status F3; ajustes que a implementação impôs), `docs/superpowers/specs/…` §6.3 (resultado empírico do `metadata.conjunto_slot`)

- [ ] **Step 1: Suítes completas** (storefront, backend, cockpit) + `tsc` nos três.
- [ ] **Step 2: Aceite spec §11 itens 5–8** no navegador contra o backend local semeado (registrar PASSOU/FALHOU com evidência): 5 `/categories/conjuntos` lista curados e gerados, conjunto sem peça disponível some (desativar estoque de uma peça no seed e reexecutar? — usar `manage_inventory: true` com 0 para o short e conferir que o par `short--top` some); 6 página do conjunto adiciona as duas variantes; 7 PDP "Complete o conjunto" + "Adicionar as duas"; 8 selo no card.
- [ ] **Step 3: Docs + roteiro para o dono** em produção (depois de ativar a regra padrão): abrir `/br/categories/conjuntos`, um conjunto, uma PDP de top; conferir preços; adicionar e ver o desconto no carrinho.
- [ ] **Step 4: Commit** — `docs(vitrine): F3 Benefício Conjunto — páginas, PDP, selo, aceite`.

---

## Self-review

- **Cobertura da spec:** §7.1 (T3), §7.2 (T4), §7.3/§7.4 (T5), §7.6 SEO (T3/T4), §7.7 tracking (T3–T5), §6.3 linhas separadas (T2 `metadata` + T4 verificação empírica), §6.5 hidratação (T2), §11 itens 5–8 (T6). §7.5 (carrinho: etiquetas, linha do benefício, gatilhos, aviso de cupom) é **F4**.
- **Placeholders:** nenhum; T3–T5 descrevem comportamento sobre componentes existentes nomeados; o código puro (T1) tem assinaturas completas e casos de teste enumerados.
- **Consistência de tipos:** `RegraStore/ParStore/CuradoStore/VitrineStore/CardConjunto/PecaCard` (T1) usados em T2–T5; `getVitrineConjuntos/getConjunto/getConjuntosDoProduto/getElegibilidade/listProductsByIds` (T2) usados em T3–T5; `slotMetadata` (T1) em T4/T5; `descricaoRegra` em T4/T5.
- **Riscos assumidos:** fusão de linhas pelo Medusa apesar do `metadata` (T4 verifica; fallback documentado); backend local exige seed (T1) e `medusa develop`; produção com regra inativa até o dono ativar (roteiro na T6).
