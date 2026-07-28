-- 0009_avise_me.sql
-- Captura "avise-me quando chegar" no produto esgotado (spec PDP, Nota 02).
-- Mesmo padrão do newsletter: anon INSERE, só service_role LÊ (privacidade).

create table if not exists public.avise_me (
  id          uuid primary key default gen_random_uuid(),
  product_id  text not null,          -- id ou handle do produto (Medusa)
  variant     text,                   -- ex.: "M / Preto" (opcional)
  email       text,
  whatsapp    text,
  created_at  timestamptz not null default now(),
  notified_at timestamptz             -- preenchido quando a marca avisar
);

create index if not exists idx_avise_me_product on public.avise_me (product_id);

alter table public.avise_me enable row level security;

drop policy if exists avise_me_insert_anon on public.avise_me;
create policy avise_me_insert_anon
  on public.avise_me
  for insert
  to anon
  with check (
    coalesce(length(email), 0) > 0 or coalesce(length(whatsapp), 0) > 0
  );

grant insert on public.avise_me to anon;
