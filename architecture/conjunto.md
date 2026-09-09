# architecture/conjunto.md — SOP do Benefício Conjunto (backend, F1)

> Spec: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (Spec 2) · Plano F1: `docs/superpowers/plans/2026-09-08-conjunto-f1-backend.md` · Plano F0: `docs/superpowers/plans/2026-09-08-conjunto-f0-prova-de-conceito.md`.
> Status: **F1 (backend) e F2 (Cockpit) em produção; F3 (vitrine) entregue em código + aceite local, aguardando redeploy do backend (ruling V2) e deploy da vitrine** — ver §13. Regra padrão continua **inativa** em produção até o dono ativar. Branch original desta SOP: `feat/conjunto-f1-backend`.

## 1. O que é

O Benefício Conjunto é uma **condição permanente de preço** da loja (não é cupom, não tem validade nem limite de uso): quando a cliente monta um conjunto — top + bottom da mesma coleção (par de categorias permitido) ou uma lista fixa de peças escolhida pelo admin (curado) — ela recebe um desconto automático numa das peças ou no total, conforme a regra vigente. O admin escolhe o tipo de desconto e pode ter uma regra padrão da marca, exceções por coleção, e uma regra própria por curado.

Arquitetura (decisão 12 da spec): módulo Medusa próprio (`beneficio-conjunto`) + gancho `updateCartPromotionsWorkflow.hooks.setPromotionContext` que marca as unidades do carrinho + **promoções nativas automáticas** do Medusa (uma por regra ativa) que de fato aplicam o desconto. O módulo não calcula preço final: ele só decide *quais unidades* recebem desconto; quem desconta é o motor de promoções do Medusa, seguindo o contrato descoberto na F0 (§3).

## 2. Modelo de dados (`apps/backend/src/modules/beneficio-conjunto`)

Três modelos DML, dinheiro sempre em **centavos inteiros** dentro do módulo (só convertido para unidades decimais na fronteira com a Promotion API).

### `conjunto_regra` (`models/conjunto-regra.ts`)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `creg_…` | |
| `nome` | text | |
| `escopo` | enum `padrao`\|`colecao`\|`curado` | ver constraints abaixo |
| `collection_id` | text nullable | só em `colecao` |
| `tipo_desconto` | enum `menor_peca_percentual`\|`menor_peca_valor`\|`total_percentual`\|`total_valor` | |
| `valor` | int | percentual inteiro 1–100 (tipos `*_percentual`) ou centavos ≥ 1 (`*_valor`) |
| `ativa` | bool | |
| `promotion_id` | text nullable | promoção automática mantida pelo módulo |

Constraints no banco (não só na aplicação):
- Índice único parcial `escopo = 'padrao'` → só pode existir **uma** linha `padrao` viva.
- Índice único parcial `escopo = 'colecao'` sobre `collection_id` → uma exceção por coleção.
- `regra_id` de um curado aponta para uma `conjunto_regra` de `escopo: "curado"` — 1:1, gerida só via `/admin/conjuntos/curados` (a rota `GET /admin/conjuntos/regras` filtra `escopo !== "curado"` de propósito).

### `conjunto_par` (`models/conjunto-par.ts`) — global
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `cpar_…` | |
| `categoria_a`, `categoria_b` | text (handle da categoria raiz) | sempre `categoria_a < categoria_b` |
| `ativo` | bool | |

Índice único `(categoria_a, categoria_b)` **e** CHECK `categoria_a < categoria_b` no banco: as duas garantias juntas impedem tanto a linha duplicada quanto a linha espelhada `(b, a)` representando o mesmo par não-ordenado. Toda escrita passa por `normalizarPar` (`utils/pares.ts`) — usada tanto por `service.criarPar` quanto pela rota `PUT /admin/conjuntos/pares` — para nunca haver duas ideias divergentes de "o mesmo par".

Seed de produção (Task 8): `(leggings, tops)`, `(shorts, tops)`.

### `conjunto_curado` (`models/conjunto-curado.ts`)
| Campo | Tipo | Notas |
|---|---|---|
| `id` | `ccur_…` | |
| `nome`, `handle` | text | `handle` único, imutável após criar |
| `capa_url` | text nullable | |
| `product_ids` | `text[]` (`model.array()`) | ≥ 2, distintos |
| `regra_id` | text | fk lógica para `conjunto_regra` (`escopo: "curado"`) |
| `ativo` | bool | |
| `ordem` | int | ordem de exibição |

Achado registrado (não um risco, já resolvido): `model.array()` gera coluna `text[]` nativa no Postgres sem precisar do fallback `json` cogitado no plano — confirmado na migração gerada (`migrations/Migration20260909010610.ts`).

### Validação de curado (spec §4.4, ajuste F1 — ruling 2)
O **backend** só exige que cada `product_id` exista e tenha `status: "published"` — checado via `query.graph({ entity: "product", fields: ["id", "status"] })` nas rotas `POST`/`PUT /admin/conjuntos/curados`. "Sem variante disponível" **não** é bloqueio do backend — vira aviso da tela do Cockpit (F2), porque estoque/variante muda a qualquer momento e não deve acoplar o backend a esse estado. Se um produto do curado for despublicado depois, o curado some da vitrine (`listarConjuntos`/`conjuntoPorHandle` filtram por `status: published`) mas continua cadastrado.

## 3. Contrato do motor de promoções (herdado da F0)

A F0 (`docs/superpowers/plans/2026-09-08-conjunto-f0-prova-de-conceito.md`) provou, com HTTP real contra o Medusa 2.15.5, duas exigências do motor **não documentadas oficialmente**:

1. O `attribute` de uma `target_rules` de promoção **automática** precisa do prefixo `items.` (ex.: `items.conjunto_desconto`) — sem ele, o pré-filtro SQL descarta a promoção antes de avaliar a regra, e o desconto fica **0 silenciosamente**, sem erro.
2. `application_method.max_quantity` é **obrigatório** quando `allocation: "each"`, e precisa ser um valor **alto** (`1000`) — `max_quantity: 1` capa o desconto em 1 unidade, escondendo se a divisão de contexto do gancho está funcionando.
3. `allocation: "across"` **nunca** pode levar `max_quantity` — o motor rejeita a combinação com `400 invalid_data`.
4. Cupom de pedido inteiro (`target_type: "order"`) **não aceita `target_rules`** na criação — a Admin API rejeita com `400 invalid_data`. Por isso a conversão de cupom (§6 abaixo) sempre migra para `target_type: "items"` antes de anexar a regra de exclusão.

Essas quatro regras aparecem espalhadas pelo código (`utils/promocao.ts`, `sincronizar-promocao.ts`) com comentários apontando de volta para esta seção.

## 4. Fluxo do carrinho: gancho → marcas → promoções

```
updateCartPromotionsWorkflow
  └─ hooks.setPromotionContext (src/workflows/hooks/conjunto-marcar.ts)
       └─ avaliarCarrinho(container, cart)          [avaliar-carrinho.ts]
            ├─ svc.carregarAtivos()                 → regras (todas), pares ativos, curados ativos
            ├─ mapaRaizes(container)                 → cache 60s: id de categoria → handle da raiz
            ├─ linhasDoCarrinho(items, raizes)       → Linha[] (ignora preco_unitario <= 0)
            └─ montarConjuntos(linhas, regras, pares, curados)   [utils/montar-conjuntos.ts, puro]
       └─ marcarContexto(items, resultado)           → items com `conjunto_desconto` por entrada
```

`montarConjuntos` (puro, testado por unidade — `__tests__/montar-conjuntos.unit.spec.ts`, 16 casos):
1. Expande cada linha em unidades individuais.
2. **Curados primeiro**, na `ordem` cadastrada, consumindo a unidade mais barata de cada `product_id`.
3. **Pares de coleção**: para coleções com regra efetiva ativa (exceção da coleção, senão padrão), testa **todas as ordens de processamento** dos pares ativos (≤ 6 pares — acima disso, cai para a ordem cadastrada e loga um aviso, ruling P3 do controller) e escolhe a ordem que forma mais conjuntos → maior desconto total → chave lexicográfica menor, para desempate determinístico.
4. Desconto por conjunto conforme `tipo_desconto`, nunca maior que o preço da unidade.
5. **Oportunidades**: unidade livre de um lado de um par sem parceira do outro lado, deduplicado por coleção + categoria faltante.

**Marcação (ruling 4 do controller — ver §6.1 amendado na spec):** cada entrada de contexto ganha `conjunto_desconto` com um de três valores — `regra_id` (unidade que recebe desconto), `"conjunto"` (está num conjunto mas não é a unidade descontada, ex. a peça mais cara em "menor peça" — o cupom também não a alcança), `"nenhum"` (livre). **O contexto não carrega `conjunto_id`**: uma mesma linha (`item_id`) pode ter unidades em conjuntos diferentes ao mesmo tempo (ex. top ×2 pareado com legging num conjunto e com short em outro), então um `conjunto_id` único por entrada mentiria. Quem precisa saber qual conjunto formou cada unidade usa `GET /store/conjuntos/oportunidades?cart_id=`, que devolve `conjuntos: ConjuntoFormado[]` com os `item_id`s corretos.

Uma linha com quantidade N, das quais K estão marcadas, vira **uma entrada de contexto por marca presente** com o **mesmo `id`** (decisão provada na F0; texto corrigido — M4): não é um teto fixo de 3. Uma linha pode ter unidades em conjuntos de **regras diferentes** ao mesmo tempo (ex.: top ×2 pareado com uma legging num conjunto e com um short em outro — cada `regra_id` é uma marca própria), então o número de entradas é o número de marcas distintas que tocaram a linha (`regra_id` de cada conjunto, `"conjunto"`, `"nenhum"`), não um valor fixo. Todo campo monetário da entrada (`subtotal`, `total`, `discount_total`, `tax_total` etc., e o respectivo `raw_<campo>.value`) é reescalado por `n/q` (função `escalar` em `avaliar-carrinho.ts`) — não só `subtotal`.

**Risco documentado (I2):** quando uma linha é dividida em mais de uma entrada de contexto, todas continuam com o **mesmo `item.id`** — e o motor de promoções do Medusa calcula o desconto de uma promoção sobre o subtotal do item já **líquido** do desconto que outra promoção aplicou ao mesmo `item.id`, mesmo em entradas de contexto diferentes. Ou seja, a base de desconto é compartilhada entre o conjunto e um cupom que alcança o resto livre da mesma linha — o valor do cupom não é o "ingênuo" (percentual sobre o subtotal cheio da fração livre), e sim sobre esse subtotal menos o que o conjunto já descontou do mesmo item. Ver regressão observada em `apps/backend/integration-tests/http/conjunto-carrinho.spec.ts` ("caso 10"): top ×3 (R$ 189) + legging ×1 (R$ 259), regra padrão `total_percentual` 20% + `CUPOM10` (itens, 10%, regra de exclusão) → conjunto R$ 89,60 (20% de 189+259), cupom R$ 34,02 (não os R$ 37,80 ingênuos — 10% de 340,20, que é 378,00 menos os R$ 37,80 já descontados do mesmo item pelo conjunto). Os fluxos dedicados da F3 (página do conjunto, "Complete o conjunto") evitam o problema nesses casos adicionando peças elegíveis sempre em **linhas separadas** (`metadata.conjunto_slot` distinto, spec §6.3), para que essas linhas tenham no máximo uma marca; uma peça adicionada pelo botão comum "Adicionar à sacola" da PDP (sem esse metadata) funde numa única linha e continua exposta ao I2 — ver §12.

**O gancho nunca lança** (`conjunto-marcar.ts`): qualquer erro cai em `console.error("[conjunto] gancho", e)` e devolve `new StepResponse({})` — o carrinho segue sem o benefício em vez de quebrar.

## 5. Promoções automáticas (uma por regra)

`sincronizarPromocao(container, regraId)` (`sincronizar-promocao.ts`) garante que a regra tem exatamente uma promoção coerente: cria se não existe (ou foi apagada à mão — procura por `promotion_id` da regra e, se não achar, pelo código `CONJUNTO-<regra_id>`), atualiza tipo/valor/status via `updatePromotionsWorkflow` se existe. A regra-alvo (`items.conjunto_desconto eq <regra_id>`) **nunca muda**.

Payload (`utils/promocao.ts`, `payloadPromocao`):
```json
{
  "code": "CONJUNTO-<regra_id>",
  "type": "standard",
  "is_automatic": true,
  "status": "active | inactive",
  "application_method": {
    "type": "percentage | fixed",
    "target_type": "items",
    "allocation": "each",
    "max_quantity": 1000,
    "value": 10,
    "currency_code": "brl",
    "target_rules": [{ "attribute": "items.conjunto_desconto", "operator": "eq", "values": ["<regra_id>"] }]
  }
}
```
Para `total_valor`, `value = round(regra.valor / n) / 100` — `n` = 2 num par de coleção, tamanho da lista num curado (`nUnidadesDaRegra`). Regra inativa → `status: "inactive"`, a promoção nunca é apagada por essa via (só o `DELETE` de curado apaga a promoção — §6).

`sincronizarTodas(container)` roda `sincronizarPromocao` em todas as regras — chamada por `reconciliar` (§7) e por toda rota que cria/edita regra/curado.

## 6. Cupons (exclusividade)

**Ajuste F1 (ruling 3):** não há assinante de evento `promotion.created`/`promotion.updated` — o módulo Promotion do Medusa 2.15.5 não emite esses eventos de domínio em 2.15.5. A conversão roda nos **ganchos de workflow** (`src/workflows/hooks/conjunto-cupom.ts`): `createPromotionsWorkflow.hooks.promotionsCreated` e `updatePromotionsWorkflow.hooks.promotionsUpdated`, que cobrem toda escrita de promoção feita pela Admin API (Cockpit, admin nativo do Medusa). Erros só logam (`console.error("[conjunto] conversão de cupom", ...)`) — a promoção existe de qualquer forma, mesmo "errada", porque um Admin API quebrado é pior.

`converterCupom(container, promotionId)` (`sincronizar-promocao.ts`), idempotente:
1. Ignora promoções sem código, `CONJUNTO-*` (automáticas do próprio módulo).
2. Se `type !== "buyget"` e `target_type === "order"`, converte para `target_type: "items"`, `allocation: "across"`, `max_quantity: null` (o motor rejeita `across` + `max_quantity`).
3. Garante a regra-alvo `{ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] }` se ainda não existe.
4. Usa o serviço do módulo Promotion **diretamente** (`updatePromotions`/`addPromotionTargetRules`), não o workflow — para não reentrar no próprio gancho `promotionsUpdated`.

`converterTodosCupons(container)` pagina `listPromotions` (100 por página) convertendo tudo que ainda não passou pelo gancho (cupons criados antes deste código existir, ou por script/seed) — usada por `reconciliar`.

## 7. Rotas admin (`/admin/conjuntos/*`, autenticação padrão)

Validação zod em `src/api/middlewares.ts` (`validateAndTransformBody`, modo estrito — chave fora do schema já dá `400`). Códigos de erro: `400 INVALID_DATA` (validação), `404 NOT_FOUND`, **`422` com `type: "duplicate_error"`** para conflito de unicidade (regra padrão já existe, coleção com exceção duplicada, handle de curado duplicado) — o brief original pedia `409`, mas o mapeamento do framework (`error-handler.js`) só dá `409` para `MedusaError.Types.CONFLICT`, que sobrescreve a mensagem por um texto genérico; `DUPLICATE_ERROR` preserva a mensagem em pt-BR.

| Rota | Descrição |
|---|---|
| `GET /admin/conjuntos/regras` | todas as regras (inclusive inativas), exceto `escopo: "curado"` |
| `POST /admin/conjuntos/regras` | cria `padrao` (só se não existir) ou `colecao` (só se a coleção não tiver exceção) |
| `PUT /admin/conjuntos/regras/:id` | body parcial (`nome`/`tipo_desconto`/`valor`/`ativa`) — **sem DELETE**: `padrao`/`colecao` só desativam (`ativa: false`), nunca são excluídas |
| `GET /admin/conjuntos/pares` | lista todos |
| `PUT /admin/conjuntos/pares` | **substitui a lista inteira** — body `{ pares: [{ categoria_a, categoria_b, ativo? }] }`; cria os que faltam, atualiza `ativo`, apaga (soft delete) os que não vieram |
| `GET /admin/conjuntos/curados` | lista com a `regra` embutida |
| `POST /admin/conjuntos/curados` | valida produtos (existência + `published`), gera `handle` (slugify) se não informado, cria a regra `curado` + o curado |
| `PUT /admin/conjuntos/curados/:id` | body parcial; `handle` é imutável (fora do schema); sincroniza a regra quando `nome`/`tipo_desconto`/`valor`/`ativo` muda |
| `DELETE /admin/conjuntos/curados/:id` | apaga **promoção → regra → curado**, nessa ordem; só engole erro "não encontrada" da promoção (idempotência), qualquer outro erro sobe e nada é apagado |
| `GET /admin/conjuntos/por-produto/:product_id` | parceiras (mesma coleção, par ativo) + curados que incluem o produto, para o painel da ficha |
| `POST /admin/conjuntos/reconciliar` | `sincronizarTodas` + `converterTodosCupons`; devolve `{ regras: number, cupons: number }` |

Exemplos:
```
POST /admin/conjuntos/regras
{ "nome": "Padrão da marca", "escopo": "padrao", "tipo_desconto": "total_percentual", "valor": 10, "ativa": false }

PUT /admin/conjuntos/pares
{ "pares": [
  { "categoria_a": "leggings", "categoria_b": "tops", "ativo": true },
  { "categoria_a": "shorts",   "categoria_b": "tops", "ativo": true }
] }

POST /admin/conjuntos/curados
{ "nome": "Kit Verão", "product_ids": ["prod_1", "prod_2"], "tipo_desconto": "menor_peca_percentual", "valor": 15 }
```

## 8. Rotas store (`/store/conjuntos/*`, chave publicável)

**Ajuste F1 (ruling 1):** as rotas devolvem **estrutura + `product_ids`**, não produtos com preço/foto — a vitrine (F3) hidrata com `listProducts({ id })`, que já respeita o mesmo teto de 100 variantes e é a única fonte de preço/disponibilidade. Cache `public, s-maxage=300, stale-while-revalidate=600`, exceto `oportunidades` (`no-store`, estado por carrinho).

| Rota | Devolve |
|---|---|
| `GET /store/conjuntos` | `{ curados: [{ id, nome, handle, capa_url, product_ids, regra: { tipo_desconto, valor } }], colecoes: [{ collection_id, regra, pares: [{ handle, categoria_a, categoria_b, product_ids }] }] }` |
| `GET /store/conjuntos/:handle` | `{ conjunto: { tipo, nome, capa_url, handle, product_ids, regra } }` — `capa_url` é sempre `null` para um par de coleção (só curados têm capa) |
| `GET /store/conjuntos/por-produto/:product_id` | `{ parceiras: [{ product_id, categoria_raiz }], curados: [...] }` (só curados com regra ativa) |
| `GET /store/conjuntos/oportunidades?cart_id=` | `{ conjuntos: ConjuntoFormado[], oportunidades: [{ collection_id, categoria_faltante, a_partir_do_item_id, candidatos: product_id[] }] }` (até 3 candidatos por oportunidade) |

Handle do par de coleção: `<handle_A>--<handle_B>`, sempre na ordem canônica (`categoria_a < categoria_b`, como gravado em `conjunto_par`). `conjuntoPorHandle` só resolve a ordem exata — `handleB--handleA` devolve `404` mesmo que o par exista (achado da Task 6/7, registrado para não reordenar as raízes "por bondade" e arriscar duas URLs canônicas para o mesmo conjunto).

Em `oportunidades`, os candidatos **não excluem** produtos já no carrinho — outra unidade do mesmo top pode fechar um segundo conjunto.

## 9. Como rodar os testes (Windows + Docker)

Suítes: `apps/backend/src/modules/beneficio-conjunto/__tests__/*.unit.spec.ts` (30 testes puros) e `apps/backend/integration-tests/http/conjunto-{modulo,promocao,carrinho,cupom,admin,catalogo,store}.spec.ts` (71 testes de integração HTTP, mais 2 em `saude.spec.ts` do harness — 73 no total). **Nunca aponta para produção nem para o Postgres nativo de desenvolvimento** — sempre o contêiner Docker `eclat-pg-test`.

```bash
# 1) subir o Postgres de teste (uma vez por sessão de trabalho)
cd apps/backend
npm run test:db:up        # docker run ... eclat-pg-test na porta 55432

# 2) rodar as suítes (Windows: prefixar a shell do npm_config_script_shell)
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:unit
npm_config_script_shell="C:\Program Files\Git\usr\bin\bash.exe" npm run test:integration:http

# 3) derrubar o contêiner ao terminar
npm run test:db:down       # docker rm -f eclat-pg-test
```

Credenciais/URL de teste vêm de `apps/backend/.env.test` (banco `postgres` dentro do contêiner, `DISABLE_ADMIN=true`, CORS/JWT/cookie fixos para teste). `npx tsc -p apps/backend --noEmit 2>&1 | grep -v cockpit/page.tsx` deve ficar vazio (os 21 erros pré-existentes em `src/admin/routes/cockpit/page.tsx` não são desta fase).

## 10. Como gerar migração / rodar `medusa develop` localmente

`medusa db:generate` e `medusa develop` precisam de um banco real (não o de teste efêmero do Jest). Usa-se o **mesmo contêiner** `eclat-pg-test`, com um banco `eclat_dev` dedicado:

```bash
# uma vez: criar o banco eclat_dev dentro do contêiner de teste já em pé
docker exec eclat-pg-test psql -U postgres -c "CREATE DATABASE eclat_dev"

# aplicar migrações existentes antes de gerar uma nova
DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa db:migrate

# gerar uma migração nova a partir de mudança nos modelos DML de um módulo
DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa db:generate beneficioConjunto

# rodar o backend local contra esse banco (dry run manual do gancho/rotas, opcional)
DATABASE_URL=postgres://postgres:postgres@localhost:55432/eclat_dev npx medusa develop
```

`DATABASE_URL` inline **vence** o `.env` (dotenv não sobrescreve variável já setada no processo) — não precisa editar `apps/backend/.env`. Nunca editar `apps/backend/.env` para isso.

O nome do módulo no `db:generate` é `beneficioConjunto` (a constante `BENEFICIO_CONJUNTO_MODULE`), não o nome do diretório (`beneficio-conjunto`).

## 11. Script de produção (`scripts/setup-conjunto.py`)

Mesmo padrão de `scripts/setup-categorias.py` (credenciais de `apps/cockpit/.env.local`, `--apply` para gravar, sem `--apply` só imprime o plano, stdout em utf-8). Aceita `--base http://localhost:9000` para apontar para um `medusa develop` local em vez do Railway.

Ações idempotentes, nesta ordem:
1. `GET /admin/conjuntos/regras` — cria a regra `padrao` (10% sobre o total, **inativa**) só se ainda não existir.
2. `GET`/`PUT /admin/conjuntos/pares` — garante `(leggings, tops)` e `(shorts, tops)` ativos, preservando qualquer outro par já cadastrado (o `PUT` sempre envia a lista completa, existentes + novos).
3. `POST /admin/conjuntos/reconciliar` — **I3:** antes de chamar (em simulação, ou logo antes do `POST` com `--apply`), lista via `GET /admin/promotions` cada promoção não-`CONJUNTO-*` com `code`, `target_type`, `allocation`, se já tem a regra de exclusão, e o que mudaria (`order → items`; `+ regra de exclusão`; `shipping → ignorada`) — visibilidade do que a reconciliação vai tocar antes de gravar. Com `--apply`, chama o `POST` e imprime `{ regras, cupons }`.
4. `GET /admin/promotions?limit=100` — lista (melhor esforço) os cupons não-`CONJUNTO-*` já convertidos (`target_type: items` + regra de exclusão).

Validado com `python -m py_compile scripts/setup-conjunto.py` (sem erro). **Não executado contra produção nesta task** — a Task 8 só documenta e prepara o script; a execução com `--apply` é o passo 3 do checklist de deploy (§13), que depende do "pode aplicar" do dono.

### Desfazer a conversão de um cupom (I3)

Não existe rota de "reverter" — a conversão (§6) é deliberadamente de mão única (a rota `POST /admin/conjuntos/reconciliar` só converte para a frente). Para desfazer manualmente uma promoção que a conversão alterou:
1. Achar a promoção (`GET /admin/promotions/:id` com `fields=application_method.target_rules.*`).
2. Apagar a `target_rule` `{ attribute: "items.conjunto_desconto", operator: "eq", values: ["nenhum"] }` (via `DELETE /admin/promotions/:id/target-rules/batch` ou equivalente da versão do Medusa em uso — checar a doc da Admin API da versão).
3. Se a promoção tinha virado `items`/`across` (era `order` antes), devolver com `POST /admin/promotions/:id { "application_method": { "target_type": "order", "allocation": null, "max_quantity": null } }` (voltar `allocation`/`max_quantity` para o que a promoção de pedido inteiro aceita).

**Recomendação:** antes do primeiro `--apply` em produção, tirar um dump das três tabelas do módulo Promotion que a conversão toca — `promotion`, `promotion_application_method`, `promotion_rule` (e `promotion_rule_value`) — para ter um "antes" restaurável sem depender de reconstruir o estado manualmente promoção por promoção.

## 12. Riscos e limites conhecidos

Herdados da spec (§12):
- **Cupons de pedido inteiro** não podem levar `target_rules` nativamente — a F1 converte para `items`/`across` + regra de exclusão ao criar/editar (via gancho) e reconcilia os pré-existentes (via `reconciliar`); o Cockpit (F2) só deve oferecer cupom de itens.
- **`total_valor` com arredondamento**: `round(valor/n)` por unidade pode diferir 1 centavo do valor cadastrado.
- **Promoções editadas à mão** no admin nativo do Medusa quebram a regra até a próxima reconciliação (salvamento no Cockpit ou `POST /admin/conjuntos/reconciliar`).
- **Volume de gerados** cresce com o catálogo — a vitrine (F3) precisa limitar/paginar.
- **Cupons criados antes do deploy** precisam do script/rota de reconciliação para ganhar a exclusão.
- O gancho roda a cada mudança de carrinho; custo em memória sobre poucas linhas, desprezível.
- **I2 — linha dividida compartilha a base de desconto entre conjunto e cupom** (mesmo `item.id`, ver §4 acima): quando o gancho divide uma linha em mais de uma entrada de contexto (parte em conjunto, parte livre), o cupom que alcança a parte livre é calculado sobre o subtotal já líquido do desconto que o conjunto aplicou à mesma linha — não sobre o valor "ingênuo" da fração livre isolada. Regressão pinada em `conjunto-carrinho.spec.ts` ("caso 10"). F3/F4 adicionam peças elegíveis em linhas separadas (`metadata.conjunto_slot`) para que toda linha tenha no máximo uma marca e o problema não apareça na prática — spec §6.3 "Decisão F1". **Confirmado F3 (2026-09-09):** testado com o Medusa local 2.15.5 que `metadata.conjunto_slot` de fato não funde linhas — repetir a adição do mesmo conjunto pela página do conjunto gerou 2 → 4 linhas, nunca 2 linhas com quantidade 2, cada uma com `conjunto_slot` distinto. Fecha o problema **só para os pontos de entrada da F3** (página do conjunto, "Complete o conjunto" da PDP); uma peça adicionada pelo botão comum "Adicionar à sacola" continua sem esse metadata e permanece sujeita ao I2 se acabar parcialmente marcada por um conjunto depois. Ver `architecture/catalog.md`, seção "Conjuntos na vitrine (Fase F3, 2026-09)".
- **Capa de curado (`capa_url`) com host fora do allowlist do `next/image`** derruba a página Conjuntos da vitrine (`images.remotePatterns` em `apps/storefront/next.config.js`): só o uploader do Cockpit (Supabase Storage) é suportado; URL colada à mão de outro host quebra a página inteira. Guarda de host (validar no cadastro ou cair para as fotos das peças) fica para a F4.
- **Pareamento guloso com permutações é máximo só para grafos de pares em formato de estrela** (o cadastro de hoje: `leggings—tops` e `shorts—tops`, ambos com `tops` como nó comum). Testar todas as ordens de processamento (`MAX_PARES_PERMUTAVEIS`, §4 acima) garante o máximo de conjuntos quando os pares ativos formam uma estrela, mas **não há essa garantia se os pares formarem um ciclo** — ex.: cadastrar também `leggings+shorts` fecha um triângulo `tops—leggings—shorts—tops`, e o pareamento guloso por ordem pode ficar aquém do máximo teórico (problema clássico de emparelhamento máximo em grafo geral, que greedy-por-permutação não resolve com garantia — precisaria de um algoritmo tipo Blossom). Limite documentado, não corrigido nesta fase; `PUT /admin/conjuntos/pares` pode ganhar um aviso quando os pares ativos deixarem de formar uma estrela.

Achados da execução F1 (Task 8, registrados aqui por não terem virado risco real):
- `model.array()` do DML gerou `text[]` nativo sem precisar do fallback `json` cogitado no plano.
- `updatePromotionsWorkflow` aceitou `application_method.type`/`allocation`/`max_quantity`/`target_type` sem problema — não foi preciso o fallback de recriar a promoção em vez de atualizar.
- Atualizar `target_type` de um cupom existente (`order` → `items`) funcionou via `promo.updatePromotions` direto no serviço do módulo Promotion, sem passar pelo workflow (evita reentrância no próprio gancho).
- **Mapeamento 409→422:** o brief pedia `409 Conflict` para duplicidade; o framework do Medusa só mapeia `409` para `MedusaError.Types.CONFLICT` (que sobrescreve a mensagem por um texto genérico de retry). As rotas usam `DUPLICATE_ERROR` (`422`) para manter a mensagem em pt-BR — documentado nas rotas e aqui.
- **`conjuntoPorHandle` só aceita a ordem canônica** do handle (`handleA--handleB` com A = `categoria_a`) — decisão deliberada para não ter duas URLs válidas para o mesmo conjunto; a vitrine (F3) precisa sempre montar o link a partir de `listarConjuntos`, nunca invertendo os handles à mão.
- **Testes:** 30 unitários (`__tests__/*.unit.spec.ts`) + integração HTTP (`integration-tests/http/conjunto-*.spec.ts` + `saude.spec.ts` do harness), todos verdes contra o Postgres de teste em Docker. Total da suíte HTTP hoje: **73** (68 após a onda final da F1 — C1/I1/I2/buyget —, +2 do `capa_url` nullable da F2, +2 do ruling V2 e +1 do ruling V6 da F3).

## 13. O que F2/F3/F4 consomem

- **F2 (Cockpit — telas §8 da spec): ENTREGUE** (2026-09-09, branch `feat/conjunto-f2-cockpit`; código
  concluído, **validação visual pendente do dono** — roteiro em `progress.md`, entrada "Benefício Conjunto
  F2"). Consome só as rotas `/admin/conjuntos/*` (§7 acima), via proxies finos em
  `apps/cockpit/app/api/conjuntos/**`. Tela Regras (padrão + exceções — só o toggle "Ativa", sem "Usar
  padrão" porque não há `DELETE` de regra, ver pendência abaixo), tela Curados (CRUD, drag para `ordem`,
  upload de `capa_url` via `/api/site-upload` do Cockpit, que chama `/admin/uploads`), painel só-leitura da
  ficha do produto (`GET /admin/conjuntos/por-produto/:product_id`). "Sem variante disponível" vira aviso
  da tela (§2 acima), não bloqueio do backend. Detalhe de telas/rotas/módulo puro:
  `architecture/cockpit.md` §7.
  - **`capa_url` nullable (Task 5 desta fase):** `apps/backend/src/api/middlewares.ts` — os schemas zod de
    criar/editar curado aceitam `capa_url: z.string().min(1).nullable().optional()` (antes só
    `.optional()`, sem `.nullable()`), para o Cockpit poder enviar `capa_url: null` e limpar a capa sem
    precisar de uma rota separada. +2 testes de integração (`conjunto-admin.spec.ts`), suíte HTTP do backend
    em 70 no total — 68 nos `conjunto-*.spec.ts` + 2 em `saude.spec.ts`. **Isto exige redeploy do backend em produção** (`railway up` — o Railway não
    está ligado ao GitHub deste serviço, ver entrada "DEPLOY em produção" de 2026-09-09 em `progress.md`)
    antes do roteiro de validação do dono: sem o redeploy, `capa_url: null` continua devolvendo `400` em
    produção mesmo com o Cockpit já pronto para enviá-lo.
- **F3 (Vitrine — §7.1–7.4, 7.6, 7.7): ENTREGUE** (2026-09-09, branch `feat/conjunto-f3-vitrine`; código
  concluído + aceite local completo — critérios de aceite §11 itens 5–8 validados no navegador contra o
  backend local semeado, ver `progress.md`, entrada "Benefício Conjunto F3"). Consome as rotas
  `/store/conjuntos*` (§8 acima) para estrutura, hidratando preço/foto/estoque com `listProducts({ id })`
  da Store API que a vitrine já usa. Handle do par sempre vem pronto de `GET /store/conjuntos` — nunca
  remontado à mão. Detalhe de páginas/componentes/fluxo de dados/selo: `architecture/catalog.md`, seção
  "Conjuntos na vitrine (Fase F3, 2026-09)".
  - **Mudança de backend nesta fase (ruling V2, `catalogo-conjuntos.ts`):** `listarConjuntos`/
    `conjuntoPorHandle` agora omitem um par gerado por coleção quando seu conjunto de ids bate
    exatamente com o de um curado ativo — evita a vitrine oferecer duas URLs (par + curado) para o
    mesmo carrinho resultante, já que o gancho aplicaria a regra do curado, não a da coleção. **Exige
    redeploy do backend (`railway up`) antes do deploy da vitrine** — sem ele, produção continua
    mostrando o par duplicado com o curado. +2 testes de integração (`conjunto-catalogo.spec.ts`), suíte
    HTTP do backend em **72** no total.
  - **Ruling V6 (fix wave final da F3, mesmo arquivo):** `parceirasDoProduto` — a rota
    `GET /store/conjuntos/por-produto/:id` — aplica a MESMA regra do V2: a parceira cujo conjunto
    `{âncora, parceira}` bate com o `product_ids` de um curado ativo **sai** de `parceiras` (o carrinho
    aplicaria a regra do curado, então "Complete o conjunto" prometia um benefício que nunca é cobrado);
    ela continua saindo em `curados`, que a PDP mostra como "Looks com essa peça". V2 e V6 usam o mesmo
    helper de comparação de id-set (`chaveIdSet`/`conjuntosDeCuradosAtivos`). **Entra no mesmo `railway up`
    do V2.** +1 teste de integração (`conjunto-store.spec.ts`), suíte HTTP do backend em **73** no total.
  - **Ruling V7 (fix wave final da F3, só vitrine):** o "retry resumível" da adição ao carrinho virou UM
    mecanismo — o módulo puro `apps/storefront/src/lib/util/adicao-conjunto.ts` (`pendentes`,
    `adicionarEmSequencia`, `mensagemFalha`), usado tanto pela página do conjunto quanto pelo bloco
    "Complete o conjunto" (antes: duas implementações diferentes, nenhuma testada). Progresso **por peça**
    (`{ [indice]: variantId }`): retry com a mesma variante pula quem já entrou; trocar a variante de uma
    peça re-adiciona só ela. 11 testes Vitest; storefront em **172** no total. Detalhe em
    `architecture/catalog.md`, "Adição ao carrinho".
  - **Seed local para validar a F3** (não roda contra produção nem contra o Postgres de desenvolvimento
    padrão — só o `eclat_dev` no contêiner `eclat-pg-test`): `apps/backend/src/scripts/seed-dev-conjunto.ts`
    (`npx medusa exec`, guarda de segurança na primeira linha executável: recusa se `DATABASE_URL` não
    for `localhost`/`127.0.0.1`; idempotente). Cria a coleção "Família Blackout" (4 produtos: Top R$189,
    Short R$159, Legging R$259, Macaquinho R$299), os pares `leggings+tops`/`shorts+tops`, o curado "Look
    Blackout" (top+legging, `total_valor` R$45) e a regra padrão `menor_peca_percentual` 20% **ativa**
    (diferente da regra inativa de produção — o seed liga o benefício de propósito para poder validar o
    fluxo completo localmente). Comando e roteiro de validação em `architecture/catalog.md`.
- **F4 (Carrinho — §7.5, aceite final §11 da spec):** o gancho já marca `conjunto_desconto` nos itens do carrinho (nenhuma leitura extra necessária para o cálculo); a etiqueta "Conjunto"/agrupamento do resumo por prefixo `CONJUNTO-` dos ajustes de promoção; os gatilhos "Feche mais um conjunto" vêm de `GET /store/conjuntos/oportunidades?cart_id=`.

## 14. Checklist de deploy (dono/controller — não executar nesta task)

1. Após o **merge** desta branch em `main` (feito localmente), o **dono** faz `git push` de `main` (política do projeto: agente entrega os comandos, não faz push — ver memória `eclat-git-push.md`).
2. Railway builda e roda `medusa db:migrate` no `predeploy` — cria as 3 tabelas (`conjunto_regra`, `conjunto_par`, `conjunto_curado`).
3. Com o **"pode aplicar"** do dono: `python scripts/setup-conjunto.py --apply` — cria a regra padrão **inativa**, os 2 pares, reconcilia promoções/cupons existentes.
4. Validar `GET /store/conjuntos` em produção (deve vir `{ curados: [], colecoes: [] }` — vazio até existir regra **ativa**) e testar um carrinho em dev apontando para o backend de produção (`MEDUSA_BACKEND_URL`/`--base` conforme `architecture/cockpit.md`/`architecture/deploy.md`).
5. O dono **ativa a regra padrão** — no Cockpit (F2, quando existir) ou via `PUT /admin/conjuntos/regras/:id { "ativa": true }` — quando quiser ligar o benefício de fato.
