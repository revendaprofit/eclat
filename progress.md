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
HALT: revisar/testar a compra no navegador OU avançar (Parte 4 — Pagamento Mercado Pago).
