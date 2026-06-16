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
