# use.ÉCLAT

Marca premium e **independente** de moda fitness (athleisure da "mulher inteira").
Este repositório é a **Fundação (Parte 0)** do build.

> A constituição do projeto é **lei** e vive em [`CLAUDE.md`](./CLAUDE.md). Leia antes de codar.
> Plano de build: [`task_plan.md`](./task_plan.md) · Pesquisa/constraints: [`findings.md`](./findings.md) · Diário: [`progress.md`](./progress.md)

## Stack
- **Core de loja:** Medusa v2 (Node/TypeScript + PostgreSQL) — `apps/backend`
- **Vitrine:** Next.js 15 (PWA, starter Medusa) — `apps/storefront`
- **Relacionamento:** Supabase (CRM, leads) — _configuração na Fundação, tabelas em fase futura_
- **Pagamento:** Mercado Pago (cartão + Pix) — _fase futura_
- Monorepo **Turborepo** (este repositório é a raiz).

## Pré-requisitos
- Node.js (testado na v24) e npm
- PostgreSQL 17 rodando localmente na porta 5432
  - Serviço Windows: `postgresql-x64-17` · superusuário `postgres` / senha `postgres`
  - Banco da aplicação: `eclat_medusa`

## Setup do zero (após clonar)
```bash
npm install                      # instala deps do monorepo (Turbo)
# configure os .env (veja a seção abaixo) — eles NÃO são versionados
```
Crie o banco e rode migrações/seed:
```bash
# banco
createdb -U postgres -h localhost eclat_medusa
# migrações + seed (a partir de apps/backend)
cd apps/backend && npx medusa db:migrate && npm run seed
# usuário admin
npx medusa user -e admin@eclat.local -p "<sua-senha>"
```

## Como rodar

### Backend (Medusa) — porta 9000
```bash
cd apps/backend
npm run dev
```
- Admin: http://localhost:9000/app
- Health: http://localhost:9000/health
- **Login admin (ambiente local):** `admin@eclat.local`

### Vitrine (Next.js) — porta 8000
```bash
cd apps/storefront
npm run dev
```
- Loja: http://localhost:8000 (lista os produtos de exemplo do Medusa)

> A partir da raiz você também pode usar `npm run backend:dev` e `npm run storefront:dev` (Turbo).

## Variáveis de ambiente

### `apps/backend/.env`
| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Conexão Postgres (`postgres://postgres:postgres@localhost:5432/eclat_medusa`) |
| `JWT_SECRET` / `COOKIE_SECRET` | Segredos do Medusa (trocar em produção) |
| `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | Origens permitidas |
| `SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_ANON_KEY` | Chave pública (anon) do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave secreta (service_role) — **nunca versionar** |

### `apps/storefront/.env.local`
| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_MEDUSA_BACKEND_URL` | URL do backend Medusa (`http://localhost:9000`) |
| `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` | Publishable API key da Store API |
| `NEXT_PUBLIC_DEFAULT_REGION` | Região default (`dk` no seed; trocar para Brasil/BRL na Parte 1) |

> Segredos vivem **apenas** em `.env` / `.env.local` (ignorados pelo git).

## Testar a conexão com o Supabase
Preencha `SUPABASE_*` no `.env` do backend e rode:
```bash
cd apps/backend
node --env-file=.env test-supabase.mjs
```
Valida conectividade (anon + service_role) **sem criar tabelas**.

## Identidade visual (tokens da marca)
Aplicados no storefront (Tailwind):
- Paleta **"luz / resplendor"**: `eclat.luz` (off-white), `eclat.areia`, `eclat.pedra`, `eclat.grafite` (texto), `eclat.dourado` (accent).
- Tipografia: **Inter** (texto, `font-sans`) + **Cormorant Garamond** (títulos, `font-serif`), via `next/font`.

## Dois agentes
- **Claude Code** carrega `CLAUDE.md` automaticamente.
- **Agente Gemini (Antigravity)** lê `gemini.md`, que redireciona para `CLAUDE.md`.
- Fonte única da verdade: **edite apenas `CLAUDE.md`**.
