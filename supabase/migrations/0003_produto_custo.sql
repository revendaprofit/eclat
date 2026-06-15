-- 0003_produto_custo.sql
-- Preço de CUSTO (COGS) por variação do Medusa. Financeiro = Supabase (invariante 2).
-- Dinheiro em CENTAVOS INTEIROS (invariante 3). RLS: anon negado; escrita via service_role (cockpit).

create table if not exists produto_custo (
  id uuid primary key default gen_random_uuid(),
  medusa_variant_id text unique not null,
  sku text,
  custo_centavos integer not null check (custo_centavos >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_produto_custo_sku on produto_custo (sku);

alter table produto_custo enable row level security;
-- Sem policies: anon/authenticated negados por padrão; service_role faz bypass (igual às demais tabelas).
