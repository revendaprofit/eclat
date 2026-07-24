-- 0007_editorial.sql
-- Camada editorial (GEO Fase 3): artigos/guias publicados na vitrine em /editorial.
-- Cockpit escreve via service_role (bypassa RLS); a vitrine LÊ publicamente via anon,
-- mas SOMENTE posts com status 'published' (policy abaixo).

create table if not exists editorial_post (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,          -- url: /br/editorial/<slug>
  title         text not null,
  excerpt       text,                          -- resumo (meta description / card)
  body_md       text not null default '',     -- corpo em Markdown
  cover_url     text,                          -- imagem de capa (Supabase Storage ou URL)
  tags          text[] not null default '{}',
  status        text not null default 'draft' check (status in ('draft','published')),
  published_at  timestamptz,                   -- setado ao publicar
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists editorial_post_status_pub_idx
  on editorial_post (status, published_at desc);

alter table editorial_post enable row level security;

-- Leitura pública apenas do que está publicado. Escrita só via service_role.
drop policy if exists editorial_public_read on editorial_post;
create policy editorial_public_read on editorial_post
  for select using (status = 'published');
