-- use.ÉCLAT — Parte 5: camada de relacionamento (CRM) no Supabase.
-- Schema de referência: architecture/crm.md. Data-First, RLS desde o início.
-- Reexecutável (idempotente). Aplicar via psql (connection string) ou SQL Editor do Supabase.

-- ============ TABELAS ============

create table if not exists public.lead (
  id                  uuid primary key default gen_random_uuid(),
  nome                text not null,
  whatsapp            text,
  email               text,
  origem              text check (origem in ('instagram','whatsapp','indicacao','anuncio','site','pagina_eclat')),
  status              text not null default 'novo'
                        check (status in ('novo','contatado','negociando','convertido','perdido')),
  interesse           text,
  responsavel         text,
  notas               text,
  medusa_customer_id  text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.cliente_rel (
  id                  uuid primary key default gen_random_uuid(),
  medusa_customer_id  text not null unique,
  whatsapp            text,
  tags                text[],
  consentimento_lgpd  boolean not null default false,
  consentimento_em    timestamptz,
  notas               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table if not exists public.conversa (
  id              uuid primary key default gen_random_uuid(),
  lead_id         uuid references public.lead(id) on delete cascade,
  cliente_rel_id  uuid references public.cliente_rel(id) on delete cascade,
  canal           text check (canal in ('whatsapp','instagram','email','outro')),
  direcao         text check (direcao in ('entrada','saida')),
  resumo          text,
  conteudo        text,
  status          text,
  external_id     text,
  ocorreu_em      timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  constraint conversa_tem_vinculo check (lead_id is not null or cliente_rel_id is not null)
);

-- ============ ÍNDICES ============

create index if not exists idx_lead_status              on public.lead (status);
create index if not exists idx_lead_whatsapp            on public.lead (whatsapp);
create index if not exists idx_lead_medusa_customer     on public.lead (medusa_customer_id);
create index if not exists idx_conversa_lead            on public.conversa (lead_id);
create index if not exists idx_conversa_cliente_rel     on public.conversa (cliente_rel_id);
create index if not exists idx_conversa_ocorreu_em      on public.conversa (ocorreu_em);

-- ============ updated_at TRIGGER ============

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_lead_updated_at on public.lead;
create trigger trg_lead_updated_at before update on public.lead
  for each row execute function public.set_updated_at();

drop trigger if exists trg_cliente_rel_updated_at on public.cliente_rel;
create trigger trg_cliente_rel_updated_at before update on public.cliente_rel
  for each row execute function public.set_updated_at();

-- ============ RLS ============
-- Liga RLS em todas as tabelas. SEM policies permissivas para anon/authenticated
-- => esses papéis ficam NEGADOS por padrão. O backend usa a service_role, que
-- ignora (bypass) o RLS. A vitrine pública (anon) não acessa o CRM.

alter table public.lead        enable row level security;
alter table public.cliente_rel enable row level security;
alter table public.conversa    enable row level security;
