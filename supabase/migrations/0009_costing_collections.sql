-- 0009_costing_collections.sql
-- Estrutura Modelo × Coleção para os custos (aprovada pelo usuário em 27/07/2026):
-- MODELO = catálogo permanente (o molde; modelagem é Despesa — convenção Opção 1).
-- COLEÇÃO/FAMÍLIA = lançamento, com PARÂMETROS PADRÃO herdados pelas fichas novas.
-- FICHA (costing_piece) = modelo dentro de uma coleção, com colorway e BOM próprios.
-- RLS: anon negado (sem policies); service_role (cockpit) faz bypass.

create table if not exists costing_collection (
  id            uuid primary key default gen_random_uuid(),
  name          text unique not null,          -- ex.: Família Blackout — Verde Exército e Licor
  launch_date   date,
  status        text not null default 'planejamento'
                check (status in ('planejamento','producao','lancada','arquivada')),
  -- parâmetros padrão herdados pelas fichas criadas nesta coleção
  perda_pct                numeric not null default 8,
  imposto_pct              numeric not null default 8,
  taxa_pagamento_pct       numeric not null default 5,
  marketing_pct            numeric not null default 10,
  frete_embalagem_centavos integer not null default 0 check (frete_embalagem_centavos >= 0),
  markup                   numeric not null default 3,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists costing_model (
  id                  uuid primary key default gen_random_uuid(),
  name                text unique not null,    -- ex.: Macaquinho Prisma
  category            text,                    -- top | shorts | legging | macaquinho | ...
  reference_image_url text,
  notes               text,
  created_at          timestamptz not null default now()
);

alter table costing_piece add column if not exists collection_id uuid references costing_collection (id) on delete set null;
alter table costing_piece add column if not exists model_id      uuid references costing_model (id) on delete set null;
alter table costing_piece add column if not exists colorway      text;  -- ex.: Verde Exército · Licor 8316

create index if not exists idx_costing_piece_collection on costing_piece (collection_id);
create index if not exists idx_costing_piece_model      on costing_piece (model_id);

alter table costing_collection enable row level security;
alter table costing_model      enable row level security;
