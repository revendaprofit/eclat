-- 0006_newsletter.sql
-- Captura de e-mails da newsletter da vitrine (bloco da home).
-- RLS: anon pode INSERIR (inscrever-se), mas NÃO pode LER (privacidade dos e-mails).
-- Leitura fica só para o backend/service_role (e futuramente o Cockpit/CRM).

create table if not exists public.newsletter_signup (
  id          uuid primary key default gen_random_uuid(),
  email       text not null,
  source      text,
  created_at  timestamptz not null default now()
);

-- evita duplicados do mesmo e-mail
create unique index if not exists idx_newsletter_email
  on public.newsletter_signup (lower(email));

alter table public.newsletter_signup enable row level security;

-- anon só pode inserir
drop policy if exists newsletter_insert_anon on public.newsletter_signup;
create policy newsletter_insert_anon
  on public.newsletter_signup
  for insert
  to anon
  with check (true);

-- garante o privilégio de INSERT ao papel anon (RLS ainda restringe via policy)
grant insert on public.newsletter_signup to anon;
