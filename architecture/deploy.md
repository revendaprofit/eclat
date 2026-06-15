# SOP — Deploy de produção (use.ÉCLAT)

Arquitetura de produção:
- **Backend Medusa** + **Postgres** → **Railway** (servidor long-running; Vercel não serve p/ o backend).
- **Storefront** (loja) e **Cockpit** → **Vercel** (Next.js).
- **Supabase** (relacionamento/financeiro/CMS) e **Evolution** (WhatsApp) já são nuvem.

> ⚠️ Pré-requisito #0: **commit + push de TUDO** pro GitHub (Vercel/Railway buildam do GitHub).
> Antes do commit, escanear segredos (nada de .env). Push abre a janela "Select an account" (ver git-push-gcm-auth).

---

## 1) Railway — Backend + Postgres
1. **Novo projeto** no Railway → **+ New → Database → PostgreSQL** (anota a `DATABASE_URL`).
2. **+ New → GitHub Repo** → escolher `revendaprofit/eclat`.
3. Em **Settings** do serviço:
   - **Root Directory:** `/` (raiz — o `railway.json` na raiz já define build/start cientes do monorepo).
   - Build/Start: já vêm do `railway.json` (build: instala o monorepo + `build --workspace=apps/backend`;
     start: `cd apps/backend/.medusa/server && npm install && npm run predeploy && npm run start`).
   - **Healthcheck:** `/health` (já no railway.json).
4. **Variables** (Settings → Variables) do backend:
   ```
   DATABASE_URL            = (referência ao Postgres do Railway)
   JWT_SECRET              = (gerar aleatório forte)
   COOKIE_SECRET           = (gerar aleatório forte)
   STORE_CORS              = https://<loja>.vercel.app
   ADMIN_CORS              = https://<cockpit>.vercel.app,https://<backend>.up.railway.app
   AUTH_CORS               = https://<loja>.vercel.app,https://<cockpit>.vercel.app,https://<backend>.up.railway.app
   MEDUSA_BACKEND_URL      = https://<backend>.up.railway.app
   # WhatsApp/Supabase (mesmos do .env local):
   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL,
   EVOLUTION_API_URL, EVOLUTION_API_KEY, EVOLUTION_INSTANCE, WHATSAPP_WEBHOOK_SECRET, GEMINI_API_KEY
   ```
5. **Deploy.** O `predeploy` roda as migrações do Medusa automaticamente.
6. **Pós-deploy** (via Railway "Shell" no serviço, dentro de `apps/backend/.medusa/server`):
   - Criar admin: `npx medusa user -e admin@eclat.local -p <senha-forte>`
   - Semear catálogo Brasil/BRL: `npx medusa exec ./src/scripts/seed-eclat.ts`
   - Pegar a **publishable key**: admin → Settings → Publishable API Keys (ou via API). Guardar `pk_...`.

> Caveats monorepo: se o build falhar no install do workspace, ver logs — pode precisar ajustar o buildCommand
> (ex.: `npm ci` vs `npm install`). Storage de imagens de PRODUTO é local (efêmero no Railway): configurar
> depois o file provider S3 apontando p/ o **Supabase Storage** (S3-compatible) p/ persistir uploads do admin.

---

## 2) Vercel — Storefront (loja)
- **Add New → Project** → repo `revendaprofit/eclat`.
- **Root Directory:** `apps/storefront`.
- **Environment Variables:**
  ```
  NEXT_PUBLIC_MEDUSA_BACKEND_URL     = https://<backend>.up.railway.app
  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY = pk_... (do passo 1.6)
  NEXT_PUBLIC_BASE_URL               = https://<loja>.vercel.app
  NEXT_PUBLIC_DEFAULT_REGION         = br
  NEXT_PUBLIC_SUPABASE_URL           = (mesmo do projeto)
  NEXT_PUBLIC_SUPABASE_ANON_KEY      = (mesmo do projeto)
  ```
- Deploy. Depois, voltar no Railway e completar STORE_CORS/AUTH_CORS com o domínio real da Vercel.

## 3) Vercel — Cockpit
- Outro projeto Vercel, **Root Directory:** `apps/cockpit`.
- Variables: as mesmas do `apps/cockpit/.env.local`, com `MEDUSA_ADMIN_URL = https://<backend>.up.railway.app`.
- Proteger o acesso (já tem login Supabase Auth). Adicionar o domínio do cockpit no ADMIN_CORS/AUTH_CORS do backend.

## 4) WhatsApp (Evolution)
- Reapontar o webhook da instância `eclat` para `https://<backend>.up.railway.app/webhooks/whatsapp?secret=...`
  (adeus túnel cloudflared). Ver architecture/whatsapp.md.

## Ordem de execução
1. Commit+push (segredos fora). 2. Railway Postgres+backend → migrate/admin/seed → pk. 3. Vercel loja (envs). 4. Vercel cockpit. 5. CORS finais + webhook WhatsApp.
