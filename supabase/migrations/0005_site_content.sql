-- 0005_site_content.sql
-- Conteúdo editorial da VITRINE editável pelo cockpit (textos, imagens, SEO, coleção em destaque).
-- Modelo simples chave→JSON. Ex.: 'hero', 'manifesto', 'seo.home'. Cockpit escreve (service_role);
-- a vitrine LÊ publicamente (conteúdo de marketing) via anon — por isso uma policy de SELECT liberada.

create table if not exists site_content (
  key         text primary key,
  value       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

alter table site_content enable row level security;

-- Leitura pública (vitrine, anon). Escrita continua só via service_role (bypassa RLS).
drop policy if exists site_content_public_read on site_content;
create policy site_content_public_read on site_content
  for select using (true);
