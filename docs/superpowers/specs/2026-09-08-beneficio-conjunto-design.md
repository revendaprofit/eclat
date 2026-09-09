# Benefício Conjunto — Design (Spec 2)

Data: 2026-09-08 · Status: aprovado em conversa, aguardando revisão do dono · Depende de: spec de navegação por tipo de peça (F1–F5 concluídas).

## 1. Contexto e objetivo

As peças da use.ÉCLAT são vendidas separadamente. A marca quer que a cliente **monte conjuntos** (top + bottom da mesma coleção) e receba um benefício de preço por isso, e quer também **curar conjuntos** (inclusive cruzando coleções, para escoar peças). O benefício é uma **condição permanente da loja, não uma promoção**: não tem validade, não tem cupom, não tem limite de uso. O administrador escolhe o tipo de desconto.

Tudo o que a cliente vê deve ser consistente entre vitrine, carrinho, checkout, pedido e Cockpit, sem duplicar produto, preço ou estoque.

## 2. Decisões já tomadas (não reabrir)

1. Peças continuam produtos independentes no Medusa. **Conjunto não é produto**; é uma página montada e uma regra de preço.
2. Categoria `conjuntos` (já existe, handle fixo) vira a vitrine de conjuntos.
3. Conjunto **de coleção** = 1 peça da categoria A + 1 peça da categoria B, ambas da mesma coleção, onde (A, B) é um **par permitido** cadastrado. Cadastro inicial: `tops`+`shorts` e `tops`+`leggings`. Duas leggings não formam conjunto; macaquinho, acessórios e masculino não entram em par de coleção.
4. Conjunto **curado** = lista fixa de 2 ou mais produtos escolhidos pelo admin, de qualquer coleção. Forma-se quando o carrinho tem ao menos 1 unidade de cada produto.
5. Tamanho e cor de cada peça são independentes.
6. **Uma unidade de peça pertence a no máximo um conjunto.** Forma-se o máximo de conjuntos; entre pareamentos com o mesmo número de conjuntos, o de maior desconto total para a cliente. Curados são resolvidos antes dos pares de coleção. **Limite documentado (revisão final):** a implementação testa todas as ordens de processamento dos pares ativos (até 6 pares) e escolhe a que forma mais conjuntos — isso garante o máximo quando os pares ativos formam um grafo em **estrela** (um nó comum, ex.: `tops` ligado a `leggings` e a `shorts`, como o cadastro de hoje), mas **não garante o máximo se os pares formarem um ciclo** (ex.: cadastrar também `leggings+shorts` fecha um triângulo `tops—leggings—shorts—tops`) — nesse caso o pareamento guloso por permutação de ordem pode ficar aquém do máximo teórico de emparelhamento do grafo. Ver §12.
7. Tipos de desconto (admin escolhe um por regra): `% na peça de menor valor` · `R$ na peça de menor valor` · `% sobre o total do conjunto` · `R$ sobre o total do conjunto`.
8. Regra **padrão** da marca vale para toda coleção; uma coleção pode ter **exceção** (regra própria, ou regra própria inativa = sem benefício). Cada curado tem regra própria.
9. **Cupom não desconta unidade em conjunto.** Benefício tem prioridade; o cupom só alcança o que ficou fora.
10. O carrinho e a PDP mostram **gatilhos** para fechar mais um conjunto ("adicione um top da coleção X").
11. A página Conjuntos lista os conjuntos **gerados pelo sistema** (todo par permitido de cada coleção) e os **curados**.
12. Arquitetura A: módulo próprio no Medusa + gancho `setPromotionContext` + promoções automáticas nativas (uma por regra). Desconto nativo, lógica nossa.

## 3. Escopo

**Entra:** módulo `beneficio-conjunto` no backend (dados, regras, gancho, promoções, rotas admin e store, testes); telas do Cockpit; página Conjuntos, página do conjunto, bloco "Complete o conjunto" na PDP, selo no card; carrinho (etiqueta, linha do benefício, gatilhos, aviso de cupom); tracking; SEO das páginas novas.

**Não entra:** conjunto com 3+ peças formado pela cliente (só curado); benefício sobre frete; relatório de conjuntos vendidos no Cockpit (a DRE já soma descontos); imagens compostas geradas (o card usa as fotos das peças); A/B de valores.

## 4. Dados (módulo `beneficio-conjunto`, Postgres do Medusa)

Dinheiro em **centavos inteiros** no módulo (invariante 3). Conversão para o formato do Medusa (unidades decimais) só na hora de criar/atualizar a promoção.

### 4.1 `conjunto_regra`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `creg_…` | |
| `nome` | text | ex.: "Padrão da marca", "Família Blackout" |
| `escopo` | enum `padrao` \| `colecao` \| `curado` | exatamente 1 linha `padrao`; `colecao` exige `collection_id` único; `curado` é 1:1 com `conjunto_curado` |
| `collection_id` | text nullable | só em `colecao` |
| `tipo_desconto` | enum `menor_peca_percentual` \| `menor_peca_valor` \| `total_percentual` \| `total_valor` | |
| `valor` | int | percentual inteiro 1–100, ou centavos ≥ 1 |
| `ativa` | bool | `colecao` inativa = coleção **sem** benefício (não cai no padrão) |
| `promotion_id` | text nullable | promoção automática do Medusa mantida pelo módulo |
| `created_at`/`updated_at` | | |

### 4.2 `conjunto_par` (global)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `cpar_…` | |
| `categoria_a` | text (handle) | ex.: `tops` |
| `categoria_b` | text (handle) | ex.: `leggings`; único por par não-ordenado |
| `ativo` | bool | |

Seed: (`tops`,`shorts`), (`tops`,`leggings`). Handles são os da árvore fixa de `architecture/catalog.md`; a categoria de uma peça é a **raiz** da cadeia (filha conta como a mãe).

### 4.3 `conjunto_curado`
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `ccur_…` | |
| `nome`, `handle` | text | handle único, URL-safe, imutável após criar |
| `capa_url` | text nullable | upload pelo Cockpit (`/admin/uploads`) |
| `product_ids` | text[] | ≥ 2, distintos, de qualquer coleção |
| `regra_id` | fk `conjunto_regra` (escopo `curado`) | |
| `ativo` | bool | |
| `ordem` | int | ordem na vitrine |

### 4.4 Regras de integridade
- Só uma regra `padrao`; criada no seed com `total_percentual` 10% inativa (o dono define e ativa no Cockpit).
- **Ajuste F1 (ruling 2):** a validação do *backend* ao criar/editar um curado exige só que cada `product_id` exista e tenha `status: published` (`query.graph` nas rotas `POST`/`PUT /admin/conjuntos/curados`, `apps/backend/src/api/admin/conjuntos/curados/{route,[id]/route}.ts`). "Sem variante disponível" é **aviso da tela do Cockpit (F2)**, não bloqueio do backend — estoque/variante muda a qualquer momento e não deve acoplar o backend a esse estado. Se um produto do curado ficar indisponível depois (despublicado), o curado some da vitrine (`listarConjuntos`/`conjuntoPorHandle` já filtram por produto publicado) mas continua cadastrado.
- Excluir um curado é permitido (conteúdo do admin); regra e promoção associadas são removidas junto, nessa ordem — promoção primeiro (se der erro que não seja "não encontrada", nada é apagado), depois regra, depois curado. Regras `padrao`/`colecao` nunca são excluídas, só desativadas (§6.6).

## 5. Cálculo (função pura `montarConjuntos`, backend, testada)

Entrada: linhas do carrinho `{ item_id, product_id, variant_id, collection_id, categoria_raiz, preco_unitario (centavos), quantidade }`, regras ativas, pares ativos, curados ativos.

Saída: `{ conjuntos: [{ id, tipo: "curado"|"colecao", regra_id, unidades: [{ item_id, product_id, preco_unitario, desconto_unitario }] }], oportunidades: [{ collection_id, categoria_faltante, a_partir_do_item_id }] }`.

Algoritmo:
1. Expandir cada linha em **unidades** (quantidade N → N unidades com o mesmo `item_id`).
2. **Curados primeiro**, na `ordem` cadastrada: enquanto houver 1 unidade disponível de cada `product_id`, formar 1 conjunto (consome as unidades mais baratas de cada produto).
3. **Pares de coleção**: para cada `collection_id` com regra efetiva ativa (exceção da coleção, senão padrão), para cada par permitido (A, B), formar o **máximo de pares** entre unidades livres de A e de B. Havendo empate no número de pares, escolher o pareamento com **maior desconto total**; empate final desfeito por `item_id` (determinístico).
4. **Desconto por conjunto**, conforme o tipo da regra efetiva: `menor_peca_*` desconta só a unidade de menor `preco_unitario` (empate: **posicional** — a primeira unidade na ordem em que o conjunto é montado, não "menor `item_id`"; num par de coleção é a unidade do **lado A** primeiro, num curado é a ordem cadastrada de `product_ids` — correção de spec, a implementação nunca comparou `item_id`); `total_percentual` desconta cada unidade com o mesmo percentual; `total_valor` reparte o valor em partes iguais por unidade (`round(valor / n)` centavos; n = 2 no par, n = tamanho da lista no curado). Nenhum desconto passa do preço da unidade.
5. **Oportunidades**: para cada unidade livre de categoria A de uma coleção com regra ativa, e cada par (A, B) permitido, registrar `categoria_faltante = B` (deduplicado por coleção + categoria).

Regras que os testes cobrem: 1 top + 1 legging; 2 tops + 1 legging + 1 short → 2 conjuntos; 1 top + 2 leggings → 1 conjunto + 1 oportunidade; curado consome antes do par; quantidade 2 na mesma linha com 1 unidade em conjunto; coleção com exceção inativa → nada; peça de `macaquinhos` nunca pareia; empate de preço determinístico; `total_valor` com arredondamento; desconto nunca maior que a unidade.

## 6. Carrinho (integração com o Medusa)

### 6.1 Gancho
O módulo consome `updateCartPromotionsWorkflow.hooks.setPromotionContext`. Recebe o carrinho, busca coleção e categorias dos produtos das linhas (query graph, uma consulta), roda `montarConjuntos` e devolve o contexto com `items` acrescidos de:
- `conjunto_desconto` — presente em **toda** entrada de contexto, com um de três valores: `regra_id` (unidade que recebe desconto), `"conjunto"` (está num conjunto mas não é a unidade descontada — ex.: a peça mais cara em "menor peça"; o cupom também não a alcança), `"nenhum"` (livre, fora de conjunto). Assim tanto a promoção do conjunto (`eq regra_id`) quanto a exclusão do cupom (`eq "nenhum"`, §6.4) são comparações exatas, sem depender de como o motor trata atributo ausente.

**Ajuste F1 (ruling 4 — corrige o parágrafo original desta seção, que previa também um campo `conjunto_id`):** o contexto **não** carrega `conjunto_id`. Uma mesma linha do carrinho (mesmo `item_id`) pode ter unidades em conjuntos **diferentes** ao mesmo tempo — ex.: top ×2 pareado com uma legging num conjunto e com um short em outro —, então um único `conjunto_id` por entrada de contexto mentiria para qualquer consumidor que confiasse nele. Quem precisa saber qual conjunto formou cada unidade (a vitrine) usa `GET /store/conjuntos/oportunidades?cart_id=` (§6.5), que devolve `conjuntos: ConjuntoFormado[]` já com os `item_id`s corretos por conjunto.

Uma linha com N unidades das quais K estão marcadas (com desconto ou só "em conjunto") vira **uma entrada de contexto por marca presente** com o **mesmo `id`** (correção M4 — "até 3 entradas" era impreciso: uma linha pode ter unidades em conjuntos de regras diferentes ao mesmo tempo, então o teto real é o número de marcas distintas, não um valor fixo) — cada campo monetário da entrada (não só `subtotal`: `total`, `discount_total`, `tax_total` etc., e o `raw_<campo>.value` correspondente) é reescalado por `n/q` para a fração de unidades daquela marca (§6.3 confirma que o motor aplica a promoção só à entrada marcada).

Falha em qualquer ponto → devolve o contexto original e registra `console.error("[conjunto]")`. Carrinho nunca quebra.

### 6.2 Promoções automáticas (uma por regra ativa)
| Tipo da regra | Promoção Medusa (`is_automatic: true`, sem validade, sem limite) |
|---|---|
| `menor_peca_percentual` | `type: standard`, método `percentage`, `target_type: items`, `allocation: each`, `max_quantity: 1000`, `value = valor` |
| `menor_peca_valor` | `standard`, `fixed`, `items`, `each`, `max_quantity: 1000`, `value = valor/100` |
| `total_percentual` | `standard`, `percentage`, `items`, `each`, `max_quantity: 1000`, `value = valor` |
| `total_valor` | `standard`, `fixed`, `items`, `each`, `max_quantity: 1000`, `value = round(valor / n) / 100` (n fixo por regra: 2 para `padrao`/`colecao`, tamanho da lista para `curado`) |

Todas com regra-alvo `attribute: "items.conjunto_desconto", operator: "eq", values: [regra_id]` (prefixo `items.` obrigatório — §6.3), código `CONJUNTO-<regra_id>`, campanha/nome "Benefício Conjunto". `max_quantity: 1000` é obrigatório para `allocation: each` na 2.15.5 e precisa ser alto (§6.3) — nunca `1`, que capa o desconto em 1 unidade independentemente da divisão de contexto do gancho. O módulo cria a promoção ao ativar a regra, atualiza ao editar, e **reconcilia** (recria se alguém apagou/alterou à mão) a cada salvamento no Cockpit. Regra inativa → promoção desativada (`status: inactive`), nunca apagada.

`allocation: across` nunca leva `max_quantity` (o motor rejeita a combinação) — relevante para a conversão de cupons de pedido da F1 (§6.4).

### 6.3 Quantidade > 1 na mesma linha (ponto da F0)
O contexto devolve, para uma linha com N unidades das quais K estão em conjunto, **duas entradas** com o mesmo `id`: uma com `quantity: K` e os atributos, outra com `quantity: N−K` sem. A F0 prova se o motor aplica o desconto só sobre K. Fallbacks, em ordem: (a) o storefront adiciona peças elegíveis sempre em **linhas separadas** (metadata `conjunto_slot` distinto) para que toda linha tenha quantidade 1; (b) marcar a linha inteira e aceitar o desconto em todas as unidades, documentado como limite.

**Decisão F0 (2026-09-08):** o motor aplica a promoção só à entrada de contexto marcada; linhas com N unidades são divididas em duas entradas com o mesmo `id` (K marcadas, N−K não). Fallbacks (a) e (b) não são necessários. Testado com HTTP real contra o Medusa 2.15.5 (`apps/backend/integration-tests/http/conjunto-poc.spec.ts`, casos B e B2): Top ×2 (1 unidade marcada) → desconto R$ 18,90 (não R$ 37,80); Top ×3 (2 marcadas, K=2 de N=3) → desconto R$ 37,80 (não R$ 56,70 nem R$ 18,90) — a divisão de contexto generaliza para K intermediário, não só K=1 ou K=N−1. Duas exigências do motor, não documentadas na doc oficial e confirmadas por leitura de código-fonte, que a F1 tem que seguir: (1) o `attribute` de uma `target_rules` de promoção **automática** precisa do prefixo `items.` (ex.: `items.conjunto_desconto`) — sem ele, o pré-filtro SQL de promoções automáticas descarta a promoção antes da avaliação de regra, e o desconto fica 0 silenciosamente, sem erro; (2) `application_method.max_quantity` é obrigatório quando `allocation: each` e precisa ser um valor ALTO (usar `1000`) — com `max_quantity: 1` o próprio motor capa o desconto em 1 unidade, escondendo se a divisão de contexto do gancho está funcionando ou não.

**Decisão F1 (revisão final — I2):** dividir uma linha em mais de uma entrada de contexto tem um efeito colateral: todas as entradas continuam com o **mesmo `item.id`**, e o motor calcula o desconto de uma promoção sobre o subtotal do item já **líquido** do desconto que outra promoção aplicou ao mesmo `item.id` — mesmo estando em entradas de contexto diferentes. Ou seja, **a linha dividida compartilha a base de desconto entre o conjunto e um cupom que alcança a fração livre da mesma linha** — o cupom não é o valor "ingênuo" (percentual sobre o subtotal cheio da fração livre isolada). Observado empiricamente (`apps/backend/integration-tests/http/conjunto-carrinho.spec.ts`, "caso 10"): top ×3 (R$ 189) + legging ×1 (R$ 259), regra padrão `total_percentual` 20% + `CUPOM10` (itens, 10%, regra de exclusão) → conjunto R$ 89,60 (20% de 189+259, sem interação); cupom R$ 34,02 — não os R$ 37,80 ingênuos (10% de 2×189), e sim 10% de (378,00 − 37,80) = 10% de 340,20, onde 37,80 é o desconto que o conjunto já debitou do mesmo `item.id`. F3/F4 evitam o problema na prática adicionando peças elegíveis sempre em **linhas separadas** (`metadata.conjunto_slot` distinto), para que toda linha tenha no máximo uma marca e nunca precise ser dividida.

### 6.4 Cupom (exclusividade)
**Ajuste F1 (ruling 3 — corrige o parágrafo original desta seção, que previa um "assinante do módulo" em `promotion.created`/`promotion.updated`):** o módulo Promotion do Medusa 2.15.5 não emite esses eventos de domínio, então não existe assinante de evento. A conversão roda nos **ganchos de workflow** `createPromotionsWorkflow.hooks.promotionsCreated` e `updatePromotionsWorkflow.hooks.promotionsUpdated` (`src/workflows/hooks/conjunto-cupom.ts`), que cobrem toda escrita de promoção feita pela Admin API (Cockpit, admin nativo do Medusa) — mesma cobertura pretendida pelo assinante, sem depender de um evento que não existe. Toda promoção cujo código **não** comece com `CONJUNTO-` recebe a regra-alvo `attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"]` — só alcança unidade que o gancho marcou como fora de conjunto (§6.1). Idempotente (promoção já convertida é no-op; promoções `CONJUNTO-*` são ignoradas). Regras existentes na data do deploy são tratadas por `POST /admin/conjuntos/reconciliar` (§6.6), chamado pelo script de produção `scripts/setup-conjunto.py --apply` — não existe (e nunca existiu) `scripts/conjunto-reconciliar-promocoes.py`, citado por engano na versão anterior desta seção.

**Decisão F0:** a regra-alvo `items.conjunto_desconto eq "nenhum"` exclui unidades em conjunto de cupons de itens — testado (caso C, `conjunto-poc.spec.ts`): `CONJUNTO-POC` = R$ 18,90 no top, `CUPOM10` (cupom de itens com a regra de exclusão) = R$ 25,90 na legging, `discount_total` = R$ 44,80, sem tocar a unidade marcada. Cupons de pedido inteiro (`target_type: order`) **não podem carregar `target_rules`**: a Admin API do Medusa 2.15.5 rejeita a criação com `400 invalid_data` ("Target rules for application method with target type (order) is not allowed") — bloqueio explícito no module service (`@medusajs/promotion/dist/services/promotion-module.js:570-574`), testado empiricamente (caso D2) com duas tentativas de payload (sem `allocation`, e com `allocation: across` + `max_quantity`), ambas rejeitadas com a mesma mensagem. Sem a regra, um cupom de pedido alcança 100% do subtotal (inclusive unidades em conjunto): caso D, `PEDIDO10` sozinho sobre um carrinho com `CONJUNTO-POC` já aplicado = R$ 42,91 (nem R$ 44,80 — ignorando a marcação sobre o preço cheio — nem R$ 25,90 — respeitando a marcação); ele opera sobre o subtotal já líquido de descontos anteriores (compounding), não duplica sobre o preço cheio.

**Decisão para a F1:** o assinante do módulo converte qualquer promoção não-`CONJUNTO-` com `target_type: order` em `target_type: items` + `allocation: across` (**sem `max_quantity`** — o motor rejeita `allocation: across` com `max_quantity` presente, `@medusajs/promotion/dist/utils/validations/application-method.js:51-54`, `400 invalid_data`: "application_method.max_quantity is not allowed to be set for allocation (across)") + a regra de exclusão acima (mesma semântica de "x% do pedido inteiro", só que fora do conjunto); a futura tela de cupons do Cockpit só oferece cupom de itens. Testado empiricamente (caso D3, `conjunto-poc.spec.ts`): `PEDIDO10C` (`items`/`across`, sem `max_quantity`, com a regra de exclusão) foi aceito pela Admin API de primeira e, no carrinho top+legging, descontou R$ 25,90 só na legging (`CONJUNTO-POC` intacto em R$ 18,90 no top, `discount_total` R$ 44,80) — não foi preciso o fallback `allocation: each` + `max_quantity: 1000`. Registrado também: a ordem de cálculo entre promoções aplicáveis é `sortByBuyGetType` (promoções `BUYGET` sempre antes de `STANDARD`; dentro do mesmo tipo, por `application_method.value` decrescente) e o valor já aplicado por uma promoção anterior é subtraído do subtotal tanto em `allocation: each` quanto em `across` antes do próximo cálculo — mas como as unidades do conjunto e as unidades alcançadas pelo cupom de itens são disjuntas sob a regra de exclusão, isso não produz compounding entre `CONJUNTO-<regra_id>` e um cupom de itens no mesmo carrinho.

### 6.5 Rotas Store (backend)
**Ajuste F1 (ruling 1 — corrige a coluna "Devolve" desta tabela, que previa produtos completos com preço):** as rotas Store devolvem **estrutura + `product_ids`**, não produtos com preço/foto/estoque — uma fonte só de preço/disponibilidade (menos código duplicado no backend). A vitrine (F3) hidrata com `listProducts({ id })` da Store API, que ela já usa e que respeita o mesmo teto de 100 variantes.

| Rota | Devolve |
|---|---|
| `GET /store/conjuntos` | `{ curados: [{ id, nome, handle, capa_url, product_ids, regra: { tipo_desconto, valor } }], colecoes: [{ collection_id, regra, pares: [{ handle, categoria_a, categoria_b, product_ids }] }] }` — curados ativos (ordem) + gerados por coleção com regra efetiva ativa |
| `GET /store/conjuntos/:handle` | `{ conjunto: { tipo: "curado"\|"colecao", nome, capa_url, handle, product_ids, regra } }` — um conjunto (curado ou par de coleção) pelo handle canônico; `capa_url` é sempre `null` num par de coleção (só curados têm capa) |
| `GET /store/conjuntos/por-produto/:product_id` | `{ parceiras: [{ product_id, categoria_raiz }], curados: [...] }` — parceiras da mesma coleção por par permitido + curados vendáveis (regra ativa) que incluem o produto |
| `GET /store/conjuntos/oportunidades?cart_id=` | `{ conjuntos: ConjuntoFormado[], oportunidades: [{ collection_id, categoria_faltante, a_partir_do_item_id, candidatos: product_id[] }] }` — conjuntos formados no carrinho + oportunidades, cada uma com até 3 `product_id`s candidatos publicados (candidatos **não** excluem produtos já no carrinho: outra unidade do mesmo produto pode fechar um segundo conjunto) |

Handle do gerado: `<handle_A>--<handle_B>` na ordem **canônica** (`categoria_a < categoria_b`, como gravado em `conjunto_par`) — só essa ordem resolve; `<handle_B>--<handle_A>` devolve `404` mesmo que o par exista, para nunca haver duas URLs válidas para o mesmo conjunto. Cache: 5 min (`s-maxage=300, stale-while-revalidate=600`), exceto `oportunidades` (por carrinho, `no-store`).

### 6.6 Rotas Admin (backend, autenticação padrão do Medusa)
**Ajuste F1 (sem DELETE em regras — corrige a linha original, que previa `PUT/DELETE /admin/conjuntos/regras/:id`):** `GET/POST /admin/conjuntos/regras`, `PUT /admin/conjuntos/regras/:id` (body parcial: `nome`/`tipo_desconto`/`valor`/`ativa`; **sem `DELETE`** — regras `padrao`/`colecao` nunca são excluídas, só desativadas com `ativa: false`, §4.4; a regra `curado` é gerida só através de `/admin/conjuntos/curados`, e nunca aparece em `GET /admin/conjuntos/regras`, que filtra `escopo !== "curado"`) · `GET/PUT /admin/conjuntos/pares` (`PUT` substitui a lista inteira) · `GET/POST /admin/conjuntos/curados`, `PUT/DELETE /admin/conjuntos/curados/:id` (`DELETE` apaga promoção → regra → curado, nessa ordem) · `GET /admin/conjuntos/por-produto/:product_id` (painel da ficha) · `POST /admin/conjuntos/reconciliar` (recria/atualiza promoções de todas as regras + converte cupons pendentes, devolve `{ regras, cupons }`). Erros de conflito de unicidade (regra `padrao` duplicada, coleção com exceção duplicada, handle de curado duplicado) usam `MedusaError.Types.DUPLICATE_ERROR`, mapeado pelo framework para `422` (não `409`: o framework só mapeia `409` para `MedusaError.Types.CONFLICT`, que sobrescreve a mensagem por um texto genérico de retry — `DUPLICATE_ERROR` preserva a mensagem em pt-BR).

## 7. Vitrine

### 7.1 Página Conjuntos (`/categories/conjuntos`)
A rota de categoria detecta o handle `conjuntos` e renderiza `ConjuntosTemplate` em vez da listagem de produtos. Seções: "Escolhidos pela ÉCLAT" (curados, ordem do admin) e uma seção por coleção com os gerados (12 por coleção + "Ver todos os conjuntos da coleção", que expande na mesma página). Card: duas fotos lado a lado (thumbnail de cada peça), nome "Top Aura + Legging Vértice", "a partir de R$ X" com preço cheio riscado, selo "Benefício Conjunto". Sem filtros/ordenação. Breadcrumb "Início › Conjuntos". Conjuntos sem peça disponível não aparecem.

### 7.2 Página do conjunto (`/conjuntos/[handle]`)
Peças empilhadas (mobile) ou lado a lado (desktop); cada peça com galeria por cor, seletor de cor e de tamanho (mesmos componentes da PDP: esgotado riscado, "Avise-me"), guia de medidas por tipo. Rodapé fixo com total: preço cheio riscado, total com benefício e a linha explicativa ("Benefício Conjunto: −R$ 45 na peça de menor valor"). Botão "Adicionar o conjunto" habilita quando todas as peças têm variante escolhida; adiciona todas de uma vez (uma chamada por variante, transação visual única) e abre o mini-cart. Curado indisponível → 404 com link para Conjuntos.

### 7.3 PDP das peças — "Complete o conjunto"
Bloco abaixo das ações, só quando `por-produto` devolve algo. Lista as parceiras (até 6, por coleção e par) com foto, nome, preço e seletor de tamanho inline (cor = a cor da parceira mais parecida com a escolhida, senão a primeira disponível); botão "Adicionar as duas" usa a seleção atual da peça da página + a da parceira. Curados que incluem a peça aparecem como cards com link para a página do conjunto.

### 7.4 Card de listagem
Selo "Forma conjunto" no card de peças cuja categoria raiz está em algum par ativo e cuja coleção tem regra efetiva ativa. Calculado com os dados que o card já tem (categorias, coleção) + lista de pares/regras (busca única, cache 5 min).

### 7.5 Carrinho e checkout
- Linhas em conjunto: etiqueta "Conjunto" e, se houver mais de um, "Conjunto 1/2".
- Resumo: "Benefício Conjunto −R$ X" separado de "Cupom −R$ Y" (agrupado pelo prefixo `CONJUNTO-` dos ajustes).
- Gatilhos: bloco "Feche mais um conjunto" com as oportunidades e até 3 candidatas por oportunidade, cada uma com tamanho inline e adição rápida.
- Cupom coexistindo com conjunto: aviso "Cupom não se aplica a peças com Benefício Conjunto".
- Checkout e página do pedido: mesmas etiquetas e linhas.

### 7.6 SEO
`/categories/conjuntos` e `/conjuntos/[handle]` indexáveis, canonical sem query, `ItemList` JSON-LD na vitrine, `Product` (com `offers` do total) na página do conjunto. Curado inativo/indisponível → 404.

### 7.7 Tracking
`view_item_list` (`item_list_name: "Conjuntos"` / `"Conjuntos: <coleção>"`), `select_item`, `view_item` na página do conjunto (items = as peças), `add_to_cart` com `item_list_name: "Conjunto: <nome>"`, evento custom `conjunto_trigger_click` (`collection_id`, `categoria_faltante`). Sem mudança na CAPI.

## 8. Cockpit

Área **Conjuntos** no menu. Só Admin API do backend (rotas §6.6); nada no Supabase.

### 8.1 Tela Regras
- "Benefício padrão": tipo (select com os quatro rótulos em português), valor (campo em % ou R$ conforme o tipo), ativo; prévia ao vivo com exemplo fixo (top R$ 189 + legging R$ 259).
- "Exceções por coleção": tabela coleção · tipo · valor · ativo; "Usar padrão" remove a exceção; coleções sem exceção listadas em cinza com "padrão".
- "Pares permitidos": chips `Top + Short`, `Top + Legging`; adicionar par escolhendo duas categorias raiz; remover.
- Salvar → backend cria/atualiza/reconcilia promoções. Erro do backend aparece inline.

### 8.2 Tela Conjuntos curados
Lista (nome, capa, peças, regra, ativo, ordem por arrastar). Formulário: nome, handle (gerado, editável só na criação), capa (upload existente), busca de produtos com estoque atual (mínimo 2), tipo e valor, ativo. Validações do §4.4; aviso "estoque baixo" por produto. Prévia do card.

### 8.3 Ficha do produto
Painel lateral só leitura "Conjuntos": curados que incluem o produto e parceiras por par (via `por-produto`).

## 9. Testes

- **Puro (backend):** `montarConjuntos` — casos do §5. Jest do Medusa (`medusa test`) ou Vitest no pacote.
- **Integração (backend, banco de teste):** carrinho com top + legging da mesma coleção → ajustes corretos nos quatro tipos; remover peça remove benefício; cupom não alcança unidade em conjunto; regra editada recalcula; quantidade > 1 conforme decisão da F0.
- **Puro (vitrine):** montagem dos gerados, handle derivado, "a partir de", agrupamento do resumo (`CONJUNTO-*`), oportunidades → candidatas.
- **Puro (Cockpit):** validação do formulário de curado, conversão % / R$ ↔ centavos.
- **Aceite no navegador** por fase (dev contra produção), como nas fases anteriores.

## 10. Fases (cada uma com Halt, plano próprio, execução por subagentes)

| Fase | Entrega | Depende de |
|---|---|---|
| **F0 Prova de conceito** | gancho + promoção-alvo num carrinho de teste; decide §6.3 | — |
| **F1 Backend** | módulo, migração, seed, `montarConjuntos`, gancho, promoções, exclusividade do cupom, rotas store/admin, testes; deploy Railway; **primeira escrita em produção** (migração, regra padrão inativa, pares) só com "pode aplicar" — **implementada, aguardando deploy** (código e testes completos em `feat/conjunto-f1-backend`; nada escrito em produção ainda, ver checklist em `architecture/conjunto.md` §14) | F0 |
| **F2 Cockpit** | telas §8 | F1 |
| **F3 Vitrine** | §7.1–7.4, 7.6, 7.7 | F1 |
| **F4 Carrinho** | §7.5, aceite final §11 | F1, F3 |

F2 e F3 podem correr em paralelo.

## 11. Critérios de aceite (navegador, backend de produção, regra padrão ativa em teste)

1. Carrinho com top + legging da mesma coleção recebe o benefício correto em cada um dos quatro tipos (troca da regra no Cockpit reflete no próximo recálculo).
2. 2 tops + 1 legging + 1 short (mesma coleção) → 2 conjuntos; 1 top + 2 leggings → 1 conjunto + gatilho "adicione um top".
3. Cupom aplicado junto: desconta só a peça fora do conjunto; aviso visível.
4. Curado formado com peças de coleções diferentes recebe a regra do curado; curado consome unidades antes do par de coleção.
5. `/categories/conjuntos` lista curados e gerados; conjunto sem peça disponível não aparece.
6. `/conjuntos/<handle>` permite escolher cor/tamanho de cada peça, mostra o total com benefício e adiciona as duas variantes de uma vez.
7. PDP de um top mostra "Complete o conjunto" com leggings/shorts da coleção; "Adicionar as duas" adiciona as variantes certas.
8. Card de peça elegível mostra "Forma conjunto".
9. Pedido concluído e tela do pedido no Cockpit mostram "Benefício Conjunto" separado de cupom.
10. Módulo desligado/erro → carrinho funciona sem benefício.

## 12. Riscos e limites conhecidos

- **Cupons de pedido inteiro (`target_type: order`) não podem excluir unidades em conjunto nativamente**: a Admin API do Medusa 2.15.5 rejeita `target_rules` nesse `target_type` (§6.4). A F1 converte esses cupons em `target_type: items` + `allocation: across` (sem `max_quantity` — o motor rejeita a combinação `across` + `max_quantity`, §6.2) + a regra de exclusão ao criar/atualizar; o Cockpit não oferece a opção de cupom de pedido inteiro. Testado empiricamente (caso D3): aceito de primeira, R$ 25,90 só na legging.
- **`total_valor` com arredondamento**: `round(valor/n)` por unidade pode diferir 1 centavo do valor cadastrado.
- **Promoções editadas à mão** no admin do Medusa quebram a regra até a próxima reconciliação (salvamento no Cockpit ou `POST /admin/conjuntos/reconciliar`).
- **"A partir de"** nos cards pode diferir do total final se variantes tiverem preços diferentes.
- **Volume de gerados** cresce com o catálogo; a vitrine limita a 12 por coleção com expansão.
- **Cupons criados antes do deploy** precisam do script de reconciliação para ganhar a exclusão.
- O gancho roda a cada mudança de carrinho; custo em memória sobre poucas linhas, desprezível.
- **Linha dividida compartilha a base de desconto entre conjunto e cupom** (mesmo `item.id` em entradas de contexto diferentes — ver §6.3 "Decisão F1"): o cupom que alcança a fração livre de uma linha parcialmente em conjunto é calculado sobre o subtotal já líquido do desconto do conjunto no mesmo item, não sobre o valor isolado da fração livre. F3/F4 evitam na prática usando linhas separadas (`metadata.conjunto_slot`) para peças elegíveis.
- **Pareamento guloso com permutações é máximo só para grafos de pares em formato de estrela** (§2, decisão 6): com um **ciclo** de pares (ex.: `tops+leggings`, `tops+shorts` e `leggings+shorts` juntos), o máximo de conjuntos não é garantido — problema de emparelhamento máximo em grafo geral, que a busca gulosa por ordem de processamento não resolve com garantia (precisaria de um algoritmo tipo Blossom). Limite documentado, não corrigido nesta fase; `PUT /admin/conjuntos/pares` pode ganhar um aviso quando os pares ativos deixarem de formar uma estrela.

Achados da execução F1 (registrados, não viraram risco real):
- `model.array()` do DML (`conjunto_curado.product_ids`) gerou `text[]` nativo no Postgres sem precisar do fallback `json` cogitado no plano.
- `updatePromotionsWorkflow` aceitou `application_method.type`/`allocation`/`max_quantity`/`target_type` na atualização sem problema — não foi preciso o fallback de recriar a promoção em vez de atualizar.
- Atualizar `target_type` de um cupom existente (`order` → `items`) funcionou chamando o serviço do módulo Promotion diretamente (`updatePromotions`), sem passar pelo workflow — evita reentrância no próprio gancho `promotionsUpdated`.
- Ver `architecture/conjunto.md` para o SOP completo (dados, contrato do motor, rotas com exemplos, testes, migração, script de produção e checklist de deploy).
