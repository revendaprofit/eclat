# Editorial & Páginas Institucionais (GEO Fase 3)

## O que é
Camada de conteúdo da vitrine para SEO/GEO: artigos/guias em `/br/editorial/<slug>`
e páginas institucionais (`/br/sobre`, `/br/trocas-e-devolucoes`, `/br/guia-de-medidas`,
`/br/privacidade`). Tudo server-rendered, com canonical, JSON-LD (Article/WebPage/AboutPage)
e presente no sitemap.

## Dados (fonte da verdade: Supabase)
- **Artigos**: tabela `editorial_post` (migration `supabase/migrations/0007_editorial.sql`).
  Campos: slug, title, excerpt, body_md (Markdown), cover_url, tags[], status
  (draft|published), published_at. **RLS**: anon lê SOMENTE published; escrita via service_role.
- **Institucionais**: conteúdo padrão no código
  (`apps/storefront/src/modules/content/institutional.ts`); sobrescrevível pelo Cockpit
  gravando em `site_content` na chave `page.<id>` com `{title, description, body_md}`.
  IDs: sobre, trocas, medidas, privacidade.

## Fluxos
- **Cockpit → Editorial (artigos)**: CRUD em `/editorial` (sidebar). APIs:
  `GET/POST /api/editorial`, `GET/PATCH/DELETE /api/editorial/[id]` (service_role via lib/sb-admin).
  Publicar seta `published_at` na 1ª publicação; voltar a rascunho limpa.
- **Vitrine**: lê via anon com `revalidate: 60` (`src/lib/data/editorial.ts`) — publicações
  aparecem em ~1 min. Markdown renderizado por `src/modules/content/markdown.tsx`
  (## ###, listas "- ", **negrito**, *itálico*, [link](url); sem HTML cru — seguro por construção).
- **Sitemap**: institucionais + artigos publicados entram automaticamente (`src/app/sitemap.ts`).
- Após publicar artigo: abrir `https://www.useeclat.com.br/api/seo/indexnow` (Bing indexa em minutos).

## Regras
- NUNCA inventar política comercial em conteúdo (trocas grátis, brindes, prazos) — o texto
  padrão institucional usa apenas o mínimo legal (CDC: 7 dias arrependimento, 30 dias defeito).
  Alterações de política = editar via Cockpit (site_content `page.trocas`).
- Artigos devem responder perguntas reais de clientes (formato pergunta→resposta = citação por IA).
