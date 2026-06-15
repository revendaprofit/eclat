-- 0004_financeiro.sql
-- Despesas próprias da Éclat (financeiro = Supabase, invariante 2). Centavos inteiros (invariante 3).
-- RLS: anon/authenticated negados; escrita via service_role (cockpit). DRE cruza com receita (Medusa) + COGS (produto_custo).

create table if not exists finance_expense_category (
  id          uuid primary key default gen_random_uuid(),
  nome        text unique not null,
  created_at  timestamptz not null default now()
);

create table if not exists finance_expense (
  id              uuid primary key default gen_random_uuid(),
  data            date not null,
  categoria_id    uuid references finance_expense_category(id) on delete set null,
  descricao       text,
  valor_centavos  integer not null check (valor_centavos >= 0),
  fornecedor      text,
  recorrencia     text,  -- ex.: 'mensal', 'unica'
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_finance_expense_data on finance_expense (data);
create index if not exists idx_finance_expense_categoria on finance_expense (categoria_id);

alter table finance_expense_category enable row level security;
alter table finance_expense enable row level security;
-- Sem policies: anon/authenticated negados; service_role bypass.

-- Categorias padrão (idempotente)
insert into finance_expense_category (nome) values
  ('Fornecedores / Produção'),
  ('Marketing / Anúncios'),
  ('Logística / Frete'),
  ('Embalagem'),
  ('Operacional'),
  ('Impostos / Taxas'),
  ('Outros')
on conflict (nome) do nothing;
