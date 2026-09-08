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
6. **Uma unidade de peça pertence a no máximo um conjunto.** Forma-se o máximo de conjuntos; entre pareamentos com o mesmo número de conjuntos, o de maior desconto total para a cliente. Curados são resolvidos antes dos pares de coleção.
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
- Produto rascunho ou sem variante disponível não pode entrar em curado (validação no admin); se ficar indisponível depois, o curado some da vitrine mas continua cadastrado.
- Excluir um curado é permitido (conteúdo do admin); regra e promoção associadas são removidas junto. Regras `padrao`/`colecao` nunca são excluídas, só desativadas.

## 5. Cálculo (função pura `montarConjuntos`, backend, testada)

Entrada: linhas do carrinho `{ item_id, product_id, variant_id, collection_id, categoria_raiz, preco_unitario (centavos), quantidade }`, regras ativas, pares ativos, curados ativos.

Saída: `{ conjuntos: [{ id, tipo: "curado"|"colecao", regra_id, unidades: [{ item_id, product_id, preco_unitario, desconto_unitario }] }], oportunidades: [{ collection_id, categoria_faltante, a_partir_do_item_id }] }`.

Algoritmo:
1. Expandir cada linha em **unidades** (quantidade N → N unidades com o mesmo `item_id`).
2. **Curados primeiro**, na `ordem` cadastrada: enquanto houver 1 unidade disponível de cada `product_id`, formar 1 conjunto (consome as unidades mais baratas de cada produto).
3. **Pares de coleção**: para cada `collection_id` com regra efetiva ativa (exceção da coleção, senão padrão), para cada par permitido (A, B), formar o **máximo de pares** entre unidades livres de A e de B. Havendo empate no número de pares, escolher o pareamento com **maior desconto total**; empate final desfeito por `item_id` (determinístico).
4. **Desconto por conjunto**, conforme o tipo da regra efetiva: `menor_peca_*` desconta só a unidade de menor `preco_unitario` (empate: menor `item_id`); `total_percentual` desconta cada unidade com o mesmo percentual; `total_valor` reparte o valor em partes iguais por unidade (`round(valor / n)` centavos; n = 2 no par, n = tamanho da lista no curado). Nenhum desconto passa do preço da unidade.
5. **Oportunidades**: para cada unidade livre de categoria A de uma coleção com regra ativa, e cada par (A, B) permitido, registrar `categoria_faltante = B` (deduplicado por coleção + categoria).

Regras que os testes cobrem: 1 top + 1 legging; 2 tops + 1 legging + 1 short → 2 conjuntos; 1 top + 2 leggings → 1 conjunto + 1 oportunidade; curado consome antes do par; quantidade 2 na mesma linha com 1 unidade em conjunto; coleção com exceção inativa → nada; peça de `macaquinhos` nunca pareia; empate de preço determinístico; `total_valor` com arredondamento; desconto nunca maior que a unidade.

## 6. Carrinho (integração com o Medusa)

### 6.1 Gancho
O módulo consome `updateCartPromotionsWorkflow.hooks.setPromotionContext`. Recebe o carrinho, busca coleção e categorias dos produtos das linhas (query graph, uma consulta), roda `montarConjuntos` e devolve o contexto com `items` acrescidos de:
- `conjunto_id` — id do conjunto que a unidade integra (ausente fora de conjunto);
- `conjunto_desconto` — presente em **toda** unidade: `regra_id` nas unidades que recebem desconto (a de menor valor, ou todas, conforme o tipo) e o valor fixo `"nenhum"` em todas as outras. Assim tanto a promoção do conjunto (`eq regra_id`) quanto a exclusão do cupom (`eq "nenhum"`, §6.4) são comparações exatas, sem depender de como o motor trata atributo ausente.

Falha em qualquer ponto → devolve o contexto original e registra `console.error("[conjunto]")`. Carrinho nunca quebra.

### 6.2 Promoções automáticas (uma por regra ativa)
| Tipo da regra | Promoção Medusa (`is_automatic: true`, sem validade, sem limite) |
|---|---|
| `menor_peca_percentual` | `type: standard`, método `percentage`, `target_type: items`, `allocation: each`, `max_quantity: 1000`, `value = valor` |
| `menor_peca_valor` | `standard`, `fixed`, `items`, `each`, `max_quantity: 1000`, `value = valor/100` |
| `total_percentual` | `standard`, `percentage`, `items`, `each`, `max_quantity: 1000`, `value = valor` |
| `total_valor` | `standard`, `fixed`, `items`, `each`, `max_quantity: 1000`, `value = round(valor / n) / 100` (n fixo por regra: 2 para `padrao`/`colecao`, tamanho da lista para `curado`) |

Todas com regra-alvo `attribute: "items.conjunto_desconto", operator: "eq", values: [regra_id]` (prefixo `items.` obrigatório — §6.3), código `CONJUNTO-<regra_id>`, campanha/nome "Benefício Conjunto". `max_quantity: 1000` é obrigatório para `allocation: each` na 2.15.5 e precisa ser alto (§6.3) — nunca `1`, que capa o desconto em 1 unidade independentemente da divisão de contexto do gancho. O módulo cria a promoção ao ativar a regra, atualiza ao editar, e **reconcilia** (recria se alguém apagou/alterou à mão) a cada salvamento no Cockpit. Regra inativa → promoção desativada (`status: inactive`), nunca apagada.

### 6.3 Quantidade > 1 na mesma linha (ponto da F0)
O contexto devolve, para uma linha com N unidades das quais K estão em conjunto, **duas entradas** com o mesmo `id`: uma com `quantity: K` e os atributos, outra com `quantity: N−K` sem. A F0 prova se o motor aplica o desconto só sobre K. Fallbacks, em ordem: (a) o storefront adiciona peças elegíveis sempre em **linhas separadas** (metadata `conjunto_slot` distinto) para que toda linha tenha quantidade 1; (b) marcar a linha inteira e aceitar o desconto em todas as unidades, documentado como limite.

**Decisão F0 (2026-09-08):** o motor aplica a promoção só à entrada de contexto marcada; linhas com N unidades são divididas em duas entradas com o mesmo `id` (K marcadas, N−K não). Fallbacks (a) e (b) não são necessários. Testado com HTTP real contra o Medusa 2.15.5 (`apps/backend/integration-tests/http/conjunto-poc.spec.ts`, casos B e B2): Top ×2 (1 unidade marcada) → desconto R$ 18,90 (não R$ 37,80); Top ×3 (2 marcadas, K=2 de N=3) → desconto R$ 37,80 (não R$ 56,70 nem R$ 18,90) — a divisão de contexto generaliza para K intermediário, não só K=1 ou K=N−1. Duas exigências do motor, não documentadas na doc oficial e confirmadas por leitura de código-fonte, que a F1 tem que seguir: (1) o `attribute` de uma `target_rules` de promoção **automática** precisa do prefixo `items.` (ex.: `items.conjunto_desconto`) — sem ele, o pré-filtro SQL de promoções automáticas descarta a promoção antes da avaliação de regra, e o desconto fica 0 silenciosamente, sem erro; (2) `application_method.max_quantity` é obrigatório quando `allocation: each` e precisa ser um valor ALTO (usar `1000`) — com `max_quantity: 1` o próprio motor capa o desconto em 1 unidade, escondendo se a divisão de contexto do gancho está funcionando ou não.

### 6.4 Cupom (exclusividade)
Assinante do módulo em `promotion.created`/`promotion.updated`: toda promoção cujo código **não** comece com `CONJUNTO-` recebe a regra-alvo `attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"]` — só alcança unidade que o gancho marcou como fora de conjunto (§6.1). Idempotente. Regras existentes na data do deploy são tratadas por script de migração (`scripts/conjunto-reconciliar-promocoes.py --apply`).

**Decisão F0:** a regra-alvo `items.conjunto_desconto eq "nenhum"` exclui unidades em conjunto de cupons de itens — testado (caso C, `conjunto-poc.spec.ts`): `CONJUNTO-POC` = R$ 18,90 no top, `CUPOM10` (cupom de itens com a regra de exclusão) = R$ 25,90 na legging, `discount_total` = R$ 44,80, sem tocar a unidade marcada. Cupons de pedido inteiro (`target_type: order`) **não podem carregar `target_rules`**: a Admin API do Medusa 2.15.5 rejeita a criação com `400 invalid_data` ("Target rules for application method with target type (order) is not allowed") — bloqueio explícito no module service (`@medusajs/promotion/dist/services/promotion-module.js:570-574`), testado empiricamente (caso D2) com duas tentativas de payload (sem `allocation`, e com `allocation: across` + `max_quantity`), ambas rejeitadas com a mesma mensagem. Sem a regra, um cupom de pedido alcança 100% do subtotal (inclusive unidades em conjunto): caso D, `PEDIDO10` sozinho sobre um carrinho com `CONJUNTO-POC` já aplicado = R$ 42,91 (nem R$ 44,80 — ignorando a marcação sobre o preço cheio — nem R$ 25,90 — respeitando a marcação); ele opera sobre o subtotal já líquido de descontos anteriores (compounding), não duplica sobre o preço cheio.

**Decisão para a F1:** o assinante do módulo converte qualquer promoção não-`CONJUNTO-` com `target_type: order` em `target_type: items` + `allocation: across` + `max_quantity: 1000` + a regra de exclusão acima (mesma semântica de "x% do pedido inteiro", só que fora do conjunto); a futura tela de cupons do Cockpit só oferece cupom de itens. Registrado também: a ordem de cálculo entre promoções aplicáveis é `sortByBuyGetType` (promoções `BUYGET` sempre antes de `STANDARD`; dentro do mesmo tipo, por `application_method.value` decrescente) e o valor já aplicado por uma promoção anterior é subtraído do subtotal tanto em `allocation: each` quanto em `across` antes do próximo cálculo — mas como as unidades do conjunto e as unidades alcançadas pelo cupom de itens são disjuntas sob a regra de exclusão, isso não produz compounding entre `CONJUNTO-<regra_id>` e um cupom de itens no mesmo carrinho.

### 6.5 Rotas Store (backend)
| Rota | Devolve |
|---|---|
| `GET /store/conjuntos?region_id=` | curados ativos (ordem) + gerados por coleção (par permitido × produtos publicados com variante disponível), com `preco_cheio` e `preco_com_beneficio` "a partir de" (menor variante de cada peça) |
| `GET /store/conjuntos/:handle?region_id=` | um conjunto (curado ou gerado), com produtos completos (variantes, preços, imagens) e a regra efetiva descrita em texto |
| `GET /store/conjuntos/por-produto/:product_id?region_id=` | parceiras da mesma coleção por par permitido + curados que incluem o produto |
| `GET /store/conjuntos/oportunidades?cart_id=` | `oportunidades` do carrinho, cada uma com até 3 produtos candidatos disponíveis |

Handle do gerado: `<handle_A>--<handle_B>` (categoria A = primeira do par, ordem alfabética dos handles de produto em caso de par simétrico). Cache: 5 min (`s-maxage=300`), exceto oportunidades (por carrinho, sem cache).

### 6.6 Rotas Admin (backend, autenticação padrão do Medusa)
`GET/POST /admin/conjuntos/regras`, `PUT/DELETE /admin/conjuntos/regras/:id` (DELETE só para `curado`, via curado) · `GET/PUT /admin/conjuntos/pares` (lista inteira) · `GET/POST /admin/conjuntos/curados`, `PUT/DELETE /admin/conjuntos/curados/:id` · `GET /admin/conjuntos/por-produto/:product_id` (painel da ficha) · `POST /admin/conjuntos/reconciliar` (recria promoções).

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
| **F1 Backend** | módulo, migração, seed, `montarConjuntos`, gancho, promoções, exclusividade do cupom, rotas store/admin, testes; deploy Railway; **primeira escrita em produção** (migração, regra padrão inativa, pares) só com "pode aplicar" | F0 |
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

- **Cupons de pedido inteiro (`target_type: order`) não podem excluir unidades em conjunto nativamente**: a Admin API do Medusa 2.15.5 rejeita `target_rules` nesse `target_type` (§6.4). A F1 converte esses cupons em `target_type: items` + `allocation: across` + a regra de exclusão ao criar/atualizar; o Cockpit não oferece a opção de cupom de pedido inteiro.
- **`total_valor` com arredondamento**: `round(valor/n)` por unidade pode diferir 1 centavo do valor cadastrado.
- **Promoções editadas à mão** no admin do Medusa quebram a regra até a próxima reconciliação (salvamento no Cockpit ou `POST /admin/conjuntos/reconciliar`).
- **"A partir de"** nos cards pode diferir do total final se variantes tiverem preços diferentes.
- **Volume de gerados** cresce com o catálogo; a vitrine limita a 12 por coleção com expansão.
- **Cupons criados antes do deploy** precisam do script de reconciliação para ganhar a exclusão.
- O gancho roda a cada mudança de carrinho; custo em memória sobre poucas linhas, desprezível.
