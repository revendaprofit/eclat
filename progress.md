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
Todos os critérios de aceite batidos. HALT: aguardar aprovação para iniciar a Parte 1 — Catálogo (Data-First).
