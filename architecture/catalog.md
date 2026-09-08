# architecture/catalog.md — SOP do Catálogo (Parte 1)

> Schema de referência do catálogo da use.ÉCLAT (Data-First). APROVADO em 2026-06-13.
> Mapeado aos primitivos do Medusa v2. Toda mudança estrutural do catálogo se documenta aqui primeiro.

## 1. Mapeamento aos primitivos do Medusa v2
| Conceito Éclat | Primitivo Medusa | Observações |
|---|---|---|
| Peça | **Product** | title, subtitle, handle, description, thumbnail, images, status |
| Variação vendável | **Variant** | SKU próprio, preço (BRL centavos), estoque |
| Eixos de variação | **Product Options** | `Tamanho` e `Cor` |
| Tipo de peça | **Category** (1 nível) | navegação principal da vitrine |
| Drop/linha editorial | **Collection** | curadoria, opcional por produto |
| Filtros | **Tags** | ex.: "alta compressão", "cintura alta" |
| Ficha técnica | **Metadata** (product) | chaves padronizadas (seção 6) |
| Canal de venda | **Sales Channel** | usar o "Default Sales Channel" (vitrine) |

## 2. Opções e variantes
Toda peça de vestuário tem **duas opções**:
- **Tamanho:** `P`, `M`, `G`, `GG` (grade global; pode ser estendida por produto se necessário).
- **Cor:** livre por produto (ex.: Preto, Areia, Vinho, Verde Musgo).

**Variantes = Tamanho × Cor.** Cada variante tem SKU, preço e estoque próprios.

### Convenção de SKU
`ECL-<TIPO>-<SLUG>-<COR>-<TAM>`
- `<TIPO>`: 3 letras do tipo (LEG, TOP, SHO, CAL, BLU, MAC, CON, CAS)
- `<SLUG>`: nome curto da peça (maiúsculas, sem espaço)
- `<COR>`: 3 letras da cor (PRT, ARE, VIN, MUS…)
- `<TAM>`: P | M | G | GG

Ex.: `ECL-LEG-RESPLENDOR-PRT-M`

## 3. Categorias (por tipo de peça — 1 nível)
- Leggings
- Tops & Sutiãs
- Shorts
- Calças
- Blusas & Cropped
- Macacões
- Conjuntos
- Casacos & Jaquetas

Cada produto pertence a **uma** categoria principal. Hierarquia pode evoluir em fase futura.

## 4. Coleções (editorial / drops)
Agrupamentos de curadoria, independentes da categoria. Um produto pode estar em 0 ou 1 coleção.
Exemplos iniciais: **"Resplendor"** (carro-chefe), **"Luz Primeira"** (lançamento).

## 5. Preço, região e moeda (invariante 3)
- **Região:** Brasil. **Moeda:** BRL. Demo Europe/EUR será **removida**.
- Vitrine: `NEXT_PUBLIC_DEFAULT_REGION` apontando para o Brasil (`br`).
- Preço com imposto incluso (padrão BR) — confirmar tax settings em fase futura.
- **Sobre "centavos inteiros" (invariante 3):**
  - No **Medusa**, o preço é informado em **unidade decimal da moeda** (ex.: `199.90` = R$ 199,90).
    O Medusa armazena/calcula via **BigNumber** (não usa float em operação de dinheiro). Esse é o contrato do Medusa.
  - O invariante "centavos inteiros, nunca float" governa **os nossos módulos** (integração Mercado Pago,
    persistência no Supabase, cálculos do Cockpit): ali, dinheiro trafega como inteiro em centavos.
  - Regra prática: ao sair/entrar do Medusa, converter centavos ↔ decimal de forma explícita e centralizada.

## 6. Ficha técnica (metadata do produto) — chaves padronizadas
| Chave | Tipo | Exemplo |
|---|---|---|
| `composicao` | string | "78% poliamida, 22% elastano" |
| `compressao` | enum string | "alta" \| "media" \| "leve" |
| `caimento` | enum string | "justo" \| "regular" \| "solto" |
| `cuidados` | string | "Lavar à mão. Não usar secadora. Não passar." |
| `modelo_veste` | string | "Modelo 1,70 m veste M" |
| `guia_medidas` | string/url | tabela de medidas por tamanho (texto ou link) |

> Regra: metadata é só leitura de ficha. Nada de preço/estoque em metadata (esses são primitivos).

## 7. Status e publicação
- Fluxo: `draft` → `published`. Só `published` aparece na Store API / vitrine.
- Toda peça publicada deve ter: ≥1 imagem, todas as variantes com preço BRL e estoque definido.

## 8. Fonte da verdade (invariante 2)
- Medusa é dono de produto, variante, preço, estoque. Supabase **não** escreve catálogo.
- Imagens podem ser hospedadas em storage (definir provider em fase futura; por ora, URLs).

## 9. Pendências para a implementação
- [ ] Criar região Brasil/BRL e remover Europe/EUR (ajustar default region da vitrine).
- [ ] Garantir opções Tamanho (P/M/G/GG) e Cor na criação de produtos.
- [ ] Criar as 8 categorias e as coleções iniciais.

## Navegação por tipo de peça — dados (Fase 1, 2026-09)
- Árvore de categorias (handles fixos): tops · shorts · leggings · macaquinhos · conjuntos · acessorios{oculos,meias} · masculino{bermudas,camisetas-regatas}. Nome exibido é livre; handle NÃO muda (URL/feed/sitemap). Ordem = `rank`. Capa/descrição em `metadata.image_url` / `metadata.descricao_curta` (Cockpit → Categorias → editar). Script idempotente: `scripts/setup-categorias.py --apply`. Aplicado em produção: 7 raízes ativas (Top, Short, Legging, Macaquinho / Macacão, Conjuntos, Acessórios, Masculino) + 4 filhas; as raízes legadas `treino`/`casual` e as 4 filhas de `casual` foram DESATIVADAS (status inativo, não deletadas).
- Opções de variante: vestuário = `Tamanho` (P/M/G/GG) + `Cor`; acessórios = `Cor` (+ `Tamanho` livre, opcional). Regra em `apps/cockpit/lib/catalog-rules.ts`; a rota `/api/products/create` bloqueia erro (400) e devolve `warnings`. Handles de categoria-filha no Medusa são planos (ex.: `oculos`); o caminho completo (`acessorios/oculos`) é derivado via `parent_id` — `categoryPath(cat, all)` em `apps/cockpit/lib/catalog-rules.ts`. Auditoria: `scripts/check-catalog-options.py` (força UTF-8 na saída para compatibilidade com console Windows).
- Mapa de cores: `site_content.cores` = `{ "<nome canônico>": { hex, swatch_url } }` (Cockpit → Vitrine → Cores). Vitrine: `lib/util/colors.ts` (`resolveColor`, fallback #C9C4BC) + `lib/data/colors.ts`.
- Guia de medidas: `site_content.medidas` = `{ "<handle ou mae/filha>": { columns, rows } }` (Cockpit → Vitrine → Medidas). Vitrine: `lib/util/measurements.ts` (`pickMeasurements` herda da mãe) + `lib/data/measurements.ts`. Seed: `scripts/seed-site-content-catalogo.py --apply` (não sobrescreve).
- Fotos por cor: vínculo nativo imagem↔variante (`POST /admin/products/{id}/images/{image_id}/variants/batch`, Medusa ≥ 2.11.2). Regra: uma foto pertence à cor quando está em TODAS as variantes da cor (`apps/cockpit/lib/color-images.ts`). Na PDP, variante com imagens mostra só as suas; sem imagens, cai nas fotos do produto ("Sem cor").
- Disponibilidade/novidade (fonte única p/ card, filtros e PDP): `apps/storefront/src/lib/util/availability.ts` — disponível = não gerencia estoque ∨ backorder ∨ qty>0; "últimas peças" = soma da cor ≤ 3; "novo" = created_at < 30 dias ∨ tag `novo`.
- Destaques: `product.metadata.destaque_rank` (string numérica; ausente = fora). Cockpit → editar produto.
- Testes de funções puras: `npm test --workspace=apps/storefront` e `--workspace=apps/cockpit` (Vitest).
- [ ] Definir dados reais dos produtos (nomes, cores, preços, imagens) — ou seed de exemplos on-brand.

## Listagem (Fase 2, 2026-09)
- Pipeline em memória (spec §6.1): `listProductsFiltered` (`apps/storefront/src/lib/data/products.ts`) busca **até 100 produtos** do escopo (categoria/coleção/lista de ids) via Store API → `applyFilters` → `sortByKey` → `paginate(24)` → `computeFacets` (todas puras, em `apps/storefront/src/lib/util/catalog-facets.ts`). Teto de 100 é conhecido; acima disso, migrar tamanho/cor para `variants.options.value` na própria Store API.
- Regra tamanho ∧ cor: um produto só aparece quando **a mesma variante disponível** casa tamanho E cor (não é "tem G" + "tem Verde" em variantes diferentes) — `matchesFilters` em `catalog-facets.ts`. Comparação de cor via `normalizeColorName` (acento-insensível). Preço do produto = menor `calculated_amount` entre as variantes; produto sem preço vai por último nas ordenações "menor/maior preço" (`sortByKey`).
- Params de URL em português (spec §6.2), lidos/escritos por `apps/storefront/src/lib/util/catalog-filters.ts`: `tamanho, cor, preco, disponivel, ordenar, pagina`. Legado do starter (`sortBy`/`page`) é migrado por `legacyRedirectQuery` e devolve **redirect 308** para os novos params (sem quebrar links antigos).
- Facetas (`computeFacets`): contagem por tamanho/cor/preço calculada sobre o **escopo completo** (os até 100 produtos), ignorando cada filtro na sua própria dimensão (ex.: contagem de cores ignora o filtro de cor já ativo) — para não fazer a faceta "desaparecer" quando selecionada.
- Ordenação (`sortByKey`): `novidades` (created_at desc), `menor-preco`/`maior-preco` (preço mínimo da variante, sem-preço por último), `destaques` (`metadata.destaque_rank` numérico crescente, ausente por último) — todos com `created_at desc` como desempate.
- `ProductListing` (`apps/storefront/src/modules/store/templates/product-listing.tsx`) é o **ponto único** de listagem: usado por `/store`, `/categories/[handle]` e coleções. Compõe `filter-panel` (desktop) / `filter-drawer` (mobile, Headless UI Dialog) / `active-chips` / `sort-select` / `listing-toolbar` (contador) / `empty-results` (estado vazio com "ver em outras cores" — remove só `cor` — "limpar filtros" e "ver novidades"), via o hook `use-filter-navigation` (router.push com os params corretos + evento `filter_apply`). Cabeçalho de categoria (`apps/storefront/src/modules/categories/components/category-header`) lista filhas (`category_children`) ou irmãs (mesmo `parent_id`, incluindo raízes), só as que têm produto.
- Desvio deliberado da spec §6.3: o contador da listagem (`listing-toolbar.tsx`) usa "n de m peças" quando algum filtro reduz o conjunto (em vez do texto literal da spec) — mais claro para a cliente ver quantas peças o filtro deixou de quantas existiam no escopo.
- Card (dados puros em `apps/storefront/src/lib/util/product-card-data.ts`; UI em `apps/storefront/src/modules/products/components/product-card/{index,badge,swatches,quick-add}.tsx`): swatch troca a foto exibida (estado local `active`); segunda foto no hover via CSS (`group-hover:opacity-100`, sem JS); selo com prioridade (esgotado > últimas peças > promoção > novo); faixa de adição rápida por tamanho (esgotado com `line-through`), desktop no hover / mobile via botão "+"; `ProductPreview` é um wrapper de servidor fino que só resolve `aspect` (`"featured"` = `aspect-[11/14]` no destaque da home; `"portrait"` = `aspect-[9/16]` na grade) a partir de `isFeatured`.
- Eventos (dataLayer, spec §11): `view_item_list` (com `item_list_name`) ao montar a listagem; `select_item` ao clicar num card; `add_to_cart` na adição rápida (com `item_variant` = "Cor / Tamanho"); `filter_apply` (custom, `filter_type` + `filter_value`) a cada mudança de filtro. Toast de confirmação (mobile) em `apps/storefront/src/modules/common/components/toast`, montado no layout `(main)`.
- Bypass do gate "em breve": `COMING_SOON_BYPASS=1` (só é honrado quando `NODE_ENV !== "production"` — `apps/storefront/src/lib/coming-soon.ts`) para testar a vitrine em dev contra o backend de produção sem passar pela página de espera.
- Critérios de aceite (spec §14, itens 2–5 e 10) validados no navegador em 2026-09-08 — ver `progress.md`.

## PDP (Fase 3, 2026-09)
- Contexto de seleção (`apps/storefront/src/modules/products/components/product-selection`): `ProductSelectionProvider` monta com `key={product.id}` (remonta do zero a cada troca de produto), estado inicial a partir de `v_id`/`cor` da URL (SSR determinístico) e a preferência de tamanho do wizard entra depois de hidratar, sem sobrescrever o que a cliente já escolheu. Produto de cor única ou variante única já vem pré-selecionado. Módulo puro `apps/storefront/src/lib/util/pdp-variants.ts` (`initialSelection`, `variantFor`, `selectedColor`, `sizeAvailability`, `isCompleteSelection`) concentra a lógica sem depender de DOM/React — testado em `pdp-variants.test.ts`. `page.tsx` (SSR) chama o mesmo `initialSelection`/`selectedColor`/`imagesForColor` para decidir as fotos do primeiro HTML — uma regra só, cliente e servidor sempre concordam.
- Card → PDP: o link do card manda `?cor=<nome da cor>` (nunca `?v_id`) — a PDP chega com a cor pré-selecionada mas o **tamanho em aberto** (decisão do controller: nunca pré-selecionar um tamanho que a cliente não escolheu; botão fica em "Escolha as opções" até ela clicar um tamanho). Produto sem opção Cor não leva query nenhuma. Um link `?v_id=` compartilhado (ex.: WhatsApp) continua restaurando cor + tamanho completos — `initialSelection` prioriza `variantId` > cor única do produto > `?cor=` > preferência de tamanho do wizard.
- `?v_id`: só atualiza quando a seleção fica **completa** (cor + tamanho resolvem uma variante); a cor sozinha nunca vai para `?v_id` (só para `?cor=`, e só quando vem do card). Atualização via `window.history.replaceState(null, "", url)` — passar `null` como estado (e não o `window.history.state` atual) faz o Next 15.5 copiar seu próprio estado interno e ressincronizar `useSearchParams`; passar o state atual faz o Next detectar `__NA` e pular a atualização da sua URL canônica interna, e o próximo refresh do router (ex.: `addToCart` → `revalidateTag`) sobrescreve a barra de endereço e perde o `?v_id`.
- Seletores em `product-actions/color-select.tsx` (swatch com hex/nome) e `size-select.tsx` (P→GG fixo, independente da ordem no Medusa); tamanho sem estoque na cor escolhida aparece riscado/desabilitado com "Avise-me" ao lado. Cor sem hex/swatch cadastrado no mapa (`resolveColor(...).known === false`): o círculo fica neutro (cor "pedra" de fallback) e o **nome vira texto visível** ao lado/embaixo do círculo (`color-select.tsx` e `product-card/swatches.tsx`) — sem isso duas cores desconhecidas ficam indistinguíveis.
- `NotifyMe` (`components/notify-me`) aparece quando a **seleção fica completa e a variante está sem estoque**, ou quando a cliente clica "Avise-me" ao lado de um tamanho esgotado (mesmo sem cor+tamanho formarem uma variante disponível ainda); grava em `avise_me` (Supabase, RLS anon INSERT-only) com `variant` = rótulo `"Cor / Tamanho"` (ex.: "Verde Exercito / GG"). `notifyFor` (o gatilho manual) limpa a qualquer mudança de seleção — trocar de novo a cor ou o tamanho fecha o aviso anterior. O gatilho "Avise-me" do `SizeSelect` mobile usa o mesmo `onNotify` do desktop (prop repassada de `ProductActions` para `MobileActions`), então o bloco aparece igual nos dois.
- Galeria: `variant-gallery` (client) aplica a regra `imagesForColor` (mesmo módulo usado no SSR de `page.tsx`, uma fonte só) para filtrar as fotos da variante selecionada; `persona-gallery` tem precedência quando a cliente escolheu uma persona no wizard "Minha ÉCLAT" (fotos geradas por IA substituem as fotos reais, com selo). `image-gallery` é quem desenha o carrossel com snap/indicadores no mobile (esconde a barra de rolagem com a classe `.no-scrollbar`, compartilhada com o resto da vitrine); a lista de fotos muda → o carrossel reseta para o primeiro slide.
- Categoria da PDP: quando o produto tem mais de uma categoria, breadcrumb, medidas e relacionados usam a **mais profunda** da árvore, não `categories[0]` — um produto que está na raiz E numa subcategoria não deve prender a página na raiz. `deepestCategoryId`/`buildChain` (`apps/storefront/src/lib/util/category-chain.ts`, puro, testado em `category-chain.test.ts`) resolvem isso a partir da lista completa de categorias; `apps/storefront/src/lib/data/category-path.ts` (`getCategoryChain`, `getDeepestCategoryChain`) faz a leitura via `listCategories()`. Handles são FLAT no Medusa — o caminho é derivado subindo por `parent_category_id` em memória, sem depender de rota aninhada.
- Medidas: a cadeia da categoria mais profunda (acima) vira caminho de handles e alimenta `pickMeasurements(getMeasureMap())` — legging usa a chave `leggings` (Cintura/Quadril, sem Busto); subcategoria sem tabela própria herda da mãe.
- Breadcrumb: `apps/storefront/src/modules/common/components/breadcrumb` é a **única fonte** tanto do nav visível (Início › Legging › Legging Vertice) quanto do `BreadcrumbJsonLd` — mesmos itens, sem duplicidade de `BreadcrumbList` na página. "Início" usa `href: ""` (não `"/"`) — `LocalizedClientLink` já prefixa o país (`/${countryCode}${href}`), então `""` vira `/br` e `"/"` viraria `/br/` (barra dupla incorreta).
- Relacionados: "Mais {categoria}" — categoria mais profunda do produto (ver acima), excluindo o produto atual, produtos da mesma cor primeiro, depois novidades, limite de 8.
- Eventos: `pushEcommerceEvent` (`apps/storefront/src/modules/analytics/push.ts`) é o helper único usado por `product-actions` (add to cart), quick-add do card e `product-card`/`related-products` (`select_item`) — mantém o mapeamento herdado da Fase 2 (`item_variant` = "Cor / Tamanho"). `Track` (`view_item`, montado no template) e `filter_apply` (listagem) continuam com seu próprio `push` direto ao dataLayer — não passam por `pushEcommerceEvent`, são eventos fora do fluxo de variante/carrinho.
- Critérios de aceite (spec §14, itens 6 e 10, escopo PDP) validados no navegador em 2026-09-08 — ver `progress.md`. Pendências fora do código: zoom/vídeo/thumbnails na galeria; parcelamento e CEP (aguardam Mercado Pago/Melhor Envio); avaliações reais (os depoimentos da PDP continuam fixos, sem nota agregada, decisão já registrada em 2026-07-28); "Complete o conjunto" (spec 2, ainda não escrita); fotos reais por cor (cada variante já tem imagem vinculada, mas hoje é o mesmo render para as 3 cores de um produto — troca de swatch não troca a foto visivelmente ainda); hex das cores em `site_content.cores` (Cockpit → Vitrine → Cores, ainda vazio).
