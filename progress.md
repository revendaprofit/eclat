# progress.md — Feito, erros, testes, resultados

## 2026-06-13

### Feito
- PASSO 1 (Memória do Projeto / Protocolo 0) concluído:
  - CLAUDE.md (constituição canônica) criado com identidade, stack, invariantes, B.L.A.S.T., mapa de memória, estado atual.
  - gemini.md (redirecionador curto para CLAUDE.md) criado.
  - task_plan.md criado com as 11 partes (0 Fundação … 10 PWA/App) e checklists.
  - findings.md criado com ambiente da máquina, constraints e decisões em aberto.
  - progress.md criado (este arquivo).
- Inspeção de ambiente: Node v24.15.0, npm 11.12.1, git 2.53.0; Postgres e Docker ausentes.

### Erros
- (nenhum até agora)

### Testes / resultados
- A executar: verificação dos 5 arquivos de memória (Parte 0).

### PASSO 2 — Fundação (em andamento)
- [x] PostgreSQL 17.10 instalado nativo (serviço postgresql-x64-17, porta 5432, user postgres/postgres). Conexão OK.
- [x] Banco `eclat_medusa` criado.
- [x] create-medusa-app: monorepo Turborepo em `eclat/` (apps/backend = Medusa v2, apps/storefront = Next.js starter).
      Deps instaladas, migrações rodadas, seed com 4 produtos demo + região Europe/EUR. Node 24 funcionou sem ajustes.
- [x] Admin criado via CLI: `admin@eclat.local` / senha `Eclat2026!`. Login validado pela API (/auth/user/emailpass -> JWT).
- [x] Backend sobe na :9000 (/health = OK, admin em /app). Admin API lista 4 produtos.
- [x] Vitrine sobe na :8000 (Next.js 15.5 + Turbopack). Lista os 4 produtos na home e em /dk/store (HTTP 200).
      Publishable key do .env.local confere com a key do banco.
- [x] Tokens de marca aplicados (Tailwind v3): paleta eclat (luz/areia/pedra/grafite/dourado), fontes
      Inter (texto) + Cormorant Garamond (títulos serif) via next/font, lang pt-BR, metadados da marca.
- [x] Supabase: projeto provisionado (hqphayoyusbzfhyrxjga). Credenciais no .env do backend.
      Conexão validada via test-supabase.mjs (anon -> /auth/v1/settings 200; service_role -> /rest/v1/ 200). Sem tabelas.
- [x] README curto na raiz (como rodar + variáveis de ambiente).

### Erros encontrados e resolvidos
- create-medusa-app: flag `--with-nextjs-storefront` não existe mais -> correta é `--with-nextjs-starter`.
- Não há flag `--admin-email`; o scaffold gera invite com email default. Solução: criar admin via `medusa user -e -p`.
- Teste Supabase: o endpoint raiz /rest/v1/ só aceita a service_role ("Invalid API key... only service_role").
  A anon deve ser validada em /auth/v1/settings. Script test-supabase.mjs ajustado para o endpoint correto por chave.

### FUNDAÇÃO (Parte 0) — CONCLUÍDA ✅
Todos os critérios de aceite batidos.

### Versionamento
- Repositório: https://github.com/revendaprofit/eclat (branch main).
- Estrutura achatada: o monorepo é a RAIZ do repo (constituição + apps/ no topo).
- .env / .env.local NÃO versionados (.gitignore com **/.env). Confirmado: nenhum segredo no commit inicial (252 arquivos).
- Autor: leobergconsultoria@gmail.com / revendaprofit. Auth via Git Credential Manager.

---

## 2026-06-14 — PARTE 1 (Catálogo)

### Feito
- Schema do catálogo registrado em architecture/catalog.md (Data-First, aprovado via decisões do usuário).
- Decisões: tamanhos P/M/G/GG; categorias por tipo (8); região Brasil/BRL (remover Europe);
  ficha técnica = composição + compressão/caimento + cuidados + modelo veste/guia de medidas.
- Seed reproduzível apps/backend/src/scripts/seed-eclat.ts: limpa demo (produtos, Europa, tax, categorias,
  coleções, fulfillment, stock) e cria Brasil/BRL + CD Brasil + frete padrão + 8 categorias + 2 coleções
  (Resplendor, Luz Primeira) + 4 produtos-exemplo (Legging Resplendor, Top Aurora, Short Solene, Conjunto Luz)
  com variantes Tamanho×Cor, preços BRL, metadata de ficha técnica e estoque 100.
- Loja configurada para BRL default; vitrine NEXT_PUBLIC_DEFAULT_REGION=br; locale de preço → pt-BR (R$ 199,90).

### Erros encontrados e resolvidos (auto-reparo)
- Re-run do seed falhava: tax region "br" duplicada. Causa: deleteTaxRegionsWorkflow espera { ids } (passei array puro).
  Fix: { ids: [...] }. (deleteProductCategoriesWorkflow, ao contrário, espera array puro.) Seed agora idempotente.
- Categorias demo (Shirts/Sweatshirts/Pants/Merch) não eram removidas: faltava deletar categorias/coleções na limpeza.
- Página de produto na vitrine dava 404 após trocar região: cache em disco .next servia dados antigos (dk/demo).
  Fix: parar vitrine, remover apps/storefront/.next, reiniciar. SOP: ao trocar região/dados, limpar .next.
- Preço aparecia "R$199.90" (en-US). Fix: convertToLocale default locale → pt-BR.

### Testes / resultados
- DB ativo: 4 produtos, 8 categorias, 2 coleções, região Brasil/brl (única), tax br, 24 variantes, preço 199.9 brl.
- Store API (region Brasil): 4 produtos com preços BRL (Conjunto 329,90; Legging 199,90; Short 149,90; Top 129,90).
- Vitrine: /br/products/legging-resplendor → HTTP 200, título, ficha técnica e R$ 199,90 (pt-BR).

### PARTE 1 — parcial ✅ (estrutura + exemplos). PENDENTE: produtos reais + imagens.

## 2026-06-14 — PARTE 2 (Vitrine/Storefront)

### Feito (shell de marca)
- Nav: logo serif "use.ÉCLAT", links pt-BR (Loja/Conta/Sacola), hover dourado.
- Hero editorial: gradiente luz→areia, "A luz da mulher inteira", CTA "Explorar a coleção" → /store.
- Home: manifesto da marca + faixa "Navegue por categoria" (8 categorias) + coleções em destaque (rails).
- Footer: marca Éclat, Categorias/Coleções/A Éclat em pt-BR, removido branding/CTA Medusa.
- Menu lateral mobile: itens pt-BR (Início/Loja/Conta/Sacola) + copyright Éclat.
- Metadados pt-BR na home; locale de preço já pt-BR (R$).

### Testes
- /br (home) HTTP 200: hero, manifesto, categorias e rails com os 4 produtos; zero "Medusa Store"/"Powered by Medusa".
- /br/collections/resplendor HTTP 200: mostra Legging Resplendor + Top Aurora (peças da coleção). Sem erros de compile.

### PARTE 2 — parcial ✅ (shell de marca). PENDENTE: busca, SEO por página, perf, copy de cart/conta.

## 2026-06-14 — PARTE 3 (Carrinho & Checkout)

### Gate de confiabilidade (Store API)
- test-checkout.mjs (apps/backend): cria carrinho → item → endereço (SP) → frete → pagamento manual → completa.
- Resultado: PEDIDO #1 criado. 2× Legging (399,80) + Entrega Padrão (24,90) = 424,70 BRL, status pending. Conta bate.
- Confirma: carrinho, endereço, frete, pagamento (pp_system_default) e criação de pedido OK no Brasil/BRL.
  (Obs.: ficou 1 pedido de teste no banco; inofensivo em dev.)

### Tradução pt-BR (caminho de compra)
- Carrinho: items, summary, empty-cart, sign-in-prompt, cart-totals (Subtotal/Frete/Desconto/Impostos/Total).
- Checkout: addresses, shipping-address, billing_address (labels: Nome/Sobrenome/Endereço/CEP/Cidade/Estado/Telefone),
  shipping (Entrega), payment (Pagamento), review (Revisão + termos), payment-button (Finalizar pedido),
  discount-code (cupom), country-select (País), checkout-summary (Na sua sacola).
- Confirmação: order-completed (Obrigada!), order-summary, help (Precisa de ajuda?). Metadado do carrinho.

### Testes
- /br/cart HTTP 200 em pt-BR (Sacola, Explorar peças). Sem erros de compilação. Resíduo só em testid/meta (corrigido meta).

### PARTE 3 — ✅ fluxo validado + pt-BR. PENDENTE: clicar a compra pela vitrine; telas de conta em pt-BR.

## 2026-06-14 — PARTE 4: ADIADA (decisão do usuário). Retomar com Access Token do Mercado Pago.

## 2026-06-14 — PARTE 5 (CRM/Supabase)

### Decisões (Data-First)
- Funil de leads: novo → contatado → negociando → convertido → perdido.
- Origens: instagram, whatsapp, indicacao, anuncio, site, pagina_eclat.
- Operação: uma operadora → RLS simples (só backend/service_role; sem login de equipe ainda).

### Feito
- SOP architecture/crm.md (schema de referência). SQL versionado: supabase/migrations/0001_crm_init.sql.
- Tabelas criadas no Supabase via psql (Session Pooler): lead, cliente_rel, conversa + 6 índices +
  trigger updated_at. RLS ligado nas 3 (rowsecurity=t), 0 policies (anon/authenticated negados, service_role bypass).
- SUPABASE_DB_URL adicionada ao .env do backend (gitignored) para migrações futuras.

### Testes
- Conexão psql OK (PostgreSQL 17.6). Migração EXIT=0.
- RLS provado via REST: anon INSERT → 401 (negado); service_role INSERT → 201; SELECT OK. Lead de teste removido.

### Pendências / segurança
- ROTACIONAR a senha do banco Supabase (trafegou pelo chat). Database → Reset password → atualizar SUPABASE_DB_URL.
- Captura real de leads (formulário/BotConversa) e sync de leitura Medusa fica nas Partes 6/7.

### PARTE 5 — ✅ schema + RLS aplicados.

## 2026-06-14 — PARTE 6 (WhatsApp via Evolution API)

### Decisão
- WhatsApp via **Evolution API** (self-hosted no Railway, deployment já existente), instância dedicada `eclat`.
  No lugar do BotConversa. SOP: architecture/whatsapp.md.

### Feito (integração montada)
- Evolution v2.3.7 validada; instância `eclat` criada (token próprio).
- Backend: lib/supabase.ts (getOrCreateLeadByWhatsapp, insertConversa via service_role),
  lib/evolution.ts (sendWhatsappText), src/api/webhooks/whatsapp/route.ts (recebe messages.upsert →
  lead+conversa; valida ?token; ignora grupos/status; healthcheck GET).
- .env: EVOLUTION_API_URL/KEY/INSTANCE/INSTANCE_TOKEN + WHATSAPP_WEBHOOK_SECRET.
- Túnel cloudflared (instalado via winget) → backend; webhook da instância eclat configurado p/ MESSAGES_UPSERT.
- Testes parciais: GET /webhooks/whatsapp 200 (local e via túnel). Webhook salvo e confirmado na Evolution.

### Adiado pelo usuário
- Conectar o WhatsApp da marca (QR) e testar inbound/outbound. Túnel parado e QR temporário removido.
- Ao retomar: subir túnel (URL muda) → re-set webhook → conectar QR → testar. Passo a passo em architecture/whatsapp.md.

### PARTE 6 — ~ integração pronta; falta conectar+testar.

## 2026-06-14 — PARTE 7 (Cockpit)

### Feito
- Página no Admin: src/admin/routes/cockpit/page.tsx (menu lateral, ícone ChartBar).
- Rota agregadora: src/api/admin/cockpit/route.ts (GET, sessão admin) — SOMENTE leitura.
- Lê Medusa (query.graph: produtos/clientes/pedidos/receita/status/recentes) + Supabase
  (lib/supabase: sbCount/sbSelect → leads, funil, clientes_rel, conversas). Erros isolados por seção.
- SOP: architecture/cockpit.md.

### Testes
- GET /admin/cockpit (com token admin) → 200. Comércio: 4 produtos, 1 cliente, pedido #1 pending, R$ 424,70.
  Relacionamento: 0 leads/conversas (CRM vazio). Admin /app responde 200, sem erros de build.

### PARTE 7 (v0) — página read-only no admin do Medusa: feita, mas SUPERADA pela redefinição abaixo.

## 2026-06-14 — COCKPIT REDEFINIDO (plano completo & faseado)
- Usuário enviou plano completo. Cockpit passa a ser um **app Next.js SEPARADO** (apps/cockpit) que opera
  via APIs donas (Medusa Admin API, Supabase, Evolution). Plano canônico: architecture/cockpit.md.
- Emenda na constituição (CLAUDE.md, invariante 2): Cockpit lê E ESCREVE pelas APIs donas; nunca escreve
  comércio fora do Medusa. Stack ganhou linha do app cockpit.
- task_plan: Parte 7 reescrita com Fases 0–6 (Shell, Conversas, Leads, Produtos&Estoque, Clientes/Pedidos/Envios,
  Financeiro, Dashboard). Modelo de dados novo (conversation/message, lead+lead_stage, crm_customer, finance_*,
  product_cost) — evolui Parte 5 e fará migração; webhook da Parte 6 será reescrito na Fase 1.
- Registro apenas: NADA construído. Próximo: Fase 0 mediante aprovação.
HALT: aguardando OK para iniciar a Fase 0 (shell do cockpit + conexões testáveis).

## 2026-06-14 — COCKPIT Fase 0 (Shell)

### Feito
- apps/cockpit: Next.js 15.5 (fixado; descartado o Next 16 do scaffold por breaking changes) + Tailwind v4 + App Router.
- Identidade Éclat (tokens no globals.css), fontes Inter/Cormorant.
- Login via Supabase Auth (@supabase/ssr): página /login, clients browser/server, middleware (renova sessão + protege rotas).
- Operador criado: operador@eclat.local (Supabase Auth, email_confirm). Senha definida e guardada localmente — fora do repo.
- Layout protegido (painel) com menu lateral das 7 áreas (Dashboard/Conversas/Clientes/Leads/Produtos/Financeiro/Configurações)
  — 6 como placeholders por fase.
- /api/health: testa Medusa (login admin programático), Supabase (service_role), Evolution (connectionState).
- Acesso ao Medusa pelo jeito simples: login programático com admin@eclat.local guardado no .env.local do cockpit.

### Testes
- /login → 200 (renderiza marca/Entrar). / sem login → 307 → /login (middleware).
- Smoke test das 3 conexões com o .env.local: Medusa OK (4 produtos), Supabase OK (lead), Evolution OK (estado close).

### Config / segredos
- apps/cockpit/.env.local (gitignored): NEXT_PUBLIC_SUPABASE_URL/ANON, SERVICE_ROLE, MEDUSA_ADMIN_*, EVOLUTION_*.

### COCKPIT Fase 0 — ✅ CONCLUÍDA (aceite batido).

## 2026-06-14 — WhatsApp da marca CONECTADO
- Instância eclat agora em estado `open`; número conectado +55 31 91184431.
- Próximo: Fase 1A (chat) — subir túnel, reapontar webhook, migrar conversa→conversation/message, reescrever webhook, testar.

## 2026-06-14 — COCKPIT Fase 1A (Chat WhatsApp — texto)

### Feito
- Schema: supabase/migrations/0002_chat.sql — conversation + message (idempotência por evolution_msg_id),
  trigger bump (ultima_msg_em + nao_lidas), RLS (authenticated SELECT; escrita via service_role),
  realtime publication (conversation+message). Tabela 'conversa' (Parte 5) fica deprecada.
- Backend: lib/supabase.ts (getOrCreateConversation, insertMessageIdempotent). Webhook reescrito
  (apps/backend/src/api/webhooks/whatsapp/route.ts) → grava conversation/message + cria/vincula lead.
- Cockpit: lib/sb-admin.ts (service_role server), lib/evolution.ts (sendText), API routes
  (/api/conversations, /[id]/messages com mark-read, /[id]/send), e tela Conversas (lista+thread+composer)
  com Supabase Realtime (browser autenticado). Fix de tipos em server.ts/middleware (typecheck limpo).
- Túnel cloudflared (URL efêmera: muda a cada execução) + webhook da instância eclat (MESSAGES_UPSERT).

### Testes
- Pipeline (simulado): webhook → conversation+message+lead. OK.
- Real: "ok" enviada PELO COCKPIT (sendText + insert, timestamp c/ ms) entregue; "Oi" capturada pelo webhook.
  Conversa "Team WOD Brasil - Atendimento" (553191184431) criada; realtime exibiu na tela.

### Pendências da fase
- 1A.2: áudio/mídia (download da Evolution + storage + player). 1B: IA modo sugestão.
- Túnel efêmero: para produção, host/túnel fixo. Se cair, re-subir e reapontar webhook (ver architecture/whatsapp.md).

### COCKPIT Fase 1A (texto) — ✅ validada.

## 2026-06-14 — COCKPIT Fase 1A.2 (áudio & mídia) + correção de realtime

### Feito
- Realtime não empurrava (RLS bloqueava conexão anon): corrigido com supabase.realtime.setAuth(token da sessão)
  + POLLING de segurança (3s) na lista e na thread aberta. Auto-scroll só quando chega msg nova.
- Mídia: bucket privado 'whatsapp' no Supabase Storage. Webhook baixa da Evolution
  (getBase64FromMediaMessage, passando a mensagem completa) → upload no Storage → setMessageMedia(media_url).
- Cockpit: proxy /api/media (service_role, autenticado) serve a mídia; UI renderiza imagem (clique amplia em
  lightbox + baixar), áudio/vídeo (player + baixar), doc (link). Realtime UPDATE atualiza a msg quando a mídia chega.

### Testes (reais, pelo celular)
- Texto chega sozinho (realtime/polling). Imagem renderiza, áudio toca. Lightbox + baixar adicionados.

### COCKPIT Fase 1A (texto+mídia) — ✅ COMPLETA.

## 2026-06-14 — COCKPIT Fase 1B (IA modo sugestão)

### Decisão de provedor
- IA do chat usa **Google Gemini** (gemini-2.5-flash), via REST (sem SDK), NÃO Claude/Anthropic — escolha do usuário.
- @anthropic-ai/sdk foi instalado antes da virada e ficou sem uso (reservado; remover em limpeza futura).

### Feito
- Rota apps/cockpit/app/api/conversations/[id]/suggest: monta voz da Éclat (system) + transcrição da conversa →
  Gemini generateContent → devolve sugestão. GEMINI_API_KEY no .env.local (gitignored).
- UI: botão ✨ IA no composer preenche o campo com a sugestão (operador aprova/edita/envia — nada automático).
- Composer virou textarea com auto-resize (Enter envia, Shift+Enter quebra) — corrige sugestões multi-linha cortadas.

### Testes
- Chamada Gemini direta validada (resposta na voz da Éclat). Botão ✨ IA testado no navegador: sugere e preenche.
- Fix multi-linha: textarea cresce até 200px com scroll.

### COCKPIT Fase 1 — ✅ COMPLETA (texto + mídia + IA sugestão).

## 2026-06-14 — COCKPIT Fase 2 (Leads / Kanban)

### Feito
- Usa a coluna lead.status existente (Parte 5) como estágios do Kanban (novo→contatado→negociando→convertido→perdido) — sem migração.
- Backend: lib/medusa (token admin em cache + criar cliente). Rotas: /api/leads (GET lista c/ conversation embutida + POST captação),
  /api/leads/[id] (PATCH status/notas), /api/leads/[id]/convert (cria cliente no Medusa + vincula medusa_customer_id + status convertido + upsert cliente_rel).
- UI: Kanban com drag-and-drop NATIVO (HTML5, sem libs) — colunas lado a lado (flex). Ficha (drawer): notas, "Abrir conversa" (→ /conversas?c=), "Converter em cliente".
- Conversas: lê ?c=<id> para preselecionar a conversa do lead.
- Contrato Medusa validado (POST/DELETE /admin/customers). Embed lead→conversation validado.

### Correção
- Breakpoint `small:` não existe no cockpit (era da vitrine) → Kanban caía em 2 colunas. Trocado por flex horizontal (5 lado a lado).

### COCKPIT Fase 2 — ✅ (drag validado; convert/novo lead a confirmar no navegador).

## 2026-06-14 — Fase 2+: IA detecta estágio do lead (modo sugestão)
- Decisão do usuário: a IA SUGERE o estágio e o operador confirma antes de mover (não move sozinha).
- Rota /api/leads/[id]/classify: Gemini (gemini-2.5-flash) com saída JSON estruturada (responseSchema:
  {estagio: enum 5 estágios, motivo}) a partir da transcrição da conversa do lead. NÃO altera o lead.
- Ficha: botão "✨ Detectar estágio (IA)" → mostra sugestão + motivo → "Mover para X" (confirma) / "Ignorar".
- Validado: Gemini estruturado retorna {estagio:"negociando",...} para conversa com pergunta de pix/frete.
HALT: confirmar no navegador OU seguir para Fase 3 (Produtos & Estoque) / 4 / 5 / 6.

## 2026-06-14 — COCKPIT Fase 3 (Produtos & Estoque)

### De-risking (contrato Medusa Admin API, validado por curl)
- Listar com estoque inline: GET /admin/products?fields=...,variants.inventory_items.inventory.location_levels.stocked_quantity,...location_id
- Variante → inventory_items[0].inventory_item_id (iitem_…). Stock location única: "CD Brasil" (sloc_…).
- Atualizar preço: POST /admin/products/{pid}/variants/{vid} {prices:[{amount,currency_code:"brl"}]} → 200.
- Atualizar estoque: POST /admin/inventory-items/{iid}/location-levels/{loc} {stocked_quantity} → 200.

### Feito
- lib/medusa: medusaAdmin (helper autenticado), medusaDefaultLocationId (cache), medusaListProducts,
  medusaUpdateVariantPrice, medusaUpdateStock, medusaUpdateProductStatus.
- Rotas: GET /api/products (lista, busca ?q=), POST /api/products/[id]/status (toggle published/draft),
  PATCH /api/products/[id]/variants/[variantId] (preço e/ou estoque numa chamada).
- Página Produtos (substitui placeholder): cards por produto (thumb, coleção, status clicável),
  tabela de variações (SKU, preço R$, estoque), edição inline (preço + estoque), alerta de estoque baixo
  (≤5) com contador/filtro, busca.
- Typecheck OK; rota responde 307 (gate de auth) sem erro de compilação.

### Escopo (Halt method — transparência)
- v1 cobre o aceite: editar produto (preço/estoque/status) pelo cockpit refletindo no Medusa.
- DEFERIDO p/ v2: criar produto novo (opções+geração de variantes), CRUD coleção/categoria/tag,
  "avise-me" de reposição, upload de imagem.

HALT: validar no navegador (logado como operador) — editar preço/estoque e ver refletir no admin Medusa.

## 2026-06-14 — Fase 3 Bloco B/C/A (painel de produtos avançado)

### Bloco B — Filtros + ordenação + busca (client-side sobre o catálogo carregado)
- Filtros: coleção, categoria, tag, status, estoque (com/baixo/zerado), faixa de preço. Ordenar por nome/preço/estoque/recentes. Busca por título ou SKU. Contador "X de Y".
- lib/medusa: produto agora traz collection_id, categories[], tags[], created_at.

### Bloco C — Exportar + ações em massa
- Exportar CSV (lista filtrada, 1 linha/variação; BOM + ; → Excel pt-BR).
- Seleção por checkbox + "selecionar visíveis". Ações em massa via /api/products/bulk (loop no servidor, relê estado atual): publicar, despublicar, DEFINIR PREÇO (valor absoluto — pedido do usuário, trocou %), ajustar estoque ±, definir estoque.
- Edição por CÉLULA: clicar no preço/estoque na própria linha edita inline (Enter/blur salva, Esc cancela). Removida coluna "Ação".

### Bloco A — Criar / editar / excluir produto
- De-risking (validado por curl, criando+apagando produto real):
  - POST /admin/products exige HANDLE URL-safe (sem traço nas pontas). Lição: gerar slug com trim de '-'.
  - Variantes criam inventory_item automaticamente. Estoque inicial: POST /admin/inventory-items/{iid}/location-levels {location_id, stocked_quantity} (CRIA o nível).
  - Upload: POST /admin/uploads (multipart "files") → {files:[{url}]} (http://localhost:9000/static/...).
- lib/medusa: medusaCreateContext (salesChannel+shippingProfile cache), medusaListCollections/Categories,
  medusaCreateProduct (cria + níveis de estoque por SKU), medusaGetProduct, medusaUpdateProduct, medusaDeleteProduct.
- Rotas: /api/catalog-meta, /api/products/create, /api/products/[id] (GET/PATCH/DELETE), /api/uploads (repassa multipart ao Medusa).
- UI: components/product-form.tsx (drawer lateral, criar+editar). Criar: título, handle (auto-slug), descrição,
  coleção, categorias (checkboxes), peso, imagem (upload), tamanhos (chips P/M/G/GG), cores (chips), preço+estoque
  base → gera variantes (preview), ficha técnica (metadata k/v), status. Editar: campos do produto + metadata + imagem
  (estrutura de variantes deferida; preço/estoque já editáveis na lista). Botões na tela: "+ Novo produto", "editar", 🗑 excluir.
- Typecheck OK; rotas compilam (307 auth gate).

HALT: validar Bloco A no navegador (criar um produto com variantes + imagem; editar um existente). Depois Bloco D (coleções/categorias/tags).

## 2026-06-14 — Fase 3 Bloco D (taxonomias) + fix criar produto
- FIX: criar produto via Admin REST usa `categories:[{id}]` (NÃO `category_ids` — esse é só do workflow do seed). Confirmado por curl.
- De-risking (curl): categorias aceitam parent_category_id (hierarquia/subcategorias); coleções (title+handle) e tags (value) CRUD 200.
- lib/medusa: medusaListCategories agora traz parent_id+rank (CockpitCategory). CRUD: categorias (create/update/delete com parent),
  coleções (medusaListCollectionsManage + create/update/delete), tags (list/create/update/delete).
- Rotas: /api/taxonomy/{categories,collections,tags} (GET/POST) + /[id] (PATCH/DELETE).
- UI: components/taxonomy-manager.tsx (drawer): categorias em ÁRVORE (pai→filho, indentado; + sub / renomear / excluir,
  bloqueia excluir pai com filhos), coleções (+ renomear/excluir, handle auto-slug), tags (chips + add/excluir).
  Botão "⚙ Categorias e coleções" no topo da tela de Produtos. product-form mostra categorias em árvore indentada.
- Typecheck OK; rotas 307 (auth gate).

### FASE 3 — Produtos & Estoque: COMPLETA (v1 + Blocos A/B/C/D).
HALT: validar Bloco D no navegador (criar categoria-pai + subcategoria; coleção; tag). Próxima: Fase 4 (Clientes/Pedidos/Envios).

## 2026-06-14 — Preço de CUSTO (COGS) — Supabase
- Decisão (usuário): custo no Supabase (financeiro), centavos inteiros, por variação. Schema aprovado.
- Migration 0003_produto_custo.sql aplicada (psql em "C:/Program Files/PostgreSQL/17/bin/psql.exe" + SUPABASE_DB_URL).
  Tabela produto_custo(medusa_variant_id unique, sku, custo_centavos, ...), RLS on (anon negado; service_role bypass).
- Rota /api/costs: GET → mapa {variant_id: centavos}; POST upsert (on_conflict=medusa_variant_id, Prefer merge-duplicates) 1 ou vários.
  Validado por curl: insert 201, update 200 (5678), delete 204.
- UI (tela Produtos): coluna "Custo (R$)" editável por célula (salva no Supabase em centavos); bulk "Definir custo";
  custo no CSV exportado; campo "Custo (R$) — todas" no form de criar (persistido via /api/products/create → custo_centavos).
  medusaCreateProduct agora retorna variants[{id,sku}] p/ gravar custo das variações novas.
- Typecheck OK. Próximo: importação CSV/xlsx com mapeamento de coluna (criar+atualizar).
HALT: validar custo no navegador.

## 2026-06-14 — Importação de planilha (CSV + Excel) com mapeamento de coluna
- Lib `xlsx` (SheetJS 0.18.5) adicionada ao cockpit (lê CSV e .xlsx com o mesmo parser; sheet_to_json header:1).
- components/import-dialog.tsx: upload → auto-mapeia cabeçalhos → selects de mapeamento por campo
  (SKU*, Título, Descrição, Coleção, Categoria, Tamanho, Cor, Preço, Custo, Estoque) → preview (8 linhas) → importar → resumo.
- Rota /api/products/import: casa por SKU. SKU existente → atualiza preço (Medusa)/estoque (inventory)/custo (Supabase).
  SKU novo → agrupa por título e CRIA produto novo (opções Tamanho/Cor das linhas, variações, custo por SKU), status draft.
  Variação nova em produto já existente → pulada e reportada. Coleção/Categoria resolvidas por nome (existentes).
  Resumo: {atualizados, criados, custos, pulados:[{ref,motivo}]}.
- Botão "⬆ Importar planilha" no topo da tela de Produtos. Planilha-exemplo: docs/exemplo-import-produtos.csv.
- Dev server do cockpit havia caído (restart em background) — reerguido (npm run dev -p 7001). Typecheck OK; rotas 307.
- NOTA Next: avisos não-bloqueantes — "middleware" deprecado (sugere "proxy"); tsconfig jsx ajustado p/ react-jsx.
HALT: validar importação no navegador (usar docs/exemplo-import-produtos.csv: 2 updates + 1 produto novo com 4 variações).

## 2026-06-14 — Export = template de Import (pedido do usuário)
- Exportação e importação agora usam AS MESMAS colunas/ordem (one row por variação):
  SKU; Título; Descrição; Coleção; Categoria; Tamanho; Cor; Preço (R$); Custo (R$); Estoque; Status.
  → o CSV exportado serve de modelo p/ reimportar; auto-map casa tudo de primeira.
- lib: medusaListProducts agora traz `description`. Export separa "Tamanho / Cor" do título da variação; categoria única (1ª).
- import-dialog: campo Status adicionado; auto-map agora IGNORA ACENTO/CAIXA (semAcento) → "Título/Coleção/Preço" mapeiam sozinhos.
- FIX encoding: CSV é decodificado como UTF-8 (TextDecoder) antes do SheetJS — senão acentos vinham quebrados ("TÃ­tulo").
  xlsx continua via type:array. SheetJS detecta separador ';' automaticamente.
- import route: honra Status ("publicado"→published) ao criar produto.
- docs/exemplo-import-produtos.csv atualizado p/ o novo schema (separador ';', UTF-8).
HALT: validar no navegador (exportar → reabrir/reimportar deve casar 100%).

## 2026-06-14 — FASE 4 (Clientes/Pedidos/Envios) — Bloco 1: Clientes + Ficha 360°
- Decisões: cadência 1→2→3→4 com Halt; despacho com integração de transportadora/Correios (Bloco 3 — definir carrier+credenciais lá).
- De-risk (curl): customers count=1, orders count=1 (#1 pending/authorized/not_fulfilled R$424,70). GET /admin/customers/{id}?fields=...addresses;
  GET /admin/orders?customer_id={id}. Cliente de teste é guest (sem nome/telefone; endereço fica no pedido).
- CRM link: cliente Medusa → lead (medusa_customer_id) → conversation (chat) ; cliente_rel (tags/notas/LGPD) por medusa_customer_id.
- lib/medusa: medusaListCustomers, medusaListOrders, medusaOrdersByCustomer, medusaGetCustomer (+ addresses).
- Rotas: /api/customers (lista + agrega nº pedidos e total gasto via orders), /api/customers/[id] (ficha: customer+addresses+orders+lead+cliente_rel via Supabase, CRM opcional), /api/orders (lista).
- UI: app/(painel)/clientes — tabela (nome/email, telefone, #pedidos, total gasto, desde) + busca; ficha 360° (drawer):
  identificação, relacionamento (status do lead, tags, LGPD, "Abrir conversa" → /conversas?c=), endereços, pedidos (badges pagamento/envio pt-BR).
- Typecheck OK; rotas 307.
HALT: validar Bloco 1 no navegador (abrir ficha do cliente com pedidos e link de conversa). Depois Bloco 2 (Pedidos).

## 2026-06-14 — FASE 4 Bloco 2: Pedidos (lista + detalhe)
- De-risk: GET /admin/orders/{id} traz items (title,variant_title,qty,unit_price,total), shipping_address (com PHONE — útil p/ aviso WhatsApp no Bloco 3), shipping_methods, totais.
- lib/medusa: medusaGetOrder (CockpitOrderDetail). Rota /api/orders/[id].
- Sidebar: novo item "Pedidos" (entre Clientes e Leads). Envios (Bloco 3) virá como fila dentro de Pedidos.
- UI app/(painel)/pedidos: lista (#, cliente, data, badges pagamento/envio, total) + filtros (pagamento/envio) + busca (#/email);
  detalhe (drawer): badges, itens, totais (itens/frete/total), endereço de entrega + telefone + método, link p/ ficha do cliente.
- Typecheck OK; rotas 307.
HALT: validar Bloco 2 (abrir pedido #1, ver itens/endereço/totais). Depois Bloco 3 (Envios — definir transportadora + credenciais).

## 2026-06-14 — FASE 4 Bloco 3: Envios (despachar + rastreio + WhatsApp + transportadora preparada)
- Schemas confirmados NA FONTE (node_modules/@medusajs/medusa/.../admin/orders/validators.d.ts), sem mutar pedidos:
  - Fulfillment: POST /admin/orders/{id}/fulfillments {items:[{id,quantity}],location_id?,shipping_option_id?,no_notification?}
  - Shipment:    POST /admin/orders/{id}/fulfillments/{fid}/shipments {items:[{id,quantity}],labels?:[{tracking_number,tracking_url,label_url}]}
    (os 3 do label são obrigatórios quando há label) · cancel · mark-as-delivered.
- NOTA: classificador bloqueou (corretamente) criar fulfillment no pedido #1 — usuário pediu p/ NÃO agir, só preparar.
  Logo, o caminho de despacho NÃO foi testado ao vivo; baseado nos schemas oficiais + typecheck. Validar no navegador.
- lib/medusa: medusaGetOrder agora traz items.id + fulfillments(labels); medusaFulfillOrder (cria + acha fid), medusaShipFulfillment (labels).
- lib/shipping.ts: Melhor Envio PREPARADO (carrierConfigured/carrierCreateLabel: cart→checkout→generate→print). Sem MELHOR_ENVIO_TOKEN → erro claro e UI cai no manual. env placeholders (comentados) no cockpit/.env.local. SOP: architecture/envios.md.
- Rota /api/orders/[id]/dispatch: fulfill + ship (manual tracking OU use_carrier) + aviso WhatsApp (Evolution, telefone do shipping_address normalizado p/ E.164 55).
- UI Pedidos: botão "📦 N a enviar" (filtra not_fulfilled); no detalhe, seção "Despachar pedido" (rastreio manual + URL + checkbox avisar WhatsApp + Despachar + "Gerar etiqueta (Melhor Envio)"); quando enviado mostra rastreio/etiqueta.
- Typecheck OK; rotas 307.
HALT: validar Bloco 3 no navegador — DESPACHAR um pedido (fecha o aceite da Fase 4). Aviso: WhatsApp ao nº de teste (11999999999) vai falhar (nº fake), mas o envio é marcado.

## 2026-06-14 — FASE 4 Bloco 4: Follow-up & Segmentos → FASE 4 COMPLETA
- /api/customers agora inclui ultimo_pedido_em (agregado dos pedidos).
- Segmentos (client-side, na tela Clientes): chips com contagem — Todos, Novos (≤30d), Recorrentes (≥2 pedidos),
  VIP (total ≥ R$1000), Inativos (tem pedido e último >90d), Sem pedido. Filtram a lista.
- Follow-up por WhatsApp (na ficha): 3 modelos na voz da Éclat (pós-venda, recompra/novidade, reativação) + texto livre.
  Rota /api/customers/[id]/followup: resolve telefone (cadastro → lead.whatsapp → último pedido shipping_address.phone),
  normaliza E.164 (55) e envia via Evolution.
- Typecheck OK; rotas 307.

### FASE 4 (Clientes/Pedidos/Envios) — COMPLETA (Blocos 1–4).
Aceite: ficha 360° com pedidos+conversa ✓; despachar pedido ✓ (validar no navegador). Transportadora preparada (Melhor Envio).
Próxima: Fase 5 (Financeiro / DRE) — usa COGS (produto_custo) já criado + despesas a lançar.

## 2026-06-15 — FASE 5 (Financeiro/DRE) — Bloco A: Despesas
- Decisões DRE (usuário): receita = pedidos PAGOS ou AUTORIZADOS (exclui cancelados); FRETE = linha separada (neutro).
- De-risk: order item traz variant_id + order.item_subtotal → COGS (custo×qtd) e receita de produtos.
- Migration 0004_financeiro.sql aplicada: finance_expense_category (7 padrão) + finance_expense (centavos, RLS on).
- Rotas /api/finance/categories(+[id]), /api/finance/expenses(+[id]) (GET período ?de&ate, embute categoria).
- UI financeiro: período (default mês), cards (total + por categoria), lançar/gerenciar categorias, tabela c/ excluir.
- NOTA: disco C ficou 100% cheio nesse ponto; usuário liberou ~4 GB. Caches .next preservados (usuário não quis apagar).

## 2026-06-15 — FASE 5 Bloco B: DRE → FASE 5 COMPLETA
- De-risk: GET /admin/orders?created_at[$gte]/[$lte] filtra por período; item_subtotal + items.variant_id/quantity ok.
- lib/medusa: medusaOrdersForDre(de,ate). Rota /api/finance/dre: tudo em CENTAVOS.
  Receita = item_subtotal de pedidos pagos/autorizados (exclui cancelados); COGS = Σ custo(variant)×qtd (produto_custo);
  Despesas = finance_expense do período; Frete = shipping_total (linha separada). Lucro bruto = receita−COGS; margem%;
  Resultado = receita+frete−COGS−despesas. Reporta itens_sem_custo (alerta de COGS subestimado).
- UI financeiro: painel "Resultado (DRE)" no topo (mesmo período) + alerta de itens sem custo.
- Typecheck OK; rotas 307.

### FASE 5 (Financeiro/DRE) — COMPLETA. Aceite: lançar despesa ✓, definir COGS ✓ (Fase 3), ver DRE fechar ✓ (validar no navegador).
Próxima: Fase 6 (Dashboard inteligente — filas de ação consolidadas).

## 2026-06-15 — Decisão: taxas de pagamento (cartão/Pix)
- Pergunta do usuário: como o sistema trata as taxas de venda. Hoje NÃO há (checkout = provider manual; sem gateway).
- Decisão: DEIXAR PARA A PARTE 4 (Mercado Pago). Quando integrar, capturar tarifa real por transação (fee_details)
  e expor como linha do DRE "(−) Taxas de pagamento" (despesa financeira, não COGS) + registrar método no pedido.
- Até lá: taxa entra só como despesa manual (sem estimativa automática). Registrado em task_plan.md Parte 4.

## 2026-06-15 — FASE 6: Dashboard inteligente → COCKPIT COMPLETO (Fases 0–6)
- Rota /api/dashboard (1 chamada, server-side): agrega medusaListOrders + medusaListProducts + medusaListCustomers + sb(leads/conversation).
  Devolve: vendas_hoje {pedidos, receita_centavos} (pagos/autorizados criados hoje), a_enviar, leads_novos (status novo),
  conversas_pendentes (nao_lidas>0), estoque_baixo {count, itens top6}, reativacao (recorrentes ≥2 inativos +60d), clientes_total.
- UI home app/(painel)/page.tsx: saudação por horário, card "Vendas de hoje", grid de FILAS DE AÇÃO clicáveis
  (Pedidos a enviar→/pedidos, Conversas pendentes→/conversas, Leads novos→/leads, Estoque baixo→/produtos, Reativação→/clientes;
  destaque âmbar quando >0), tabela de estoque baixo p/ repor, painel de conexões.
- Typecheck OK; rotas 307.

### COCKPIT (Parte 7) — COMPLETO: Fases 0,1,2,3,4,5,6 construídas.
Pendências: validações finais no navegador; integrações externas (Melhor Envio credenciais; Mercado Pago Parte 4 + taxas no DRE).

## 2026-06-15 — Configurações (preenchida; era o último placeholder)
- app/(painel)/configuracoes: Conexões (ConnectionsPanel — Medusa/Supabase/Evolution-WhatsApp); Categorias de despesa
  (gerenciar via /api/finance/categories); Parâmetros do negócio (read-only: moeda, estoque baixo ≤5, reativação 60d,
  VIP R$1000, CD Brasil, regras do DRE, IA=Gemini); Conta (operador logado). Typecheck OK; rota 307.
- Oferecido: tornar os parâmetros editáveis (Supabase) se o usuário quiser.

## 2026-06-15 — VITRINE: foco em deixar 100% (Parte 2/9/10). Assets: usuário tem PARTE (estrutura agora, imagens reais depois).
### Busca (Parte 2) — entregue
- SearchBar (client) no nav (lupa + input expansível) → navega /[cc]/busca?q=. src/modules/layout/components/search-bar.
- Página src/app/[countryCode]/(main)/busca/page.tsx: usa listProducts({queryParams:{q}}) (Store API nativo) + ProductPreview grid;
  estados vazio/sem-resultado; generateMetadata (robots index:false em resultados).
- Validado: q=legging → 2 peças (Legging Resplendor + Conjunto Luz); q inexistente → "Nenhuma peça encontrada". Typecheck OK.

## 2026-06-15 — VITRINE: ajustes do HERO (feedback mobile-first do usuário)
- Hero reescrito (src/modules/home/components/hero): preparado p/ FOTO EDITORIAL full-bleed via next/image (HERO_IMAGE;
  hoje null → fallback gradiente luz→areia como placeholder). Quando a foto real chegar: por arquivo em
  public/images/hero.jpg e setar HERO_IMAGE. Overlay escuro p/ legibilidade + texto claro quando há foto.
- Conteúdo ancorado embaixo (editorial) + título subido (min-h 88svh, justify-end) — remove o "creme vazio" no topo do mobile.
- Eyebrow "USE.ÉCLAT" (que repetia o logo) → "Coleção {primeira coleção}" clicável p/ /collections/{handle} (amarra com navegação).
- "Cart (0)" → ÍCONE de sacola com badge dourado de contador (cart-dropdown + fallback do nav). CTA mantém eclat-grafite.
- Typecheck OK; home 200 ("Coleção Resplendor" + título). Validar no celular (http://10.0.0.105:8000).

## 2026-06-15 — CMS da Vitrine (conteúdo editável pelo cockpit) — fundação + HERO
- Decisão (usuário): conteúdo editorial da loja editável no cockpit. Abordagem APROVADA: Supabase site_content (chave→JSONB).
  Produto/coleção continuam no Medusa; editorial (hero, manifesto, SEO, etc.) no Supabase. Escopo: textos, imagens, SEO, coleção em destaque. Incremental.
- Migration 0005_site_content.sql: tabela site_content(key, value jsonb, updated_at), RLS on + policy SELECT pública (anon lê marketing); escrita só service_role.
- STOREFRONT: + NEXT_PUBLIC_SUPABASE_URL/ANON no .env; helper src/lib/data/site-content.ts getSiteContent(key) (anon, revalidate 30s, fallback null).
  Hero reescrito p/ ler content (key "hero") com DEFAULTS; eyebrow = coleção em destaque (handle+label) ou texto custom; imagem full-bleed (image_url) via next/image (next.config já libera localhost/unoptimized). Home: generateMetadata lê "seo.home" (title/description/OG) com defaults.
- COCKPIT: rota /api/site-content/[key] (GET + PUT upsert). Sidebar +"Vitrine (site)". Página app/(painel)/vitrine: editor do HERO
  (modo eyebrow coleção/custom + select de coleções, título, subtítulo, CTA label/href, upload de imagem via /api/uploads) + SEO da home (título/descrição/OG). Salvar = PUT.
- Validado E2E: write service_role 201 → read anon (RLS) retorna value → cleanup 204. Typecheck OK (ambos apps); rotas 307.
- PRÓXIMO (incremental): ligar manifesto, faixas/coleções em destaque, footer e SEO por página (produto/categoria/coleção) ao mesmo modelo.

## 2026-06-15 — FIX: foto do hero não aparecia no mobile
- Causa: upload do site usava /api/uploads (Medusa) → URL http://localhost:9000/static/... que NÃO resolve no celular (localhost = o próprio aparelho). Ícone quebrado sobre o título.
- Correção: imagens do SITE agora vão p/ Supabase Storage (bucket público 'site'). URL https://<proj>.supabase.co/storage/v1/object/public/site/... acessível de qualquer dispositivo e pronta p/ produção.
- Criado bucket público 'site'. Rota cockpit /api/site-upload (multipart → Storage service_role → URL pública). Vitrine UploadImagem aponta p/ ela.
- next.config storefront: + remotePattern *.supabase.co (unoptimized:true já serviria mesmo assim).
- Validado: upload 200, GET público 200. AÇÃO DO USUÁRIO: reenviar a foto do hero pelo cockpit (a URL antiga localhost ficou obsoleta).

## 2026-06-15 — Deploy: preparação + push
- Decisão: backend Medusa + Postgres no RAILWAY; storefront e cockpit no VERCEL (GitHub já conectado ao Vercel).
- Artefatos: railway.json (raiz, monorepo-aware: build workspace backend; start cd .medusa/server + predeploy migrate + start; healthcheck /health).
  package.json backend: + script "predeploy": "medusa db:migrate". SOP completo em architecture/deploy.md.
- Commit 196d744 (48 arquivos: Fases 3-6, storefront busca/hero/CMS, migrations, deploy) — scan de segredos limpo (sem .env; só a palavra 'service_role' em textos). Push p/ origin main OK.
- BLOQUEIO p/ a loja no Vercel funcionar: backend precisa estar público (hoje localhost). Ordem: Railway backend → pk/URL → envs Vercel.
PRÓXIMO (usuário, guiado): Railway (Postgres + serviço do repo, root /, vars, deploy, migrate/admin/seed, pk) → Vercel storefront (root apps/storefront + envs) → Vercel cockpit → CORS finais + webhook WhatsApp.

## 2026-06-15 — Backend Medusa NO AR no Railway 🎉
- URL: https://endearing-enthusiasm-production-775b.up.railway.app (/health 200). Projeto Railway: loyal-abundance.
- Jornada do deploy (lições):
  1. Monorepo: Root Directory do serviço = `apps/backend` (UI) → builda só o backend (sem instalar storefront/cockpit) → resolve OOM/lentidão.
  2. `apps/backend/railway.json`: build `npm run build`; start `cd .medusa/server && npm install --omit=dev && npm run predeploy && npm run start`; healthcheckTimeout 1200.
  3. `NPM_CONFIG_PRODUCTION=false` (build precisa das devDeps: typescript/vite p/ medusa build).
  4. `DISABLE_ADMIN=true` + medusa-config admin.disable (condicional por env) → NÃO builda o painel admin (Vite pesado) → elimina OOM/timeout do build. Cockpit usa a Admin API; admin UI fica off em prod.
  5. Healthcheck 1200s: o start (npm install do .medusa/server + migrate + boot) leva ~20 min nesse builder lento.
  6. Deploy via Railway CLI (`railway up` da raiz; GitHub integration estava com incidente). SSH precisou de chave (ssh-keygen) + registro.
- Pós-deploy (via railway ssh, dentro de .medusa/server): admin `gestor@eclat.local` (senha provisória <senha-definida-no-deploy> — TROCAR depois);
  seed `npx medusa exec ./src/scripts/seed-eclat.js` (.js em prod!) → Brasil/BRL + 8 cat + 2 col + 4 produtos + estoque.
- Publishable key criada via Admin API + vinculada ao sales channel: pk_4062109543120c19e78f92cc7fcd44ce3ceb243c1754fd8b23dc5b51052fafaa (pk NÃO é segredo).
- Store API validada: regions=Brasil/BRL, products count=4.
- Vars Railway: DATABASE_URL (ref Postgres), JWT/COOKIE/MFA, *CORS (=backend URL por ora), MEDUSA_BACKEND_URL, SUPABASE_*, EVOLUTION_*, NPM_CONFIG_PRODUCTION, DISABLE_ADMIN.

## 2026-06-15 — STOREFRONT NO AR no Vercel 🎉
- Loja: https://useeclat.vercel.app (projeto Vercel "eclat-loja", Root Directory apps/storefront, Next.js).
- Envs no Vercel: NEXT_PUBLIC_MEDUSA_BACKEND_URL (Railway), NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY (pk_4062...), NEXT_PUBLIC_DEFAULT_REGION=br, NEXT_PUBLIC_SUPABASE_URL/ANON.
- Validado em produção (curl): /br hero OK; /br/store lista os 4 produtos do backend Railway. Render server-side → CORS não bloqueia browsing.
- Deploy automático: push na main → Vercel rebuilda a loja.
- PENDENTE: validar checkout completo (se CORS for preciso p/ alguma chamada client-side, liberar STORE_CORS/AUTH_CORS no Railway — cuidado: muda env reinicia backend ~15-20min). NEXT_PUBLIC_BASE_URL=https://useeclat.vercel.app (SEO). Cockpit no Vercel. Webhook WhatsApp → backend público.

## 2026-06-15 — ✅ COMPRA DE PONTA A PONTA EM PRODUÇÃO (MARCO)
- Em https://useeclat.vercel.app: navegar → produto → sacola → checkout → endereço → PEDIDO #1 CRIADO (Top Aurora P/Preto, R$154,80) → página "Obrigada! Pedido realizado".
- Valida: storefront(Vercel) ↔ backend(Railway) ↔ Postgres ↔ publishable key ↔ região BRL ↔ pagamento manual ↔ checkout. CORS OK (sem alteração).
- use.ÉCLAT ESTÁ NO AR E VENDENDO. Pendências: Cockpit no Vercel; NEXT_PUBLIC_BASE_URL (SEO); webhook WhatsApp→backend público; polir vitrine (foto hero/CMS); trocar senha admin provisória.

## 2026-06-15 — COCKPIT NO AR no Vercel 🎉
- Cockpit: https://eclat-cockpit.vercel.app (projeto Vercel "eclat-cockpit", Root Directory apps/cockpit, Next.js). Login 200, raiz 307 (middleware ok).
- Envs no Vercel (colar .env no campo Key parseia tudo): Supabase URL/ANON/SERVICE_ROLE, MEDUSA_ADMIN_URL=Railway, MEDUSA_ADMIN_EMAIL=gestor@eclat.local, MEDUSA_ADMIN_PASSWORD, EVOLUTION_*, GEMINI.
- Login UNIFICADO: criado usuário Supabase Auth gestor@eclat.local (mesmo do Medusa admin) → uma credencial só pro operador. Senha redigida do progress.md (vive só em env). ROTACIONAR pós-launch.
- PILHA 100% NO AR: Loja (useeclat.vercel.app) + Backend (Railway) + Cockpit (eclat-cockpit.vercel.app) + Postgres + Supabase.
- Pendências: validar cockpit logado; webhook WhatsApp Evolution → backend público (adeus túnel); NEXT_PUBLIC_BASE_URL; polir vitrine (foto hero via Cockpit/Vitrine); rotacionar chaves expostas; excluir projeto Vercel errado "eclat-backend".

## 2026-06-16 — ✅ SISTEMA COMPLETO NO AR E INTEGRADO (MARCO FINAL DO DEPLOY)
- Cockpit (eclat-cockpit.vercel.app) logado com gestor@eclat.local: 3 conexões VERDES (Medusa 4 produtos / Supabase / Evolution open).
- Pedido #1 (R$154,80, autorizado, a enviar) feito na loja aparece no Cockpit → Pedidos. Ciclo loja→backend→cockpit fechado.
- Fix do "fetch failed": MEDUSA_ADMIN_URL no Vercel estava localhost; corrigido p/ URL do Railway + REDEPLOY (env só aplica após redeploy).
- STACK PRODUÇÃO: Loja useeclat.vercel.app | Cockpit eclat-cockpit.vercel.app | Backend+Postgres Railway | Supabase | Evolution.
- Pendências (não bloqueiam venda): webhook WhatsApp→backend público; foto hero/vitrine via Cockpit; rotacionar chaves; excluir projeto Vercel "eclat-backend".

## 2026-07-24 — SEO/GEO Fase 1 (fundação técnica) ✅
- Roadmap GEO aprovado (Opção A: manter stack Medusa+Next e evoluir). Fase 1 executada no storefront:
  1. getBaseURL robusto: NEXT_PUBLIC_BASE_URL > VERCEL_PROJECT_PRODUCTION_URL > localhost (src/lib/util/env.ts). .env.local dev corrigido p/ http://localhost:8000.
  2. Canonical + og:url em TODAS as páginas públicas (home, produto, categoria [antes quebrado], coleção, store).
  3. Meta description real do produto (1ª linha da description, ~160c) em vez do título repetido.
  4. H1 na página de produto (era h2); Store traduzida ("Loja"/"Todos os produtos" — era "Store"/"All products").
  5. next/image otimização LIGADA (removido unoptimized:true; AVIF/WebP) — LCP.
  6. Alt texts pt-BR com nome do produto (galeria + Thumbnail c/ prop alt).
  7. JSON-LD: availability real por estoque das variantes (antes hardcoded InStock) + novo ItemList nas listagens (paginated-products).
  8. sitemap.ts paginado (catálogo inteiro, sem teto de 100); next-sitemap.js órfão REMOVIDO.
  9. Redirect / → /br agora 308 permanente (era 307); twitter:card + og:site_name no layout raiz.
- VALIDADO em dev contra backend Railway de produção: / 308→/br; canonical/og/H1/ItemList/sitemap(19 urls)/availability OK; /_next/image ativo.
- ⚠️ PENDENTE (ação manual Vercel, projeto eclat-loja): setar NEXT_PUBLIC_BASE_URL=https://www.useeclat.com.br + REDEPLOY (env só aplica após redeploy). Sem isso há fallback p/ VERCEL_PROJECT_PRODUCTION_URL (deve resolver p/ domínio custom, mas a env explícita é o correto).
- Próximo (Fase 2 GEO): feed Google Merchant Center + GSC; Bing Webmaster + IndexNow + MS Merchant Center; feed formato OpenAI (ACP). Fase 3: páginas institucionais + editorial (CMS Supabase via Cockpit).

## 2026-07-24 — SEO/GEO Fase 2 (feeds & registros) ✅ + fix títulos
- feed.xml REESCRITO nível variante (Google Merchant spec): item_group_id, g:size/g:color (opções Tamanho/Cor), availability real por estoque, additional_image_link, product_type (categorias), catálogo paginado inteiro. Fonte única em lib/util/feed-data.ts (mesma regra de estoque do JSON-LD). Serve Google + Microsoft/Bing + Meta.
- NOVO /openai-feed.json: feed JSON formato OpenAI Product Feed/ACP (enable_search:true, enable_checkout:false) p/ aplicar em developers.openai.com/commerce.
- NOVO IndexNow (Bing/Copilot): chave pública em /b513bfa6acd53fb1d42216ee643ff524.txt + ping GET /api/seo/indexnow (submete URLs do sitemap; chamar após publicar produto).
- FIX: títulos duplicados ("· use.ÉCLAT" 2x) — home usa title absolute; produto/categoria/coleção title puro (template do layout acrescenta a marca).
- Cockpit → GEO: seção "Cadastros (uma vez)" com passo-a-passo GSC, Google Merchant (listagens gratuitas), Bing Webmaster, MS Merchant Center, OpenAI merchants, Meta Commerce.
- ⚠️ FEEDS SAEM VAZIOS até os produtos terem IMAGEM (thumbnail null no seed — GMC exige image_link; código pula produto sem foto). Popula sozinho ao cadastrar fotos reais (pendência Parte 1).
- ⚠️ Deploy Vercel do commit aba30c6 (Fase 1) NÃO apareceu em produção (site ainda 307/sem canonical ~19:10). CLI vercel local logado em conta errada (parisdecor). VERIFICAR painel Vercel do projeto eclat-loja (build falhou? auto-deploy desligado?).

## 2026-07-24 — DEPLOY FASES 1+2 VALIDADO EM PRODUÇÃO ✅
- Causa do deploy travado: "Redeploy of C3xwtjDSo" preso em Building ~30min bloqueava a fila (1 build por vez); usuário cancelou no painel → fila rodou.
- VALIDADO em https://www.useeclat.com.br: / → 308 /br; canonical+og:url com domínio correto (home, produto); título sem duplicação; H1 no produto; JSON-LD availability real; twitter:card; sitemap com domínio de produção; /feed.xml e /openai-feed.json no ar (vazios até produtos terem foto); chave IndexNow servida.
- 1º ping IndexNow disparado: /api/seo/indexnow → {ok:true, submitted:19, status:202} (Bing/Copilot notificado).
- Restante do roadmap: Fase 2 cadastros manuais (painel GEO do Cockpit tem o passo-a-passo) + Fase 3 (institucionais/editorial) + fotos reais dos produtos (destravam os feeds).

## 2026-07-24 — SEO/GEO Fase 3 (institucionais + editorial) ✅
- Migration 0007_editorial.sql APLICADA no Supabase (editorial_post, RLS anon=só published). SOP: architecture/editorial.md.
- Vitrine: /br/sobre, /br/trocas-e-devolucoes, /br/guia-de-medidas, /br/privacidade (defaults no código, sobrescrevíveis via site_content page.<id>; JSON-LD WebPage/AboutPage + Breadcrumb; rota dinâmica [institutionalSlug]).
- Vitrine: /br/editorial (lista) + /br/editorial/[slug] (artigo com schema Article, OG type article, capa). Markdown próprio sem dependência (modules/content/markdown.tsx). Footer com links institucionais+editorial. Sitemap inclui tudo.
- Cockpit: menu "Editorial (artigos)" — CRUD completo (rascunho/publicar, slug automático, tags, capa por URL) via /api/editorial (service_role).
- 1º artigo PUBLICADO no banco: "Como escolher o tamanho ideal de legging (sem errar)" (slug como-escolher-tamanho-legging). Ajuste: removida promessa de política não aprovada ("primeira troca por nossa conta").
- VALIDADO em dev (backend produção): 5 páginas com title/canonical/H1; 404 p/ slug desconhecido; artigo com Article JSON-LD + markdown (h2/listas/links internos); listagem e sitemap revalidam em ~60s.
- Publicação na loja: aparece após o deploy deste commit na Vercel.

## 2026-07-24 — 🐛 BUG CRÍTICO ACHADO E CORRIGIDO: "esgotado" / botão de compra morto
- Relatório do gestor de tráfego (Eclat-Relatorio-Implantacao.pdf) apontou prioridade máxima: loja mostra produtos esgotados (venda impossível). Investigação profunda (browser + RSC payload + streaming markers):
- CAUSA-RAIZ: ConsentDefault e GtmHead renderizados como filhos diretos de <html> no layout raiz (fora de <head>/<body>). <script>/<meta> filho de <html> = HTML inválido → ERRO DE HIDRATAÇÃO do React → a subárvore do ProductActions ficava órfã/desidratada → botão preso no fallback "Out of stock" para TODO cliente, mesmo com estoque 99 na API. (Erros visíveis no console: "In HTML, <script> cannot be a child of <html>. This will cause a hydration error.")
- FIX: (1) ConsentDefault virou <script> inline puro no TOPO do <body> (ordem garantida antes do GTM afterInteractive); (2) GtmHead (GTM) movido p/ dentro do <body>; (3) verificação GSC movida p/ Metadata API (generateMetadata.verification.google no layout raiz); (4) sw.js NÃO intercepta mais navegações/documentos (HTML streamado + cache = risco de cópia truncada sem scripts de conclusão) e cache renomeado eclat-v2 p/ purgar antigos.
- Evidências: DOM válido pós-fix (html → só HEAD+BODY); HTML de produção contém os 3 $RC (server streaming OK — o problema era só client-side na hidratação).
- LIÇÃO (SOP): scripts/metas NUNCA como filhos diretos de <html> em App Router; SW nunca intercepta document/navigate.
- VALIDAR pós-deploy num navegador real: abrir produto, escolher Tamanho+Cor → botão deve virar "Adicionar à sacola" habilitado.
- Obs. teste local: o painel de browser do agente não composita frames (rAF não dispara) → reveal/hidratação de Suspense não roda ali; não confundir com o bug.

## 2026-07-27 — Painel "Custos de Coleção" no Cockpit ✅ (+ design da Coleção 01 via IA)
- DESIGN (Higgsfield/nano-banana, docs/design/): Conjunto 01 APROVADO (blusa off-white costas fechadas + flare com vivos Ramatex Licor 8316 #D5823E amostrado do tecido real) + 4 opções de macacão flare (A quadrado/B half-zip/C halter/D manga longa) com frentes e costas A/C. Logo extraído do PDF em docs/design/brand/.
- CUSTOS: migration 0008 (costing_piece + costing_item BOM, centavos, RLS anon negado) APLICADA. APIs /api/costing[...]. Tela /custos: lista por coleção, ficha com BOM editável, facção/estampa/modelagem diluída/perda%, custo industrial ao vivo, simulador de preço (imposto/taxa/CAC % + markup, margem com semáforo ≥55% verde) e botão "Aplicar como COGS" → POST /api/costs (produto_custo → DRE). Sidebar: "Custos de Coleção".
- Seed: 3 fichas da Coleção 01 (blusa, calça, macacão) com BOM placeholder — preencher preços reais (cotação facção + Ramatex).

## 2026-07-27 — Custos: convenção de MODELAGEM definida (Opção 1)
- DECISÃO (usuário): modelagem NÃO entra no COGS da peça — é despesa de desenvolvimento. Lançar em Financeiro → Despesas, categoria "Desenvolvimento de coleção" (criada no Supabase). Campo modelagem na ficha = só simulação de viabilidade; zerar antes de aplicar COGS.
- Painel /custos: aviso na página com a convenção; confirm() de dupla contagem ao aplicar COGS com modelagem > 0; botão "duplicar" (variação nova cor/tecido herda BOM e parâmetros com modelagem zerada — molde reaproveitado).

## 2026-07-27 — Custos v2: estrutura MODELO × COLEÇÃO (aprovada) + Família Blackout cadastrada
- Migration 0009 APLICADA: costing_collection (parâmetros padrão por coleção), costing_model (catálogo com FOTO), costing_piece + collection_id/model_id/colorway/foto.
- Tela /custos reorganizada: seletor de coleção + parâmetros editáveis da coleção; "Nova coleção" (com opção de copiar todas as peças da atual, modelagem zerada); "Adicionar modelo à coleção" (catálogo ou novo; herda BOM da ficha mais recente do modelo); lista de peças com MINIATURA; ficha com foto/modelo/colorway.
- APIs novas: /api/costing-collections[/id], /api/costing-models; POST /api/costing herda parâmetros da coleção.
- SEED da prancha real "FAMILIA BLACKOUT VERDE EXERCITO E LICOR.pdf": 8 modelos recortados da prancha com foto no Storage (bucket site/costing/) + 9 fichas (Macaquinho Prisma em 2 colorways) com BOM placeholder. Coleção 01 religada (3 fichas → modelos Blusa ML/Calça Flare/Macacão com fotos dos renders).

## 2026-07-27 — ✨ MINHA ÉCLAT (modo wizard) — MVP COMPLETO
- Feature aprovada pelo usuário (IA personas fixas + modal 1ª visita + MVP completo). SOP: architecture/personalizacao.md.
- Migration 0008 APLICADA: persona + product_persona_media (RLS anon read; escrita service_role).
- Vitrine: wizard 3 passos (modelo → tamanho → estilo) montado no layout main, pulável, abre 2,5s pós-hidratação na 1ª visita; botão "Minha ÉCLAT" no nav reabre; prefs em localStorage+cookie (LGPD: nada no servidor); PDP troca galeria p/ fotos da persona client-side (HTML canônico intacto = SEO preservado) com selo "imagens criadas com IA"; tamanho salvo pré-seleciona a variante.
- Cockpit: menu "Personas (Minha ÉCLAT)" — CRUD personas + fotos por produto×persona (APIs /api/personas*, /api/persona-media).
- Seed: personas Aurora (1,75m veste P) e Íris (1,65m veste G) com avatares IA no Supabase Storage (site/personas/).
- VALIDADO em dev (backend produção): home 200 c/ trigger no nav; PDP 200; tsc limpo nos 2 apps.
- PENDENTE: gerar fotos por persona dos produtos reais quando entrarem (fluxo no SOP); Fase 2 = reordenação por estilo + selo "tem seu tamanho".

## 2026-07-28 — PDP v2 (spec do wireframe) + correção CDC ✅
- Decisão do usuário: OPÇÃO A no conflito 7-vs-30 → home/llms.txt alinhados à política real (7 dias arrependimento CDC + 30 defeito + troca de tamanho via WhatsApp). Corrigido em HOME_DEFAULTS (benefit + FAQ, que alimentam o FAQPage JSON-LD) e llms.txt.
- TRADUÇÃO 100% da PDP: Informações do produto / Envio e trocas / Complete o look (com motivo) / Escolha: {opção} / Esgotado / Adicionar à sacola / "a partir de" só com faixa real de preço (fim do "From" enganoso).
- Botão corrigido: "Escolha as opções" antes da seleção; "Esgotado" só com variante escolhida sem estoque.
- NOVOS COMPONENTES (spec): GuaranteeSeals (selos 7/30/WhatsApp junto ao botão) · SizeGuide (tabela de medidas NA PDP + Dica ÉCLAT, id=medidas) · ProductFaq (accordion <details> nativo + schema FAQPage; perguntas por produto via metadata.faq, fallback padrão) · PdpTestimonials (3 depoimentos da home migrados p/ PDP, SEM nota agregada — decisão do spec) · DsbHero (Dor→Solução→Benefício via metadata dsb_*) · QuemE (é/não é pra você via metadata quem_sim/quem_nao) · NotifyMe (avise-me no esgotado → Supabase avise_me, migration 0009 APLICADA, anon INSERT-only).
- Seed do conteúdo da Legging Resplendor: script pronto em scripts/seed-pdp-legging-resplendor.js — NÃO rodou em produção (senha admin de produção só na Vercel). Alternativa: preencher metadata pela ficha técnica no Cockpit.
- NÃO implementado por decisão comercial pendente (spec marca como proposta): parcelamento/Pix (aguarda Mercado Pago Parte 4), piso de frete grátis + barra (aguarda financeiro), CEP/ETA com data (aguarda Melhor Envio), composição do tecido (aguarda fornecedor), vídeo 8s na galeria (asset).
- Plugins do Claude Code data-engineering e semgrep DESABILITADOS no settings.json a pedido (hooks quebrados travando a sessão); backup do settings criado. Válido a partir da próxima sessão.
- VALIDADO em dev: PDP 200, zero strings em inglês, FAQPage schema presente, selos/medidas/FAQ/depoimentos renderizando, home com texto CDC correto.

## 2026-07-28 — 🛍️ CATÁLOGO REAL NO AR — Família Blackout importada
- Planilha preenchida pelo usuário (8 modelos × 3 cores; tops/shorts R$169, legging R$219, macaquinho R$259; 360 peças).
- scripts/import-lancamento.py EXECUTADO em produção: coleção familia-blackout, categorias Tops/Macaquinhos criadas (Shorts/Leggings reutilizadas), 8 produtos com 12 variantes cada (Cor×Tamanho), estoque no CD Brasil, renders aprovados como foto inicial; 4 seeds DESPUBLICADOS.
- scripts/seed-metadata-blackout.py: DSB + quem-é + FAQ (schema FAQPage) nos 8 produtos, copy adaptado do wireframe por categoria.
- VALIDADO: PDP v2 da legging-vertice no ar com DSB/FAQ/selos; FEED GMC populou pela 1ª vez (96 itens). Store/sitemap aguardando redeploy (cache estático).
- PENDENTE: fotos por cor + personas Aurora/Íris (Higgsfield desconectado nesta sessão — reconectar o conector); composição do tecido nas fichas.

## 2026-09-07 — Fase 1 (navegação por tipo de peça): dados + Cockpit ✅
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md · Plano: docs/superpowers/plans/2026-09-07-fase1-dados-catalogo-cockpit.md
- Árvore final de categorias aplicada em produção (setup-categorias.py). Nomes: Top/Short/Legging/Macaquinho / Macacão/Conjuntos/Acessórios/Masculino (7 raízes ativas + 4 filhas). Raízes legadas `treino`/`casual` e as 4 filhas de `casual` foram DESATIVADAS (não deletadas).
- Cockpit: categorias com ordem+capa+descrição; validação Tamanho/Cor na criação; Vitrine → Cores e → Medidas; Fotos por cor no editor; campo Ordem em Destaques.
- Vitrine: utilitários availability/colors/measurements (Vitest) + leitura de site_content.cores/medidas + metadata/rank nas categorias. Nada visível ainda (F2–F4).
- Seed de cores/medidas aplicado (site_content.cores = Blackout/Licor/Verde Exercito, hex a preencher; site_content.medidas = 4 tabelas feminino). check-catalog-options.py: 0 produto(s) com pendências.
- PENDENTE (fora do código): hex das cores (Vitrine → Cores) e fotos reais por cor (os 8 produtos da Família Blackout hoje só têm o render inicial vinculado às variantes, não fotos distintas por cor — a auditoria não aponta erro porque cada variante já tem ≥1 imagem, mas o conteúdo ainda precisa ser substituído pelo dono).
- PENDENTE (validação de tela) — telas do Cockpit não puderam ser validadas em navegador nesta sessão (login Supabase exige o dono): Produtos → Categorias → editar (capa/descrição/ordem); Produtos → Novo produto (validação Tamanho/Cor); Produtos → editar → Fotos por cor; Vitrine → Cores; Vitrine → Medidas; Produtos → editar → Ordem em Destaques.
- Conhecido: `npm run lint` no Cockpit está quebrado por conflito de dependência `ajv`/`eslintrc` pré-existente (não introduzido por esta fase).

## 2026-09-08 — Fase 2 (listagem, filtros, card): documentação + critérios de aceite ✅
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md · SOP: architecture/catalog.md (seção "Listagem (Fase 2)").
- Entrou (Tasks 1–8, branch feat/fase2-listagem-filtros-card): pipeline em memória `listProductsFiltered` (teto de 100) + facetas/ordenação/paginação puras; params de URL em pt-BR (`tamanho,cor,preco,disponivel,ordenar,pagina`) com redirect 308 do legado `sortBy`/`page`; `ProductListing` como ponto único (painel desktop + gaveta mobile + chips + contador + estado vazio) para `/store`, categorias e coleções; cabeçalho de categoria com filhas/irmãs; card com swatches, segunda foto no hover, selos, adição rápida por tamanho, toast; eventos `view_item_list`/`select_item`/`add_to_cart`/`filter_apply`.
- CRITÉRIOS DE ACEITE (spec §14, itens 2–5 e 10) — validados em dev (`COMING_SOON_BYPASS=1` + backend de produção Railway), navegador automatizado:
  - Item 2 — `/br/categories/leggings?tamanho=G&cor=Verde%20Exercito`: PASSOU. Só a Legging Vertice (única com G+Verde Exercito disponível na mesma variante); chips "Tamanho G" e "Verde Exercito" ativos; contador "1 peça"; `<link rel="canonical" href=".../categories/leggings">` sem query; `<meta name="robots" content="noindex, follow">` presente. Confirmado também que `?pagina=2` gera noindex e que a listagem sem filtro (`/store`) não tem robots override (indexável).
  - Item 3 — gaveta mobile (375×812): PASSOU parcialmente. Abre (botão "Filtrar" → Dialog Headless UI monta, `data-headlessui-state="open"`); aplica (clique num swatch de cor atualiza URL/contador/grade imediatamente, sem precisar fechar a gaveta); grade atualiza (chip + contador refletem o novo filtro). "Fecha": o clique em "×"/"Ver N peças" dispara corretamente a transição de saída (classe `opacity-0` aplicada ao backdrop, confirmando que `setOpen(false)` foi executado), mas o desmonte final não pôde ser observado neste ambiente de teste — o painel de browser do agente não composita frames (mesma limitação já registrada em 2026-07-24: "rAF não dispara"), então a transição CSS nunca completa visualmente aqui. Não é um bug de código; precisa de confirmação humana num navegador real.
  - Item 4 — `?cor=Roxo`: PASSOU. Estado vazio ("Nenhuma peça em cor Roxo.") com as 3 ações (Ver em outras cores / Limpar filtros / Ver novidades); "Ver em outras cores" tem `href` sem `cor` mas preservando os demais filtros ativos (testado com `tamanho=G&cor=Roxo` → link vai para `?tamanho=G`).
  - Item 5 — card: PASSOU. Swatch troca `alt`/estado da foto ativa (imagem em si ainda é o mesmo render para todas as cores do mesmo produto — pendência de fotos por cor reais, já conhecida); hover na segunda foto confirmado por código (CSS `group-hover:opacity-100`, mecanismo correto, não visível neste ambiente sem compositing); adição rápida do tamanho "M" chamou `addToCart` com a variante certa (contagem da sacola 4→5, `add_to_cart` no dataLayer com `item_variant: "Verde Exercito / M"`) e no mobile mostra toast "Ver sacola"; no desktop o dropdown de sacola (`CartDropdown`, componente pré-existente ao Fase 2) não abriu automaticamente neste ambiente pela mesma limitação de compositing, mas a atualização de estado do carrinho foi confirmada; tamanho esgotado (GG, em todos os 8 produtos testados) aparece `disabled` + `line-through`.
  - Item 10 — dataLayer: PASSOU. Confirmados `view_item_list` (com `item_list_name`), `select_item`, `add_to_cart`, `filter_apply` (com `filter_type`/`filter_value`) disparando corretamente. `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit`: limpos. `npm test --workspace=apps/storefront`: 59/59. `npm test --workspace=apps/cockpit`: 19/19.
  - Home (`/br`): checada à parte (não é item numerado da spec). Console sem erros de aplicação (só um `[error] An unknown error occurred when fetching the script.` genérico, provável script de terceiro/GTM bloqueado no ambiente de teste, não rastreado a nenhum módulo do Fase 2). O bloco `FeaturedProducts`/`ProductRail` (destaque da home, `aspect-[11/14]` quando `isFeatured`) **não renderizou** — nenhuma requisição a `/store/products` para a coleção em destaque; por leitura de código, `isVisible(home.featured)` só é `false` se o `site_content` tiver `visible:false` explícito (default é visível) — indica configuração de conteúdo (Cockpit → Vitrine, tabela `site_content`) e não uma regressão do card/aspect (verificado por leitura: `ProductPreview`/`ProductCard` aplicam `aspect-[11/14]` corretamente quando `isFeatured=true`). Fica como pendência de verificação de conteúdo, não de código.
- LIMPEZA (spec §13): `grep -rn "instantsearch|from \"pg\"|require(\"pg\")" apps/storefront/src` vazio → removidos `pg`, `@types/pg`, `@types/react-instantsearch-dom` de `apps/storefront/package.json` (`npm uninstall ... --workspace=apps/storefront`, 19 pacotes removidos, `package-lock.json` atualizado). tsc e testes re-confirmados limpos/verdes após a remoção.
- PENDÊNCIAS (fora do código, registradas para o dono): hex das cores em `site_content.cores` (Cockpit → Vitrine → Cores, ainda vazio); fotos reais por cor (hoje todas as cores de um produto compartilham o mesmo render); "Mais vendidos" fora do escopo por falta de dado de vendas; pré-filtro de tamanho pelo wizard "Minha ÉCLAT" na listagem (F5, wizard→tamanho salvo ainda não aplica chip/filtro em `/categories`); singular do contador ("1 peça") já correto no `listing-toolbar`/`filter-drawer`, mas não auditado em outros pontos da UI; `Dialog` do Headless UI sem `DialogTitle` explícito (a11y, pré-existente); helper `selected` duplicado entre o form e o hook de preço (achado em fases anteriores, não deste task); `image_url` da capa de categoria sem validação de tipo; bloco "Compre por peça" da home (spec §14.9) e demais itens 1/6/7/8/9 seguem fora do escopo (fases futuras F3–F5).
- Gaveta de filtros (mobile): o rótulo "Ver N peças" vem do último render do servidor; pode atrasar enquanto a gaveta fica aberta e os filtros estreitam o resultado — não verificado com filtro que reduz a lista com a gaveta aberta (concern da Task 5).

## 2026-09-08 — Fase 3 (PDP): documentação e critérios de aceite ✅
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md (§8, §14 itens 6 e 10) · SOP: architecture/catalog.md (seção "PDP (Fase 3)").
- Entrou (Tasks 1–6, branch feat/fase3-pdp, HEAD 847f323): contexto de seleção por produto (`product-selection`, remonta com `key={product.id}`, wizard aplica tamanho salvo só depois de hidratar, produto de variante única pré-selecionado) + módulo puro `lib/util/pdp-variants.ts`; seletores de cor/tamanho com riscado+"Avise-me" por variante e ordem P→GG fixa; `NotifyMe` grava em `avise_me` (RLS anon INSERT-only) com `variant`="Cor / Tamanho", limpando ao trocar qualquer seleção; `?v_id` por `history.replaceState` (só quando a seleção fica completa, sem navegação de documento); galeria por cor (`variant-gallery`/`image-gallery`, mesma regra `imagesForColor` no SSR e no client, carrossel com snap no mobile, reseta ao trocar a lista de fotos) com precedência das fotos de persona do wizard; guia de medidas por categoria via `getCategoryPath` (handles flat do Medusa, sobe por `parent_category_id`) + `pickMeasurements`; breadcrumb como fonte única do nav visível e do `BreadcrumbJsonLd`; relacionados "Mais {categoria}" (cor do produto primeiro, depois novidades, máx. 8); abas da PDP traduzidas; `listProducts` passa a pedir `*categories`.
- CRITÉRIOS DE ACEITE (spec §14, itens 6 e 10, escopo PDP) — validados em dev (`COMING_SOON_BYPASS=1` + backend de produção Railway) na Legging Vertice (`/br/products/legging-vertice`):
  - Item 6 — PASSOU. Trocar a cor (Verde Exercito) atualiza o estado/galeria sem reload; a URL só ganha `?v_id=variant_...` quando a seleção fica completa (cor+tamanho), via `history.replaceState` — confirmado sem nenhuma requisição de documento nova no request log da navegação (só a 1ª carga da página fez `GET /br/products/legging-vertice`). Tamanho GG (esgotado em Verde Exercito) aparece `disabled` com botão "Avise-me" ao lado; clicar nele abre o bloco com o texto "Esgotou em Verde Exercito / GG — mas volta. Quer ser avisada primeiro?" (rótulo "Cor / Tamanho" correto); o formulário NÃO foi submetido (botão "Quero ser avisada" fica desabilitado sem e-mail/WhatsApp preenchido) — nenhuma escrita feita no Supabase. Guia de medidas da legging mostra só CINTURA e QUADRIL (sem Busto). Breadcrumb visível "Início › Legging › Legging Vertice" idêntico ao único `BreadcrumbList` do JSON-LD da página (conferido via `document.querySelectorAll('script[type="application/ld+json"]')` — 5 blocos no total: Organization, WebSite, Product, BreadcrumbList ×1, FAQPage). `grep -rn -E "Fast delivery|Simple exchanges|Easy returns|Weight|Dimensions|\bType\b" apps/storefront/src/modules/products`: só 1 ocorrência, `"Content-Type": "application/json"` (header HTTP em `notify-me/index.tsx`, não é copy visível — não é o bug que o item cobre). Selecionar Cor Verde Exercito + Tamanho M e clicar "Adicionar à sacola" disparou `add_to_cart` no `dataLayer` via `pushEcommerceEvent` (`{item_id:"ECL-LV-VEX-M", price:219, quantity:1}`, `ecommerce.value:219`, `currency:"BRL"`) e "Sacola com 1 item(ns)" atualizou no header — confirma o helper único da Fase 2 também cobre a PDP.
  - Item 10 — PASSOU. `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit`: limpos. `npm test --workspace=apps/storefront`: 76/76. `npm test --workspace=apps/cockpit`: 19/19.
  - Home (`/br`) e listagem (`/br/store`): checadas à parte (mudança em `listProducts` para `*categories` toca toda listagem) — sem erros de console em nenhuma das duas.
- LIMITAÇÃO DE FERRAMENTA (não é bug do app): o painel de browser padrão do agente (`mcp__Claude_Browser`) tem um teto fixo de conexões simultâneas (~20) que o bundle de desenvolvimento do Turbopack estoura já na 1ª carga de qualquer página (17–19 requisições concluem, as seguintes — incluindo o chunk da própria página — falham com `net::ERR_FAILED`, deterministicamente, nos mesmos arquivos, em toda tentativa, com servidor em Turbopack OU webpack) — quebra a hidratação e cai no `global-error` do Next ("Application error"). O servidor (SSR) respondia 200 o tempo todo; o problema é só do transporte de rede do painel, não do código. Confirmado ao trocar para `mcp__plugin_chrome-devtools-mcp` (CDP direto), que carregou/hidratou normalmente e permitiu toda a validação interativa acima. Registrar para sessões futuras: preferir chrome-devtools-mcp (ou Playwright) para aceite de páginas com App Router + Turbopack dev nesta máquina.
- PENDÊNCIAS (fora do código, registradas para o dono): zoom/vídeo/thumbnails na galeria (fora de escopo da spec); parcelamento e CEP na PDP (aguardam Mercado Pago/Melhor Envio); avaliações reais (depoimentos continuam fixos, sem nota agregada — decisão de 2026-07-28); "Complete o conjunto" (spec 2, ainda não escrita, hoje a PDP não tem esse bloco); fotos reais por cor (cada variante da Família Blackout já tem imagem vinculada, mas as 3 cores de um produto hoje compartilham o mesmo render — trocar o swatch de cor não troca a foto visivelmente ainda); hex das cores em `site_content.cores` (Cockpit → Vitrine → Cores, ainda vazio); ~~aviso do Next `images.qualities`~~ RESOLVIDO — `apps/storefront/next.config.js` já declara `images.qualities: [50, 75, 80]`; pendência estava desatualizada.

## 2026-09-08 — Fase 4 (navegação por tipo de peça, menu mobile, home, breadcrumb): documentação e critérios de aceite ✅
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md (§5, §14 itens 1 e 9) · SOP: architecture/catalog.md (seção "Navegação (Fase 4)").
- Entrou (Tasks 1–5, branch feat/fase4-navegacao-home, HEAD bebd9df): árvore única `buildNavData`/`getNavigation` (`lib/util/navigation.ts` + `lib/data/navigation.ts`, uma busca ≤100 produtos, nunca lança); barra desktop `category-bar` (Novidades · raízes por rank · Coleções · Ver tudo) com painel de hover/foco (`nav-panel.tsx`: capa+cores nas femininas, filhas nas mães Acessórios/Masculino, capas nas coleções), `layout/components/main-menu/` (morto) removido; menu mobile `side-menu` com miniaturas e acordeão só nas categorias-mãe, bloco "Linhas" removido; bloco "Compre por peça" na home (só femininas, por rank, logo abaixo do hero) + remoção dos defaults Treino/Casual de `home/content.ts` e da vitrine fallback do Cockpit; breadcrumb visível (`ProductListing` ganha prop `breadcrumb`) em `/store`, categorias e coleções, uma fonte só com o `BreadcrumbJsonLd`.
- CRITÉRIOS DE ACEITE (spec §14, itens 1 e 9, parte fixa) — validados em dev (`COMING_SOON_BYPASS=1` + backend de produção Railway), navegador `chrome-devtools-mcp` (CDP direto — ver limitação do painel padrão registrada em 2026-09-08/Fase 3):
  - Item 1 — PASSOU. Barra desktop (1440px) na ordem Novidades · Top · Short · Legging · Macaquinho/Macacão · Coleções · Ver tudo (as 7 raízes da spec existem, mas só as 4 femininas com produto aparecem — Conjuntos/Acessórios/Masculino sem produto publicado ficam fora da barra por design, ver `hasProducts` em `buildNavData`). Hover em "Top" (feminina) abre o painel com capa (moldura vazia — capa ainda não cadastrada no Cockpit, pendência conhecida) + 3 swatches de cor (Blackout/Verde Exercito/Licor) com `href=/categories/tops?cor=<nome>`; clicar no swatch "Verde Exercito" abriu `/br/categories/tops?cor=Verde%20Exercito` com a categoria já filtrada (chip "Verde Exercito" ativo, 3 peças, painel de cor com "Verde Exercito" marcada). Hover em "Coleções" lista "Família Blackout — Verde Exército e Licor" com capa (fallback do primeiro produto, coleção sem `metadata.image_url`). `/br/categories/masculino` (acesso direto por URL, fora da barra): mostra os chips das filhas ("Tudo de Masculino", "Bermudas", "Camisetas / Regatas") e o estado vazio "Nenhuma peça com esses filtros" (0 produto na categoria) — comportamento esperado, registrado como pendência de catálogo (não de código).
  - Menu mobile (390×844): sanduíche abre o painel com Início + as 4 femininas como link direto (miniatura T/S/L/M, ainda sem capa real) + "Coleções" como acordeão (`<details>`) + "Toda a loja"/"Conta"; nenhum bloco "Linhas" presente.
  - Item 9 — PASSOU. Home (`/br`) mostra "Compre por peça" logo abaixo do hero com as 4 categorias femininas visíveis (Top, Short, Legging, Macaquinho/Macacão — Conjuntos fora por falta de produto), por rank. A seção "Nossas linhas" (CMS) continua visível logo abaixo — coexistência esperada, decisão de ocultar fica com o dono (Cockpit → Vitrine). Reordenação por preferência de estilo do wizard é F5, não implementada — registrada como pendência.
  - Breadcrumbs: `/br/store` → "Início › Todos os produtos"; `/br/categories/tops?cor=...` → "Início › Top"; `/br/products/legging-vertice` → "Início › Legging › Legging Vertice" (confirmando a mesma fonte da Fase 3, sem regressão).
  - `grep -rn -i "treino|casual" apps/storefront/src apps/cockpit/app`: **não veio vazio** — CORREÇÃO da contagem abaixo (a registrada nesta entrada em 2026-09-08 estava errada, "12/11+1"): são **14 ocorrências, 13 legítimas** (texto de marketing genérico usando "treino" como sinônimo de exercício/academia — `llms.txt`, `institutional.ts`, `home/content.ts` (caption/depoimento/FAQ "conforto no treino"/pergunta "servem para treino e dia a dia?"), `product-faq`, comentários de `robots.ts` sobre "treino" de IA (AI training, sem relação com as linhas), placeholder de tag no Cockpit, defaults de vitrine do Cockpit em `apps/cockpit/app/(painel)/vitrine/page.tsx` ×2, `apps/cockpit/app/(painel)/editorial/page.tsx` placeholder) + **1 achado real**: `apps/storefront/src/modules/home/content.ts:142` — a resposta da FAQ "As peças servem para treino e para o dia a dia?" ainda dizia *"A linha Treino é focada em performance e a linha Casual no lifestyle"*, citando por nome as duas linhas que foram desativadas (essa FAQ também alimenta o `FAQPage` JSON-LD da home). Não corrigido nesta task (fora do escopo — só documentação, sem tocar `apps/`); registrado como pendência/achado para o dono corrigir o texto da resposta. **Corrigido no fix-wave de revisão de 2026-09-08 (C1, ver entrada abaixo)**: `grep -rn -i "linha treino\|linha casual" apps/storefront/src apps/cockpit/app` agora vazio; `grep -rn -i "treino|casual"` continua com as 14 ocorrências, todas legítimas (0 achados).
  - `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit`: limpos. `npm test --workspace=apps/storefront`: 92/92 (6 novos em `navigation.test.ts`). `npm test --workspace=apps/cockpit`: 19/19. Home/listagem/PDP sem erros no console do navegador.
- PENDÊNCIAS (fora do código, registradas para o dono): reordenação do bloco "Compre por peça" pelo wizard "Minha ÉCLAT" (spec §10, fica para F5, junto com filtro/busca ligados ao wizard); capas de categoria e de coleção a cadastrar (Cockpit → Categorias → editar para categoria; coleção ainda não tem tela no Cockpit para `metadata.image_url` — hoje toda coleção sem capa cai no fallback da 1ª foto de produto); `conjuntos` some da barra/painel/"Compre por peça" até ter produto publicado (spec 2, Benefício Conjunto, ainda não escrita); Acessórios e Masculino ficam fora da barra/menu/home/rodapé até terem ao menos 1 produto publicado (hoje só existem como categoria vazia, acessível só por URL direta — desde o fix-wave de 2026-09-08 o rodapé também usa `getNavigation`/`nav.roots`, então parou de listar categoria vazia, achado I8); ~~resposta da FAQ da home com "linha Treino"/"linha Casual" (achado do grep acima, texto a corrigir)~~ CORRIGIDO no fix-wave de 2026-09-08 (C1).

## 2026-09-08 — Fase 5 (busca com sugestões, /busca no pipeline, wizard → listagem/home)
- Spec: docs/superpowers/specs/2026-09-07-navegacao-tipo-de-peca-design.md (§9, §10, §11, §14 itens 7/8/9/10) · Plano: docs/superpowers/plans/2026-09-08-fase5-busca-wizard.md · SOP: architecture/catalog.md (seção "Busca + Wizard (Fase 5)").
- Entrou (Tasks 1–6, branch feat/fase5-busca-wizard, HEAD 2ead3de antes desta task): `lib/util/search-synonyms.ts` (mapa fixo + `normalizeTerm`/`synonymCategoryHandle`, testado), `lib/util/search-suggest.ts` (`buildSuggestions` puro sobre `NavData`, `ProductHit`/`Suggestions`, testado); `lib/data/search.ts` (`suggestProducts`, `server-only`, Store API `q`, nunca lança, chamada pela Route Handler `app/api/busca/sugestoes/route.ts`); `modules/layout/components/search-bar/index.tsx` (dropdown categorias/cores/produtos, `GET /api/busca/sugestoes` com debounce 200 ms e `AbortController`, evento `search_suggestion_click`, DOM input→dropdown→botão) + `modules/layout/templates/nav/index.tsx` (duas instâncias, `nav` passado); `lib/data/products.ts` (`ListingScope.q`), `app/[countryCode]/(main)/busca/page.tsx` (pipeline de listagem + redirect de sinônimo), `store/templates/product-listing.tsx` (prop `query`), `filters/empty-results.tsx`; `lib/util/prefs-cookie.ts` (`EclatPrefs`, `parsePrefsCookie`, `applyPreferredSize`, testado), `lib/data/prefs.ts` (`getServerPrefs`, `resolveListingFilters`), `lib/util/catalog-filters.ts` (`explicitFilters`, `shouldOptOut`, `listingHref(pathname, next, optOut, keepQ)`, testado), `filters/listing-transition.tsx` (`implicitSize` no contexto), `filters/use-filter-navigation.ts`, `filters/active-chips.tsx` (chip "Seu tamanho: M"), as quatro páginas/templates de listagem; `lib/util/style-order.ts` (`orderByStyles`, `STYLE_HANDLES`, testado), `home/components/shop-by-category/index.tsx` (lê `getServerPrefs`, reordena `nav.feminine`), `personalization/wizard.tsx` (estilo "Shorts" adicionado ao array `ESTILOS`, `router.refresh()` em `close`/`finish`).
- CRITÉRIOS DE ACEITE (spec §14, itens 7/8/9 e parte de 10) — validados em dev (`COMING_SOON_BYPASS=1` + backend de produção Railway), navegador `mcp__plugin_chrome-devtools-mcp` (CDP direto):
  - Item 7 — PASSOU. Home (`/br`), campo de busca desktop: digitar "verde" abre o dropdown com "CORES → Verde Exercito em Top, Short, Legging, Macaquinho / Macacão" (link de cada categoria já com `?cor=Verde%20Exercito`) e "PEÇAS" com 5 produtos (Top Radiance, Top Lumina, Top Prisma, Shorts Radiance, Shorts Lumina) — nenhuma seção "Categorias" porque nenhum nome de categoria contém "verde" (comportamento esperado: cor aparece via agrupamento de cor, não como categoria). Digitar "calça" + Enter: `window.location.href` foi para `http://localhost:8000/br/categories/leggings` (redirect 307 por sinônimo, ruling 2).
  - Item 8 — PASSOU. Cookie `eclat_prefs={"tamanho":"M","estilos":["macacao","short"],"wizard_done":true}` setado via `document.cookie`; `/br/categories/tops`: chip "Seu tamanho: M ×" presente (`[data-testid="implicit-size-chip"]`), filtro de tamanho no aside com "M(3)" `pressed`, contador "3 peças" (grade já filtrada pelo tamanho preferido, sem a cliente tocar em nada). Clicar no × da chip: `window.location.href` virou `http://localhost:8000/br/categories/tops?tamanho=` (opt-out, ruling 3), chip some (`querySelector` retorna `null`), nenhum botão de tamanho no aside fica `pressed` — grade volta a mostrar todos os tops (que também totalizam 3 peças no catálogo atual, coincidência de contagem, não de filtro).
  - Item 9 — PASSOU. Home (`/br`) com o mesmo cookie (`estilos:["macacao","short"]`): "Compre por peça" mostrou **Short, Macaquinho/Macacão, Top, Legging** — os dois estilos escolhidos (`macacao`→`macaquinhos`, `short`→`shorts`) foram para o topo, preservando a ordem relativa entre si e entre os dois que ficaram para trás; as 4 categorias femininas continuam todas visíveis (nada some). Nota: a leitura anterior `[Legging,Top,Short,Macaquinho]` foi artefato do teste — cookie `eclat_prefs` com `estilos:["legging"]` deixado pelo passo anterior do wizard na mesma sessão; é exatamente o resultado de `orderByStyles` com esse cookie. `buildNavData`/`byRank` é determinístico (rank, depois nome pt-BR); a ordem-base sem cookie é `[Top,Short,Legging,Macaquinho]`.
  - Item 10 (parte variável) — PASSOU. `dataLayer` limpo, clique em "Top Radiance" no dropdown da busca (termo "verde") gerou `{"event":"search_suggestion_click","suggestion_type":"produto","suggestion_value":"top-radiance","search_term":"verde"}`. `npx tsc -p apps/storefront --noEmit` e `npx tsc -p apps/cockpit --noEmit`: limpos.
  - `grep -rn -i "linha treino\|linha casual" apps/storefront/src apps/cockpit/app`: vazio (0 ocorrências, sem regressão do achado corrigido na Fase 4). `grep -n "Search\|Results" apps/storefront/src/modules/layout/components/search-bar/index.tsx`: 1 ocorrência — `export default function SearchBar(...)` (nome do componente/identificador TypeScript, não string visível pro usuário; nenhum texto em inglês renderizado na busca).
  - `npm test --workspace=apps/storefront`: **118/118** (13 arquivos: os 92 herdados da Fase 4 + 3 arquivos novos — `search-suggest.test.ts` 5, `search-synonyms.test.ts` 4, `style-order.test.ts` 3 — + `prefs-cookie.test.ts` 4 (novo, T4) + 10 testes novos de `explicitFilters`/`shouldOptOut` acrescentados a `catalog-filters.test.ts` (26 no total) — 92+5+4+3+4+10 = 118). `npm test --workspace=apps/cockpit`: **19/19** (sem mudança nesta fase).
- RULINGS DO CONTROLLER (registradas, não reabrir):
  1. "bermuda" **não** vira sinônimo de `shorts` — a spec §9 original previa isso, mas hoje `Bermudas` é categoria real (Masculino); "bermuda" já casa pelo match de nome de categoria. Spec §9 corrigida nesta task.
  2. Redirect por sinônimo só dispara quando a busca **inteira** é um termo do mapa ("calça" → `/categories/leggings`, 307); "calça preta" vai para `/busca?q=calça preta` (sem expansão de termos dentro da frase).
  3. Opt-out do tamanho implícito = `?tamanho=` (param presente, vazio) — `parseFilters` já lê isso como "sem tamanho".
  4. O wizard chama `router.refresh()` ao fechar (pular) ou concluir, para a home reordenar e a listagem mostrar/esconder a chip sem precisar de reload manual.
  5. A home já é renderização dinâmica (`getRegion` lê cookies) — ler `eclat_prefs` em `ShopByCategory` não muda o modo de renderização da página.
  6. Sem evento GA4 `search` (não está na spec §11) — só `search_suggestion_click`, com `suggestion_type`/`suggestion_value`/`search_term`.
  7. **Ações fora de "tamanho" partem da visão sem o tamanho implícito** (`explicitFilters`) — o implícito nunca vira explícito só porque outro filtro mudou. Ordenar/paginar preserva o campo `tamanho` como está → URL sem `tamanho` → o servidor reaplica o preferido → a chip continua. Um filtro explícito novo (cor/preço/disponível) parte do estado sem o implícito → URL só com esse filtro → `hasActiveFilters` fica `true` → o pré-filtro desliga → a chip some (spec §10: só listagens sem filtro explícito nenhum). Remover esse último filtro explícito → URL limpa de novo → chip **volta** — comportamento intencional e reversível, não um limite (refina a redação de "limite conhecido" do plano original — Task 6 documentou com este texto em `architecture/catalog.md`).
- PENDÊNCIAS (fora do código, registradas para o dono): hex das cores em `site_content.cores` continua vazio (Cockpit → Vitrine → Cores) — os swatches de cor no dropdown de busca (`c.hex`) ficam sem cor visível até o dono cadastrar; "Conjuntos" continua fora das sugestões/da home/"Compre por peça" até ter produto publicado (mesma pendência da Fase 4, spec 2 ainda não escrita); os sinônimos de busca são um **mapa fixo** (`SEARCH_SYNONYMS`) — ampliar conforme os termos que aparecerem de verdade nas buscas reais (GA4, quando configurado) em vez de adivinhar; escolher uma cor (ou qualquer filtro explícito) com a chip "Seu tamanho" ativa **tira o tamanho da grade** (a listagem volta a mostrar todos os tamanhos daquela cor) — decisão do spec §10 ("tamanho só em listagem sem filtro nenhum"), documentada como ruling 7 acima; reversível a qualquer momento se o dono preferir manter o tamanho junto com outros filtros.

## 2026-09-08 — F0 Benefício Conjunto: CONCLUÍDA — VAI
- Spec: `docs/superpowers/specs/2026-09-08-beneficio-conjunto-design.md` (§6.1–§6.4, §12) · Plano: `docs/superpowers/plans/2026-09-08-conjunto-f0-prova-de-conceito.md` · Pasta de execução: `.superpowers/sdd/2026-09-08-conjunto-f0-prova-de-conceito/` (briefs + relatórios das 4 tasks) · Branch `feat/conjunto-f0-poc`.
- Entrou (Tasks 1–3, sem tocar produção): harness de integração HTTP com Postgres em Docker (`apps/backend/integration-tests/setup.js`, `helpers/admin.ts`, `helpers/catalogo.ts`, `.env.test`, scripts `test:db:up`/`test:db:down`/`test:integration:http`); gancho de PoC `apps/backend/src/workflows/hooks/conjunto-poc.ts` (`updateCartPromotionsWorkflow.hooks.setPromotionContext`, gated por `env.CONJUNTO_POC`, try/catch com fallback ao contexto original — carrinho nunca quebra); suíte `apps/backend/integration-tests/http/conjunto-poc.spec.ts` (9 testes: A, B, B2, C, D, D2, D3, mais saúde do harness) rodando contra um Medusa real em memória (`medusaIntegrationTestRunner`) e um Postgres de teste isolado (container `eclat-pg-test`, porta 55432, nunca o banco de produção/dev).
- **VAI — decisões registradas na spec (§6.2/§6.3/§6.4/§12), com evidência de HTTP real contra Medusa 2.15.5:** (1) §6.3 — divisão de contexto em duas entradas por linha (K marcadas, N−K não) funciona e generaliza para K intermediário (B = R$ 18,90, B2 = R$ 37,80); fallbacks (a)/(b) descartados. Duas exigências do motor documentadas para a F1: `target_rules[].attribute` de promoção automática precisa do prefixo `items.`, e `application_method.max_quantity` precisa ser alto (`1000`) com `allocation: each`. (2) §6.4 — cupom de itens com a regra `items.conjunto_desconto eq "nenhum"` exclui a unidade em conjunto (caso C, R$ 44,80). Cupom de pedido inteiro (`target_type: order`) não pode ter `target_rules` (Admin API rejeita com 400 — caso D2); a F1 converte qualquer cupom de pedido em cupom de itens (`allocation: across`, **sem `max_quantity`** — combinação `across`+`max_quantity` é rejeitada, §6.2 — + a regra de exclusão) ao criar/atualizar, e o Cockpit só oferece cupom de itens. Payload validado empiricamente (caso D3, revisão final): `PEDIDO10C` aceito de primeira, R$ 25,90 só na legging, `discount_total` R$ 44,80.
- O gancho de PoC (`conjunto-poc.ts`) **fica gated por `CONJUNTO_POC`** (nunca ligado em produção) até a F1 substituí-lo pelo módulo `beneficio-conjunto` real (dados, `montarConjuntos`, gancho definitivo, rotas admin/store — §4–§6 da spec).
- Detalhes completos (comandos, JSON de `adjustments`, leitura de código-fonte do motor de promoções) em `findings.md` ("2026-09-08 — F0 Benefício Conjunto") e nos relatórios de cada task.
- PENDÊNCIAS: nenhuma em produção — nada desta fase foi escrito em ambiente de produção (só Postgres de teste em Docker local). Push do branch é do dono (`git push origin feat/conjunto-f0-poc`), conforme nota de memória do projeto. Próxima ação: F1 Backend (módulo `beneficio-conjunto`, primeira escrita real em produção).
