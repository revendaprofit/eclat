-- use.ÉCLAT — Cockpit Fase 1A: modelo de chat (conversation + message).
-- Substitui a tabela 'conversa' (Parte 5, simplificada) por um modelo de chat real.
-- Reexecutável. RLS; idempotência por evolution_msg_id; realtime para o cockpit.

-- ============ TABELAS ============
create table if not exists public.conversation (
  id                  uuid primary key default gen_random_uuid(),
  contato_e164        text not null,
  nome_contato        text,
  alvo_tipo           text not null default 'nenhum' check (alvo_tipo in ('lead','cliente','nenhum')),
  lead_id             uuid references public.lead(id) on delete set null,
  medusa_customer_id  text,
  instancia_evolution text not null default 'eclat',
  status              text not null default 'aberta',
  nao_lidas           int  not null default 0,
  ia_autoreply        boolean not null default false,
  ultima_msg_em       timestamptz,
  criado_em           timestamptz not null default now(),
  unique (contato_e164, instancia_evolution)
);

create table if not exists public.message (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversation(id) on delete cascade,
  direcao          text not null check (direcao in ('in','out')),
  tipo             text not null default 'texto' check (tipo in ('texto','audio','imagem','video','doc')),
  texto            text,
  media_url        text,
  media_mime       text,
  status           text,
  origem           text not null default 'humano' check (origem in ('humano','ia')),
  "timestamp"      timestamptz not null default now(),
  evolution_msg_id text unique,
  criado_em        timestamptz not null default now()
);

-- ============ ÍNDICES ============
create index if not exists idx_message_conversation on public.message (conversation_id);
create index if not exists idx_message_timestamp    on public.message ("timestamp");
create index if not exists idx_conversation_ultima  on public.conversation (ultima_msg_em desc);
create index if not exists idx_conversation_lead    on public.conversation (lead_id);

-- ============ TRIGGER: bump da conversa a cada mensagem ============
create or replace function public.bump_conversation()
returns trigger language plpgsql as $$
begin
  update public.conversation
     set ultima_msg_em = greatest(coalesce(ultima_msg_em, new."timestamp"), new."timestamp"),
         nao_lidas     = nao_lidas + (case when new.direcao = 'in' then 1 else 0 end)
   where id = new.conversation_id;
  return new;
end; $$;

drop trigger if exists trg_message_bump on public.message;
create trigger trg_message_bump after insert on public.message
  for each row execute function public.bump_conversation();

-- ============ RLS ============
-- Operador autenticado (Supabase Auth) pode LER (UI/realtime). Escrita só via service_role (backend).
alter table public.conversation enable row level security;
alter table public.message      enable row level security;

drop policy if exists conversation_select_auth on public.conversation;
create policy conversation_select_auth on public.conversation for select to authenticated using (true);

drop policy if exists message_select_auth on public.message;
create policy message_select_auth on public.message for select to authenticated using (true);

-- ============ REALTIME ============
alter table public.conversation replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='message') then
    alter publication supabase_realtime add table public.message;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='conversation') then
    alter publication supabase_realtime add table public.conversation;
  end if;
end $$;
