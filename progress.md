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
