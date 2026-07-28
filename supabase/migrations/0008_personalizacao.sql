-- 0008_personalizacao.sql
-- "Minha ÉCLAT" (modo wizard): personas (modelos das fotos) e mídia por
-- produto × persona. Cockpit escreve via service_role; vitrine LÊ via anon
-- (somente personas ativas). Preferências da cliente ficam no navegador
-- (localStorage/cookie) — NADA de dado pessoal aqui.

create table if not exists persona (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,          -- ex.: aurora
  nome        text not null,                 -- ex.: Aurora
  descricao   text,                          -- biotipo/altura ex.: "1,70m · veste M"
  avatar_url  text,                          -- foto do seletor
  ordem       int not null default 0,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists product_persona_media (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null,                 -- id OU handle do produto no Medusa
  persona_id  uuid not null references persona(id) on delete cascade,
  images      jsonb not null default '[]'::jsonb,  -- ["url1","url2",...] ordenadas
  updated_at  timestamptz not null default now(),
  unique (product_id, persona_id)
);

create index if not exists ppm_product_idx on product_persona_media (product_id);

alter table persona enable row level security;
alter table product_persona_media enable row level security;

drop policy if exists persona_public_read on persona;
create policy persona_public_read on persona
  for select using (ativo = true);

drop policy if exists ppm_public_read on product_persona_media;
create policy ppm_public_read on product_persona_media
  for select using (true);
