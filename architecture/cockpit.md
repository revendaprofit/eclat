# architecture/cockpit.md — Cockpit use.ÉCLAT: Plano Completo & Faseado

> Conteúdo canônico do Cockpit. Visão completa (para construir cada peça já no lugar certo)
> com execução **uma fase por vez** e **Halt** entre fases. CLAUDE.md é lei; este doc é o mapa do Cockpit.

## Estado / reconciliação (2026-06-14)
- A página read-only do Cockpit dentro do Admin do Medusa (entregue como "Parte 7" v0) fica **SUPERADA**
  por este plano (cockpit é app separado). Manter por ora; remover/migrar na Fase 0.
- O modelo de dados abaixo **evolui** o que foi criado na Parte 5 (lead/cliente_rel/conversa) e na Parte 6
  (webhook WhatsApp gravando em lead/conversa). Haverá migração: `conversa`→`conversation`+`message`,
  `cliente_rel`→`crm_customer`, `lead` ganha `estagio`+`lead_stage`. O webhook (Parte 6) será reescrito
  na Fase 1 para gravar em `conversation`/`message`.

## 1. Visão & arquitetura
O Cockpit é o painel de gestão total da Éclat — um **app separado** (Next.js, fora do admin do Medusa),
que o operador usa sozinho. Ele **opera o sistema via APIs donas**:
- **Medusa Admin API** — comércio (produtos, estoque, pedidos, envios, receita).
- **Supabase** — relacionamento, leads, financeiro próprio, chat (dono desses dados).
- **Evolution API** — WhatsApp.

**Invariante (no CLAUDE.md):** o Cockpit lê e escreve **somente** pelas APIs donas; não duplica dado de
comércio; Medusa segue a fonte da verdade do comércio. Dinheiro em centavos. RLS no Supabase.

## 2. Método de build
1. **Registrar este plano** como architecture/cockpit.md, referenciá-lo no CLAUDE.md e colocar as fases no task_plan.md.
2. **Construir uma fase por vez** ("leia architecture/cockpit.md; construa SOMENTE a Fase X; pare e aguarde aprovação").
3. **Halt entre fases.** Testa pelo critério de aceite, aprova, e só então a próxima.

## 3. Menu completo (aba lateral)
```
Dashboard            (visão geral + filas de ação)
Conversas            (Chat WhatsApp / Evolution)
Clientes             (lista · ficha 360° · pedidos · envios · follow-up · segmentos)
Leads                (Kanban · lista · ficha · captação)
Produtos & Estoque   (produtos · criar/editar · coleções/categorias/tags · estoque · alertas)
Conjuntos (benefício) (regras padrão/exceções/pares · conjuntos curados · painel na ficha do produto)
Financeiro           (DRE · receita · despesas · COGS/margem · categorias)
Configurações        (conexões · WhatsApp · automações · categorias de despesa · usuários)
```

## 4. Modelo de dados (Supabase = dono). Comércio NÃO entra aqui. RLS; dinheiro em centavos.
```
-- CHAT
conversation(id, contato_e164, nome_contato, alvo_tipo[lead|cliente|nenhum],
  lead_id?, medusa_customer_id?, instancia_evolution, status, nao_lidas,
  ia_autoreply(bool, default false), ultima_msg_em, criado_em)
message(id, conversation_id, direcao[in|out], tipo[texto|audio|imagem|video|doc],
  texto?, media_url?, media_mime?, status, origem[humano|ia], timestamp,
  evolution_msg_id UNIQUE, criado_em)

-- LEADS
lead(id, nome, whatsapp, email?, origem, estagio, valor_estimado_centavos?,
  responsavel?, notas?, medusa_customer_id?, criado_em, ultima_interacao)
lead_stage(id, nome, ordem)            -- estágios do Kanban

-- CRM (extensão do cliente; NÃO duplica o cliente do Medusa)
crm_customer(medusa_customer_id, status_ciclo, tags[], notas?,
  consumivel_proxima_recompra?, ultimo_followup?)
followup_task(id, alvo[lead_id|medusa_customer_id], tipo, canal, due_date, status)

-- FINANCEIRO (próprio)
finance_expense(id, data, categoria_id, descricao, valor_centavos, fornecedor?,
  recorrencia?, anexo_url?)
finance_expense_category(id, nome)
product_cost(medusa_variant_id, custo_centavos, vigencia_inicio)   -- COGS
```

## 5. Fases de build (ordem). Cada fase termina testável e aprovável.

### Fase 0 — Shell do cockpit
App Next.js separado: autenticação, **aba lateral com TODAS as áreas** (placeholders), layout/identidade Éclat,
e **conexões testáveis** com Medusa (Admin API), Supabase e Evolution.
*Aceite:* logar no cockpit; ver o menu completo; as 3 conexões respondem.

### Fase 1 — Conversas (Chat WhatsApp)
**Fase A** (chat funcional: texto, áudio/voz, mídia, tempo real, vínculo lead/cliente, idempotência) →
**Fase B** (IA).
- **IA do chat (decisão travada):** modo **SUGESTÃO** — a IA redige a resposta com a voz da Éclat e o operador
  aprova/edita/envia. Auto-resposta direta só em casos definidos (palavra-chave/estágio), em etapa posterior,
  sempre com handoff humano. Mensagens de IA marcadas com `origem = ia`.
*Aceite (Fase A):* receber/enviar em tempo real (incl. áudio); webhook não duplica; conversa vinculada.

### Fase 2 — Leads (Kanban)
Funil arrastável por estágio, ficha do lead, captação, e **conversão → cria cliente no Medusa**. Usa o chat da Fase 1.
*Aceite:* mover lead entre estágios; abrir conversa; converter em cliente.

### Fase 3 — Produtos & Estoque
CRUD de produtos/variações/preço(centavos)/metadata, coleções/categorias/tags e estoque — tudo via **Medusa Admin API**.
Alertas de baixo estoque e "avise-me".
*Aceite:* criar/editar produto e ajustar estoque pelo cockpit, refletindo no Medusa.

### Fase 4 — Clientes / Pedidos / Envios
Ficha 360°, pedidos, fila de envio (etiqueta, rastreio, aviso por WhatsApp), follow-up, segmentos.
*(Depende do checkout — Partes 3+ da loja.)*
*Aceite:* abrir ficha do cliente com pedidos e conversa; despachar um pedido.

### Fase 5 — Financeiro (P&L)
Receita do Medusa + despesas e COGS lançados no Supabase → DRE (receita − custos − despesas = lucro).
*Aceite:* lançar despesa, definir COGS, e ver o DRE do período fechar certo.

### Fase 6 — Dashboard inteligente
Consolida tudo: vendas do dia, pedidos a enviar, leads novos, conversas pendentes, estoque baixo, recompras previstas.
*Aceite:* o painel abre mostrando as filas de ação corretas.

## 6. Decisões travadas
- **Arquitetura:** cockpit é app separado; opera via APIs donas; Medusa = fonte da verdade do comércio.
- **IA do chat (Fase 1B):** modo sugestão (IA redige, operador aprova). Auto-resposta só em casos definidos, depois.
- **Evolution API:** caminho não-oficial, já configurado. (Mitigação futura: migrar para a API oficial.)
- **Financeiro:** P&L híbrido — receita do Medusa + despesas/COGS no Supabase.

## 7. Conjuntos (benefício) — Fase F2 (2026-09-09)

> Tela do Cockpit para o Benefício Conjunto (Spec 2). SOP do backend/módulo: `architecture/conjunto.md`
> (dono do modelo de dados, do gancho de carrinho e das rotas). Este bloco documenta só a parte do Cockpit
> (código concluído nesta fase; **validação visual pendente do dono** — ver roteiro em `progress.md`,
> entrada "2026-09-09 — Benefício Conjunto F2").

**Telas** — item de menu "Conjuntos (benefício)" (`components/sidebar.tsx`), rota `/conjuntos`
(`app/(painel)/conjuntos/page.tsx`, abas por query string `?aba=regras|curados`, sem index):
- **Regras** (`components/conjunto-regras.tsx`): benefício padrão (tipo/valor/ativo, prévia ao vivo com o
  exemplo fixo da spec — Top R$ 189,00 + Legging R$ 259,00); exceções por coleção (só o toggle "Ativa" —
  não existe "Usar padrão"/remover exceção, ver Limites abaixo); pares permitidos como chips (adicionar/
  remover categoria raiz); botão "Reconciliar" com confirmação inline antes de chamar
  `POST /api/conjuntos/reconciliar`. Trocar o tipo de desconto sempre limpa o campo de valor (regra e
  exceções), para nunca salvar um número na unidade errada (% virando centavos ou vice-versa).
- **Conjuntos curados** (`components/conjunto-curados.tsx`): lista ordenável (arrastar nativo do HTML5,
  mesmo padrão do Kanban de Leads — cada item solto dispara `PUT /api/conjuntos/curados/:id { ordem }`
  imediatamente, sem "salvar" separado); drawer de criar/editar com busca de produtos
  (`GET /api/products?q=`, debounce 300 ms, `AbortController` cancela a busca anterior), badge de estoque
  por produto via `alertaEstoque` (rascunho/sem estoque/estoque baixo — nunca bloqueia a escolha), upload
  de capa via `/api/site-upload` (componente compartilhado `components/upload-imagem.tsx`, também usado na
  Vitrine), prévia do card, e `capa_url: null` explícito para limpar a capa (ver Limites/rulings).
- **Painel na ficha do produto** (`components/conjunto-produto-panel.tsx`, montado em
  `components/product-form.tsx` só no modo edição, logo após "Fotos por cor"): só leitura — lista as
  parceiras (par de coleção) e os curados que incluem o produto (`GET /api/conjuntos/por-produto/:id`);
  quando não há nenhum, mostra o motivo em pt-BR via `motivoSemConjunto` (lib pura), calculado a partir da
  coleção/categorias **do próprio produto** (nunca da lista de produtos limitada a 100 — ver ruling C5).

**Rotas** `apps/cockpit/app/api/conjuntos/**` — proxies finos para `MEDUSA_ADMIN_URL` (mesmo padrão dos
outros domínios do Cockpit: login programático em `lib/medusa.ts`, token em cache 10 min). Status e
mensagem de erro do backend são preservados via `MedusaHttpError`/`respostaErro` (`lib/api-erro.ts`) — não
há tradução ou remapeamento de status no Cockpit; `400` de validação e `422 duplicate_error` (regra padrão
duplicada, exceção de coleção duplicada, handle de curado duplicado) chegam ao formulário com a mensagem
pt-BR do backend.
```
GET/POST   /api/conjuntos/regras
PUT        /api/conjuntos/regras/[id]
GET/PUT    /api/conjuntos/pares
GET/POST   /api/conjuntos/curados
PUT/DELETE /api/conjuntos/curados/[id]
GET        /api/conjuntos/por-produto/[id]
POST       /api/conjuntos/reconciliar
```

**Módulo puro** `apps/cockpit/lib/conjunto.ts` (sem fetch, sem React — espelha a matemática do backend,
`apps/backend/.../beneficio-conjunto/utils/montar-conjuntos.ts`, para a prévia bater com o que o carrinho
vai calcular): `TIPOS_DESCONTO` (os 4 rótulos em pt-BR); `entradaParaValor`/`valorParaEntrada` (texto do
formulário ↔ inteiro — percentual 1–100 ou centavos, nunca float); `formatarReais`; `validarRegra`/
`validarCurado`; `previaBeneficio` (mesmo algoritmo de desconto por tipo do backend, usado nas prévias das
telas Regras e Curados); `alertaEstoque`; `slugConjunto` (handle a partir do nome); `raizDeCategoria` (sobe
`parent_id` até a raiz, mesma regra de `raizPorCategoria` do backend); `motivoSemConjunto` (espelha
`regraEfetiva` do backend para explicar por que um produto não forma conjunto). 17 testes unitários em
`lib/conjunto.test.ts` (suíte do cockpit passa de 19 para **36**).

**Como validar** — dois níveis, nenhum React component test no projeto (decisão preexistente do Cockpit):
1. **Automatizado:** `npx tsc -p apps/cockpit --noEmit` (tipos) + `npm test --workspace=apps/cockpit`
   (36 testes puros — `conjunto.test.ts` cobre conversão de dinheiro, validação e a prévia; nenhum teste
   de componente/integração de UI, mesmo padrão das fases anteriores do Cockpit).
2. **Backend local** (para exercitar os helpers de `lib/medusa.ts` contra rotas reais antes do dono
   validar em produção): subir `medusa develop` local (`architecture/conjunto.md` §10) e apontar
   `MEDUSA_ADMIN_URL` do Cockpit para `http://localhost:9000` — ver a nota de memória do projeto
   (`eclat-validacao-cockpit-producao.md`) sobre o override dessa variável para validar sem depender do
   backend de produção.
3. **Roteiro de validação do dono** (obrigatório, é quem tem o login do Cockpit): os seis passos completos
   estão em `progress.md`, entrada "2026-09-09 — Benefício Conjunto F2 (Cockpit)".

**Limites conhecidos desta fase:**
- **`GET /api/products` tem teto de 100 produtos** (mesmo teto de outras telas do Cockpit) — o formulário
  de curado busca por nome/handle (`?q=`) para contornar, mas ao **editar** um curado cujo `product_ids`
  inclui um id fora dos 100 primeiros, esse produto some do mapa local; a tela preserva o id (não descarta
  do array salvo) e mostra um aviso, com o título caindo para o próprio id quando não resolvido.
- **Não existe "Usar padrão"** na tela Regras (a spec original previa remover a exceção de coleção) porque
  o backend não tem `DELETE /admin/conjuntos/regras/:id` — uma exceção só pode ser desativada
  (`ativa: false`), nunca apagada. Pendência de backend registrada em
  `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` §8.1 e em `architecture/conjunto.md`.
- **Sem tela de cupom** — a spec previa a possibilidade, mas a F2 só oferece o botão "Reconciliar"
  (`POST /admin/conjuntos/reconciliar`), que converte cupons de pedido inteiro existentes; criar/editar
  cupom continua no admin nativo do Medusa.
- **`npm run lint` no Cockpit está quebrado** por um problema de toolchain preexistente (`ajv`/`eslintrc`),
  sem relação com esta fase — não é regressão desta task.

**Rulings de execução (F2, verbatim das tasks 1–5):**
- **C1/C3** — `capa_url: null` explícito é a única forma de "sem capa"; `capa_url: ""` é rejeitado pelo
  backend (schema `.nullable()`, string vazia não passa em `min(1)`).
- **C2** — trocar o tipo de desconto sempre limpa o campo de valor (padrão, exceção e curado), para nunca
  salvar um número interpretado na unidade errada.
- **C4** — ao editar um curado, ids de produto fora da página de 100 do `GET /api/products` são
  preservados no array salvo, nunca descartados silenciosamente.
- **C5** — o motivo mostrado no painel da ficha do produto vem sempre da coleção/categorias **do próprio
  produto** (`GET /admin/products/:id`), nunca inferido a partir da lista de produtos limitada a 100.
