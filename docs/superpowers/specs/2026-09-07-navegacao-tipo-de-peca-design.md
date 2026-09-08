# Spec — Navegação por tipo de peça (frente 1 do lançamento)

> Data: 2026-09-07 · Status: rascunho para revisão do dono · Escopo: `apps/storefront` + telas de apoio em `apps/cockpit`
> Spec 2 (Benefício Conjunto) depende desta e será escrita em seguida.

## 1. Contexto e objetivo

A ÉCLAT entra na fase final de lançamento. A vitrine tem base técnica sólida (Next 15, Medusa 2.15.5, SEO/GEO, PDP de conversão, wizard "Minha ÉCLAT"), mas a **descoberta de produto** ainda é a do starter Medusa: sem filtros, card pobre, cor e tamanho tratados como botões iguais.

Objetivo desta spec: a cliente encontra a peça certa em três cliques a partir de qualquer página, escolhendo por **tipo de peça**, **cor** e **tamanho**, com o estoque real visível antes de abrir o produto.

## 2. Decisões já tomadas (não reabrir)

| Decisão | Motivo |
|---|---|
| **Eixo principal de navegação = tipo de peça**, nesta ordem: Top · Short · Legging · Macaquinho/Macacão · Conjuntos · Acessórios (Óculos, Meias) · Masculino (Bermudas, Camisetas/Regatas). | Catálogo com 8 modelos; é o que o Medusa já tem como categoria; é o que o wizard já pergunta. |
| **Feminino é o padrão implícito e não ganha rótulo.** Masculino e Acessórios são categorias-mãe com subcategorias, no fim do menu. | Foco da marca é a peça feminina; masculino e acessórios têm venda menor e não podem competir por atenção com o eixo principal. |
| **Modalidade (treino, casual, pilates…) não existe em lugar nenhum do site.** Nem categoria, nem filtro, nem texto "ideal para". | Peças iguais em páginas diferentes confundem (efeito Alo Yoga); contradiz a promessa "mulher inteira"; duplica conteúdo para SEO. |
| **Eixo secundário = coleção** (Família Blackout hoje, próximas depois). | Conjuntos de produtos realmente diferentes entre si; é a narrativa da marca ("cada coleção, um capítulo"). |
| **Conjuntos é categoria, mas conjunto é regra, não SKU.** | Detalhado na spec 2. Esta spec só garante que a categoria exista na navegação. |
| Regra para decidir se algo vira categoria: **só se os resultados se sobrepõem menos da metade.** Senão é filtro ou conteúdo. | Evita repetir o erro de modalidade com qualquer eixo futuro. |

## 3. Escopo

**Dentro:** dados de catálogo necessários, navegação (desktop, mobile, breadcrumb, home), listagem com filtros, card de produto, seletores da PDP, galeria por cor, guia de medidas por tipo, busca com sugestões, ligação do wizard, tracking de lista, canonicals faltantes, telas de apoio no Cockpit.

**Fora (outras specs ou dependências externas):** Benefício Conjunto (spec 2); parcelamento e Pix (Mercado Pago, Parte 4); frete por CEP (Melhor Envio); avaliações reais; wishlist; mega-menu com conteúdo editorial além de foto por categoria; migração para buscador externo.

## 4. Dados de catálogo (Medusa, geridos pelo Cockpit)

Princípio: **acertar o dado uma vez alimenta quatro telas** (card, filtro, seletor da PDP, galeria).

### 4.1 Categorias
Árvore final (nome exibido → handle). Handles existentes são mantidos para não quebrar URLs já no feed e no sitemap; só o nome exibido muda.

```
Top                    → tops
Short                  → shorts
Legging                → leggings
Macaquinho / Macacão   → macaquinhos
Conjuntos              → conjuntos
Acessórios             → acessorios
├── Óculos             → oculos
└── Meias              → meias
Masculino              → masculino
├── Bermudas           → bermudas
└── Camisetas / Regatas → camisetas-regatas
```

- Os handles das filhas são **FLAT** no Medusa (`oculos`, `meias`, `bermudas`, `camisetas-regatas` — não `acessorios/oculos` etc.). A forma com caminho (`acessorios/oculos`) é derivada em runtime subindo a cadeia de `parent_id` (`categoryPath`, `apps/cockpit/lib/catalog-rules.ts`) e serve só como chave de `site_content.medidas` (4.4) e para a regra de acessório (`isAccessoryHandle`) — **nunca** como segmento de URL. `getCategoryByHandle` (`apps/storefront/src/lib/data/categories.ts`) hoje consulta o Medusa pelo `handle` simples; URLs aninhadas como `/categories/masculino/bermudas` **não são suportadas** por ela. Enquanto isso não muda (fase 4), o breadcrumb (5.3) deve linkar cada nível pelo seu próprio handle flat (`/categories/masculino`, `/categories/bermudas`), não por um caminho composto.
- As cinco primeiras são o **eixo feminino** e não têm filhas. Acessórios e Masculino são categorias-mãe: a página da mãe lista tudo das filhas, com chips para entrar em cada filha. A rota `categories/[...category]` já suporta o aninhamento.
- Ordem de exibição pelo campo nativo `rank` (o Cockpit já edita rank em `components/taxonomy-manager.tsx`), respeitando a ordem acima.
- Por categoria, em `metadata`: `image_url` (capa, usada no menu, na home e no cabeçalho da listagem), `descricao_curta` (1 linha, cabeçalho da listagem).
- A vitrine só exibe categoria com pelo menos um produto publicado (regra atual de `category-bar` mantida). **Exceção: `conjuntos`** não terá produtos (conjunto é regra, não SKU) e aparece sempre que houver ao menos uma regra de conjunto ativa; a página em si é definida na spec 2. Até lá, a categoria existe no Medusa mas fica oculta na navegação.

### 4.2 Opções de variante
- Todo produto de **vestuário** (feminino e masculino) tem exatamente duas opções, com títulos fixos **`Tamanho`** e **`Cor`**. Valores de tamanho: `P`, `M`, `G`, `GG`. Valores de cor: nome canônico idêntico entre produtos (ex.: `Verde Exército`, `Licor`, `Off-white`).
- **Acessórios** têm sempre `Cor`; `Tamanho` é opcional (meias podem usar `34-38`, `39-43`; óculos não têm tamanho). Os filtros de tamanho na listagem são montados a partir dos valores realmente presentes, nunca de lista fixa.
- O Cockpit valida ao criar/editar produto: título das opções e, em vestuário, valores de tamanho fora do padrão bloqueiam o salvamento com mensagem clara. Cor fora do mapa de cores (4.3) gera aviso, não bloqueio.
- Script de verificação `scripts/check-catalog-options.py` lista produtos fora do padrão (rodar antes do D0 sobre a Família Blackout).

### 4.3 Mapa de cores
- Chave `cores` em `site_content` (Supabase), valor `{ "<nome canônico>": { "hex": "#3B4A2F", "swatch_url": "<opcional: foto do tecido>" } }`.
- Editado no Cockpit → Vitrine → aba **Cores** (lista nome, hex com color picker, upload opcional de swatch).
- A vitrine lê uma vez por request (`getSiteContent("cores")`, revalidate 30s já existente) e cai em cinza neutro com o nome por extenso se a cor não estiver no mapa.

### 4.4 Guia de medidas por tipo de peça
- Chave `medidas` em `site_content`, valor por handle de categoria: colunas e linhas. Ex.: `leggings` → colunas Cintura/Quadril; `tops` → Busto/Cintura; `shorts` → Cintura/Quadril; `macaquinhos` → Busto/Cintura/Quadril; `masculino/bermudas` → Cintura/Quadril; `masculino/camisetas-regatas` → Tórax/Comprimento. Subcategoria sem tabela própria herda a da mãe; acessórios sem tabela não exibem o bloco.
- Editado no Cockpit → Vitrine → aba **Medidas** (uma tabela por categoria).
- `size-guide/index.tsx` passa a receber `categoryHandle` e monta a tabela a partir da chave; fallback = tabela atual.

### 4.5 Fotos por cor
- Usa o vínculo nativo `variant.images` (a PDP já filtra por `?v_id`). Regra de cadastro: **todas as variantes de uma mesma cor apontam para o mesmo conjunto de fotos**. O Cockpit ganha, no editor de produto, o agrupamento "Fotos por cor" que aplica o vínculo às 4 variantes de tamanho de uma vez.
- `thumbnail` do produto: **desvio documentado** — em vez de derivada automaticamente (primeira foto da primeira cor), é definida manualmente pelo botão "capa" no bloco Fotos por cor do Cockpit (`components/color-images.tsx`, `medusaSetThumbnail`).
- Dependência externa: as fotos reais por cor (pendentes desde 2026-07-28). Sem elas, swatches trocam para a mesma foto. O código não depende disso para funcionar.

### 4.6 Estoque e "novo"
- Estoque por variante já vem em `+variants.inventory_quantity` (`lib/data/products.ts`). Disponível = `manage_inventory=false` ou `allow_backorder` ou `inventory_quantity > 0` (mesma regra de `product-actions`). Extrair para `lib/util/availability.ts` e usar em card, filtro e PDP.
- "Novo" = `created_at` nos últimos 30 dias **ou** tag `novo`. "Últimas peças" = soma do estoque das variantes da cor selecionada ≤ 3.

## 5. Navegação

### 5.1 Header desktop
- `category-bar` ordena por `rank`, com **Novidades** (→ `/store?ordenar=novidades`) em primeiro, as sete categorias de nível 1 no meio (Top · Short · Legging · Macaquinho/Macacão · Conjuntos · Acessórios · Masculino), **Coleções** e **Ver tudo** no fim. "Nova Coleção" some da barra; a coleção em destaque vive dentro de Coleções e na home.
- Hover em uma categoria **feminina** abre um painel simples: capa da categoria (`metadata.image_url`) + as cores disponíveis naquela categoria como swatches clicáveis (→ `/categories/<handle>?cor=<nome>`). Hover em **Acessórios** ou **Masculino** abre a lista das filhas com miniatura, sem swatches. Implementado em `category-bar` (client island por item); `main-menu/` (código morto) é removido.
- Acessórios e Masculino ficam visualmente mais discretos (peso de fonte normal, cor grafite/60) para não competir com o eixo feminino.
- Hover em Coleções: lista de coleções com produto publicado, capa de cada uma.

### 5.2 Menu mobile (`side-menu`)
- Primeiro nível: as sete categorias com miniatura quadrada (capa) + "Coleções" (expande) + "Ver tudo". Remover o bloco "Linhas (Treino, Casual…)".
- Segundo nível só em Acessórios e Masculino: tocar expande as filhas inline (acordeão), com a mãe clicável em "Ver tudo de Masculino". As cinco categorias femininas abrem direto.

### 5.3 Breadcrumb visível
- Componente `common/components/breadcrumb` renderizado na listagem (Início › Legging; Início › Masculino › Bermudas) e na PDP (Início › Legging › Legging Vértice; Início › Masculino › Bermudas › Bermuda X). Fonte: a categoria mais profunda do produto, subindo pelos pais. O `BreadcrumbJsonLd` existente passa a receber os mesmos itens (uma fonte só).
- Cada nível do breadcrumb linka pelo **handle flat** daquela categoria (`/categories/masculino`, depois `/categories/bermudas`) — não por um caminho composto (`/categories/masculino/bermudas`), que `getCategoryByHandle` não resolve hoje (ver 4.1).

### 5.4 Home
- Novo bloco **"Compre por peça"** logo abaixo do hero: grade **só das cinco categorias femininas** (Top, Short, Legging, Macaquinho/Macacão, Conjuntos) com capa e nome, ordem por `rank`. Acessórios e Masculino não entram na home; vivem no menu e no footer. Sem CMS próprio: lê categorias direto. A seção `featured-lines` (CMS) continua disponível para campanhas.
- Ordem das categorias na home respeita a preferência de **estilo** do wizard (ver 10).

## 6. Listagem (PLP): `/store`, `/categories/[handle]`, `/collections/[handle]`

### 6.1 Pipeline de dados
`listProductsWithSort` já busca até 100 produtos e ordena em memória. Manter a estratégia e acrescentar **filtro em memória** antes da ordenação:

```
fetch (categoria/coleção, até 100, com variantes+preço+estoque)
  → filtrar (tamanho, cor, preço, disponível)
  → ordenar
  → paginar (24)
  → facetas (contagens calculadas sobre o conjunto ANTES do filtro atual, por faceta)
```

- Um produto passa no filtro de tamanho/cor se **alguma variante disponível** tem aquele valor. Tamanho e cor combinados exigem a mesma variante (P **e** Verde na mesma variante).
- Preço usa `calculated_price` da variante mais barata. Faixa em centavos.
- Limite conhecido: acima de ~100 produtos por listagem, migrar tamanho/cor para o filtro nativo `variants.options.value` da Store API (validado disponível na 2.15.5) e preço para pós-filtro. Registrar em `architecture/catalog.md`.

### 6.2 URL
Query params em português, estáveis e compartilháveis:

| Param | Valores | Exemplo |
|---|---|---|
| `tamanho` | lista separada por vírgula | `tamanho=P,M` |
| `cor` | nomes canônicos, vírgula | `cor=Verde%20Exército` |
| `preco` | `min-max` em reais inteiros | `preco=150-220` |
| `disponivel` | `1` | só com estoque |
| `ordenar` | `novidades` (padrão) · `menor-preco` · `maior-preco` · `destaques` | |
| `pagina` | inteiro | |

`sortBy`/`page` atuais viram `ordenar`/`pagina` com redirect 308 dos antigos. `destaques` = ordem manual por `metadata.destaque_rank` do produto (Cockpit), fallback novidades. "Mais vendidos" fica fora até existir dado de venda.

### 6.3 Interface
- **Desktop:** coluna esquerda fixa (a `refinement-list` atual cresce): grupos Tamanho (chips P/M/G/GG), Cor (swatch + nome), Preço (dois campos + faixas prontas), "Só disponíveis" (toggle). Cada opção mostra contagem. Ordenação vira select no topo à direita.
- **Mobile:** botão "Filtrar (n)" + "Ordenar" fixos no topo da grade; abrem gaveta inferior (`Dialog` do Headless UI, já dependência). Aplicar fecha a gaveta e atualiza a URL.
- **Chips de filtros ativos** acima da grade, cada um removível, mais "Limpar tudo".
- **Contador**: "12 peças" / "3 peças com os filtros".
- **Estado vazio:** "Nenhuma legging G em Verde Exército." + duas ações: "Ver em outras cores" (remove só `cor`) e "Avise-me" (reusa `notify-me` com a categoria).
- **Cabeçalho da categoria:** capa em faixa curta, nome, `descricao_curta`, e chips das categorias irmãs para troca rápida.
- Paginação: 24 por página, numérica (componente atual). Sem infinite scroll.

### 6.4 SEO
- Canonical da categoria sempre sem query. Página com qualquer filtro ou `pagina>1` recebe `robots: noindex, follow`.
- `ItemListJsonLd` continua listando os produtos da página.

## 7. Card de produto (`product-preview` + `thumbnail`)

- **Swatches de cor** abaixo do título: círculos com o hex do mapa, máximo 5 + "+n". Clicar troca a foto do card para a primeira foto daquela cor e o link passa a levar para a PDP com `?v_id` da variante disponível daquela cor. Cor sem estoque em nenhum tamanho aparece riscada.
- **Segunda foto no hover** (desktop): crossfade para a segunda imagem da cor ativa, se existir.
- **Selos** no canto superior esquerdo, prioridade: Esgotado › Últimas peças › -X% › Novo. Um selo por vez.
- **Tamanhos + adição rápida:** no hover (desktop) surge uma faixa na base da foto com P/M/G/GG da cor ativa; esgotado riscado; clique adiciona ao carrinho sem sair da página e abre o mini-cart. No mobile, ícone "+" abre uma folha inferior com a mesma escolha. Reusa `addToCart` de `lib/data/cart.ts`.
- Card vira client component leve (`product-card.tsx`) recebendo produto já serializado; o server component `product-preview` só prepara os dados (cores, imagens por cor, estoque por variante).
- `quality` da imagem: 50 → **80**. Aspect mantido.
- Tracking: `select_item` no clique, `add_to_cart` na adição rápida (mesmo mapeamento de `analytics/items.ts`).

## 8. Página do produto

- **Seletor de cor** (`option-select` ganha modo `swatch` quando `option.title === "Cor"`): círculo com hex/swatch + nome da cor selecionada ao lado do rótulo. Trocar cor atualiza a galeria client-side (as imagens por cor já vêm no payload via `*variants.images`) e a URL (`?v_id`, `replaceState`), sem recarregar.
- **Seletor de tamanho**: botões P/M/G/GG; tamanho sem estoque **na cor escolhida** aparece riscado e desabilitado, com "Avise-me" ao lado (abre `notify-me` já existente, agora por variante). Ordem P→GG sempre, independente da ordem no Medusa.
- Regra de estado do botão principal mantida ("Escolha as opções" → "Adicionar à sacola" → "Esgotado").
- **Galeria**: pilha vertical mantida no desktop; no mobile vira carrossel horizontal com indicadores (CSS scroll-snap, sem biblioteca). Zoom, vídeo e thumbnails ficam fora desta spec.
- **Guia de medidas** por categoria (4.4).
- **Relacionados**: título "Mais {categoria}" listando a mesma categoria, excluindo o produto atual, priorizando a mesma cor. O bloco "Complete o conjunto" é da spec 2 e substituirá o atual "Complete o look".
- **Breadcrumb** visível (5.3). **Canonical** adicionado.
- Corrigir os textos em inglês de `product-tabs` (Type/Weight/Dimensions, aba de envio) — bug, não feature.

## 9. Busca

- A barra ganha **sugestões ao digitar** (client, debounce 200ms): categorias cujo nome bate, cores do mapa que batem ("verde" → "Ver Verde Exército em Leggings/Tops…") e até 5 produtos via `/store/products?q=`. Enter continua indo para `/busca`.
- `/busca` passa a usar o mesmo pipeline de listagem (filtros, ordenação, paginação) com `q` como filtro extra. Sinônimos simples num mapa local (`lib/util/search-synonyms.ts`: "calça" → leggings, "blusa"/"cropped" → tops, "bermuda" → shorts, "macacão" → macaquinhos).

## 10. Wizard "Minha ÉCLAT" ligado à navegação

- **Tamanho salvo** pré-aplica `tamanho=<X>` ao abrir qualquer listagem sem filtro explícito, com chip removível "Seu tamanho: M". A URL só recebe o param quando a cliente mexe (evita URLs personalizadas em compartilhamento).
- **Estilos escolhidos** reordenam o bloco "Compre por peça" da home (escolhidos primeiro). Nada é escondido.
- Ambos lidos do cookie espelho já existente (`prefs.ts`), no servidor.

## 11. Tracking (dataLayer, GA4)

Adicionar a `analytics/track.tsx` + `items.ts`: `view_item_list` (listagem, com `item_list_name` = categoria), `select_item` (clique no card), `add_to_cart` na adição rápida, evento custom `filter_apply` (`filter_type`, `filter_value`) e `search_suggestion_click`. Sem mudança na CAPI.

## 12. Cockpit (apoio)

| Tela | Mudança |
|---|---|
| Produtos → editor | Validação de opções (4.2); agrupamento "Fotos por cor" (4.5); campo `destaque_rank`. |
| Produtos → categorias | Campos `image_url` (upload) e `descricao_curta` em `metadata`. Rank já existe. |
| Vitrine → **Cores** (nova aba) | CRUD do mapa de cores (4.3). |
| Vitrine → **Medidas** (nova aba) | Tabela por categoria (4.4). |

Rotas: estender `/api/taxonomy/categories` e `/api/products/[id]`; novas chaves em `site_content` gravadas pela rota existente de vitrine.

## 13. Higiene técnica incluída

- Remover `layout/components/main-menu/` (morto) e resquícios de "linhas/modalidade" no `side-menu`.
- Ligar `typescript.ignoreBuildErrors=false` no `next.config.js` do storefront **ao final da fase 2**, corrigindo o que aparecer. `eslint.ignoreDuringBuilds` fica como está por ora.
- Remover `@types/react-instantsearch-dom` e `pg` do storefront (não usados).

## 14. Critérios de aceite (validação no navegador, backend de produção)

1. Barra desktop mostra as 7 categorias na ordem Top · Short · Legging · Macaquinho/Macacão · Conjuntos · Acessórios · Masculino; hover numa feminina mostra capa + swatches e clicar num swatch abre a categoria já filtrada por cor; hover em Acessórios/Masculino lista as filhas; `/br/categories/masculino` lista bermudas e camisetas com chips das filhas.
2. `/br/categories/leggings?tamanho=G&cor=Verde%20Exército` lista só produtos com variante G Verde disponível; chips ativos; contador correto; canonical sem query; `noindex` presente.
3. Mesma URL no mobile: gaveta de filtros abre, aplica, fecha e a grade atualiza.
4. Estado vazio mostra as duas ações e "Ver em outras cores" remove só `cor`.
5. Card: swatch troca foto; hover mostra segunda foto; adição rápida de "M" adiciona a variante certa e abre o mini-cart; tamanho esgotado riscado.
6. PDP: trocar cor troca galeria sem reload e atualiza `?v_id`; tamanho esgotado riscado com "Avise-me"; guia de medidas de legging sem coluna Busto; breadcrumb visível e JSON-LD iguais.
7. Busca: digitar "verde" sugere cor e categorias; "calça" leva a leggings.
8. Wizard com tamanho M salvo: abrir `/br/categories/tops` mostra chip "Seu tamanho: M" e a grade filtrada; remover o chip limpa.
9. Home: bloco "Compre por peça" com as categorias; ordem muda conforme estilos do wizard.
10. `tsc` limpo nos dois apps; zero strings em inglês na PDP; eventos `view_item_list`, `select_item`, `filter_apply` no dataLayer.

## 15. Fases de entrega (cada uma com Halt e validação)

| Fase | Entrega | Depende de |
|---|---|---|
| **F1 Dados + Cockpit** | 4.1–4.6, 12 | — |
| **F2 Listagem** | 6 (pipeline, URL, UI, SEO), 7 (card), 11 | F1 |
| **F3 PDP** | 8 | F1 |
| **F4 Navegação + Home** | 5, 13 | F1 (capas) |
| **F5 Busca + Wizard** | 9, 10 | F2 |

F2 e F3 podem correr em paralelo. Spec 2 (Benefício Conjunto) começa após F2 e F3.

## 16. Riscos e limites conhecidos

- **Fotos por cor** ainda não existem: swatches funcionam, mas trocam para a mesma foto até o cadastro. Não bloqueia o código.
- **Filtro em memória** tem teto de 100 produtos por listagem (limite da chamada atual). Plano de migração descrito em 6.1.
- **Gate "Em breve"** está ativo em produção: nada desta spec é visível ao público até o D0. Validar em preview da Vercel ou em dev contra o backend de produção.
- **Build ignora erros de tipo** hoje; ao ligar a checagem podem aparecer erros antigos fora do escopo. Corrigir só o que bloquear o build.
